import { prisma } from '../core/database/prisma.js';
import { addJob, getJob, removeJob } from '../core/queue/bullmq.js';
import { actionRegistry } from '../plugins/actions/registry.js';
import { getMediaById } from './media.service.js';
import { NotFoundError, ValidationError, ActionNotSupportedError } from '../utils/errors.js';
import { jobLogger } from '../utils/logger.js';
import type {
  ProcessingJob,
  JobStatus as PrismaJobStatus,
  ActionCategory as PrismaActionCategory,
} from '@prisma/client';
import type { JobData, JobStatus, ActionCategory } from '../types/index.js';

export interface CreateJobData {
  organizationId: string;
  userId?: string;
  apiKeyId?: string;
  mediaId: string;
  actionId: string;
  parameters?: Record<string, unknown>;
  priority?: number;
}

export interface JobResponse {
  id: string;
  mediaId: string;
  actionId: string;
  actionCategory: string;
  parameters: unknown;
  status: string;
  priority: number;
  resultType?: string | null;
  resultMediaId?: string | null;
  resultData?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  processingTimeMs?: number | null;
  createdAt: string;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

const CATEGORY_MAP: Record<ActionCategory, PrismaActionCategory> = {
  transcribe: 'TRANSCRIBE',
  modify: 'MODIFY',
  process: 'PROCESS',
};

const STATUS_MAP: Record<string, JobStatus> = {
  PENDING: 'pending',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export async function createJob(data: CreateJobData): Promise<ProcessingJob> {
  const { organizationId, userId, apiKeyId, mediaId, actionId, parameters, priority } = data;

  // Get media file
  const media = await getMediaById(organizationId, mediaId);

  // Check if action exists and supports this media type
  const handler = actionRegistry.get(actionId);
  const mediaType = media.mediaType.toLowerCase();

  if (handler.mediaType !== mediaType) {
    throw new ActionNotSupportedError(actionId, mediaType);
  }

  // Validate parameters
  const validationResult = handler.validate(parameters || {});
  if (!validationResult.valid) {
    throw new ValidationError('Invalid action parameters', {
      errors: validationResult.errors,
    });
  }

  // Create job in database
  const job = await prisma.processingJob.create({
    data: {
      organizationId,
      userId,
      apiKeyId,
      inputMediaId: mediaId,
      actionId,
      actionCategory: CATEGORY_MAP[handler.category],
      parameters: parameters || {},
      status: 'PENDING',
      priority: priority || 50,
    },
  });

  // Add to queue
  const jobData: JobData = {
    jobId: job.id,
    organizationId,
    userId,
    apiKeyId,
    mediaId,
    actionId,
    actionCategory: handler.category,
    parameters: parameters || {},
    priority: priority || 50,
  };

  await addJob(jobData, Number(media.fileSizeBytes), { priority });

  // Update status to QUEUED
  await prisma.processingJob.update({
    where: { id: job.id },
    data: {
      status: 'QUEUED',
      queuedAt: new Date(),
    },
  });

  jobLogger.info({ jobId: job.id, actionId, mediaId }, 'Job created and queued');

  return prisma.processingJob.findUniqueOrThrow({ where: { id: job.id } });
}

export async function getJobs(
  organizationId: string,
  options?: {
    page?: number;
    limit?: number;
    status?: JobStatus;
    mediaId?: string;
    userId?: string;
  }
): Promise<{ jobs: ProcessingJob[]; total: number }> {
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId };

  if (options?.userId) {
    where.userId = options.userId;
  }

  if (options?.status) {
    where.status = options.status.toUpperCase();
  }

  if (options?.mediaId) {
    where.inputMediaId = options.mediaId;
  }

  const [jobs, total] = await Promise.all([
    prisma.processingJob.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.processingJob.count({ where }),
  ]);

  return { jobs, total };
}

export async function getJobById(organizationId: string, jobId: string, userId?: string): Promise<ProcessingJob> {
  const where: Record<string, unknown> = { id: jobId, organizationId };
  if (userId) {
    where.userId = userId;
  }

  const job = await prisma.processingJob.findFirst({ where });

  if (!job) {
    throw new NotFoundError('Job', jobId);
  }

  return job;
}

export async function getJobResult(
  organizationId: string,
  jobId: string,
  userId?: string
): Promise<{
  type: string;
  data?: unknown;
  mediaId?: string;
}> {
  const job = await getJobById(organizationId, jobId, userId);

  if (job.status !== 'COMPLETED') {
    throw new ValidationError(`Job is not completed. Current status: ${job.status}`);
  }

  return {
    type: job.resultType || 'unknown',
    data: job.resultData,
    mediaId: job.resultMediaId || undefined,
  };
}

export async function cancelJob(organizationId: string, jobId: string, userId?: string): Promise<ProcessingJob> {
  const job = await getJobById(organizationId, jobId, userId);

  if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
    throw new ValidationError(`Cannot cancel job with status: ${job.status}`);
  }

  // Remove from queue if queued
  if (job.status === 'QUEUED' || job.status === 'PENDING') {
    await removeJob(jobId);
  }

  // Update status
  const updatedJob = await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
    },
  });

  jobLogger.info({ jobId }, 'Job cancelled');

  return updatedJob;
}

export async function deleteJob(
  organizationId: string,
  jobId: string,
  userId?: string,
  deleteResultFile?: boolean
): Promise<void> {
  const job = await getJobById(organizationId, jobId, userId);

  // Cancel if still running
  if (job.status === 'PENDING' || job.status === 'QUEUED') {
    await removeJob(jobId);
  }

  // Delete result file from storage and DB if requested
  if (deleteResultFile && job.resultMediaId) {
    try {
      const { deleteMedia } = await import('./media.service.js');
      await deleteMedia(organizationId, job.resultMediaId);
    } catch {
      jobLogger.warn({ jobId, resultMediaId: job.resultMediaId }, 'Failed to delete result media');
    }
  }

  // Delete the job record
  await prisma.processingJob.delete({
    where: { id: jobId },
  });

  jobLogger.info({ jobId, deleteResultFile }, 'Job deleted');
}

export async function updateJobStatus(
  jobId: string,
  status: PrismaJobStatus,
  data?: {
    workerId?: string;
    startedAt?: Date;
    completedAt?: Date;
    resultType?: string;
    resultMediaId?: string;
    resultData?: unknown;
    errorCode?: string;
    errorMessage?: string;
    processingTimeMs?: number;
    aiProvider?: string;
    aiTokensUsed?: number;
    retryCount?: number;
  }
): Promise<ProcessingJob> {
  const updatePayload: Record<string, unknown> = {
    status,
    workerId: data?.workerId,
    startedAt: data?.startedAt,
    completedAt: data?.completedAt,
    resultType: data?.resultType,
    resultMediaId: data?.resultMediaId,
    errorCode: data?.errorCode,
    errorMessage: data?.errorMessage,
    processingTimeMs: data?.processingTimeMs,
    aiProvider: data?.aiProvider,
    aiTokensUsed: data?.aiTokensUsed,
    retryCount: data?.retryCount,
  };

  // Only set resultData if provided
  if (data?.resultData !== undefined) {
    updatePayload.resultData = data.resultData;
  }

  // Remove undefined keys so Prisma doesn't try to set them
  for (const key of Object.keys(updatePayload)) {
    if (updatePayload[key] === undefined) {
      delete updatePayload[key];
    }
  }

  return prisma.processingJob.update({
    where: { id: jobId },
    data: updatePayload,
  });
}

export function formatJobResponse(job: ProcessingJob): JobResponse {
  return {
    id: job.id,
    mediaId: job.inputMediaId,
    actionId: job.actionId,
    actionCategory: job.actionCategory.toLowerCase(),
    parameters: job.parameters,
    status: STATUS_MAP[job.status] || job.status.toLowerCase(),
    priority: job.priority,
    resultType: job.resultType,
    resultMediaId: job.resultMediaId,
    resultData: job.resultData,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    processingTimeMs: job.processingTimeMs,
    createdAt: job.createdAt.toISOString(),
    queuedAt: job.queuedAt?.toISOString() || null,
    startedAt: job.startedAt?.toISOString() || null,
    completedAt: job.completedAt?.toISOString() || null,
  };
}
