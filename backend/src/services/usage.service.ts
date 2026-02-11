import { prisma } from '../core/database/prisma.js';
import type { UsageRecord, UsageActionType as PrismaUsageActionType } from '@prisma/client';
import type { UsageActionType } from '../types/index.js';

const ACTION_TYPE_MAP: Record<UsageActionType, PrismaUsageActionType> = {
  upload: 'UPLOAD',
  process: 'PROCESS',
  download: 'DOWNLOAD',
  api_call: 'API_CALL',
};

export interface CreateUsageData {
  organizationId: string;
  userId?: string;
  apiKeyId?: string;
  jobId?: string;
  actionType: UsageActionType;
  actionId?: string;
  mediaType?: string;
  fileSizeBytes?: bigint;
  processingTimeMs?: number;
  aiTokensUsed?: number;
  requestIp: string;
  userAgent?: string;
  endpoint: string;
  httpMethod: string;
  responseStatus: number;
  creditsUsed?: number;
}

export interface UsageSummary {
  totalRequests: number;
  totalUploads: number;
  totalProcessing: number;
  totalDownloads: number;
  totalBytesUploaded: bigint;
  totalProcessingTimeMs: number;
  totalAiTokensUsed: number;
  totalCreditsUsed: number;
  // Job stats from processing_job table
  jobsCompleted: number;
  jobsFailed: number;
  jobsPending: number;
  jobsTotal: number;
  // Media stats
  mediaCount: number;
  storageBytesUsed: bigint;
}

export interface DetailedUsage {
  byAction: Record<string, number>;
  byMediaType: Record<string, number>;
  byEndpoint: Record<string, number>;
  byDay: Record<string, number>;
}

export async function createUsageRecord(data: CreateUsageData): Promise<UsageRecord> {
  return prisma.usageRecord.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      apiKeyId: data.apiKeyId,
      jobId: data.jobId,
      actionType: ACTION_TYPE_MAP[data.actionType],
      actionId: data.actionId,
      mediaType: data.mediaType,
      fileSizeBytes: data.fileSizeBytes,
      processingTimeMs: data.processingTimeMs,
      aiTokensUsed: data.aiTokensUsed,
      requestIp: data.requestIp,
      userAgent: data.userAgent,
      endpoint: data.endpoint,
      httpMethod: data.httpMethod,
      responseStatus: data.responseStatus,
      creditsUsed: data.creditsUsed,
    },
  });
}

export async function getUsageSummary(
  organizationId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    apiKeyId?: string;
  }
): Promise<UsageSummary> {
  const where: Record<string, unknown> = { organizationId };

  if (options?.startDate || options?.endDate) {
    where.timestamp = {};
    if (options.startDate) {
      (where.timestamp as Record<string, Date>).gte = options.startDate;
    }
    if (options.endDate) {
      (where.timestamp as Record<string, Date>).lte = options.endDate;
    }
  }

  if (options?.userId) {
    where.userId = options.userId;
  }

  if (options?.apiKeyId) {
    where.apiKeyId = options.apiKeyId;
  }

  // Build per-user filters for jobs and media
  const jobWhere: Record<string, unknown> = { organizationId };
  const mediaWhere: Record<string, unknown> = { organizationId, status: 'READY' };
  if (options?.userId) {
    jobWhere.userId = options.userId;
    mediaWhere.uploadedByUserId = options.userId;
  }

  const [records, jobCounts, mediaStats] = await Promise.all([
    prisma.usageRecord.findMany({ where }),
    // Get job counts by status
    prisma.processingJob.groupBy({
      by: ['status'],
      where: jobWhere,
      _count: true,
    }),
    // Get media stats
    prisma.mediaFile.aggregate({
      where: mediaWhere,
      _count: true,
      _sum: { fileSizeBytes: true },
    }),
  ]);

  // Parse job counts
  let jobsCompleted = 0;
  let jobsFailed = 0;
  let jobsPending = 0;
  let jobsTotal = 0;
  for (const group of jobCounts) {
    jobsTotal += group._count;
    switch (group.status) {
      case 'COMPLETED':
        jobsCompleted = group._count;
        break;
      case 'FAILED':
        jobsFailed = group._count;
        break;
      case 'PENDING':
      case 'QUEUED':
      case 'PROCESSING':
        jobsPending += group._count;
        break;
    }
  }

  const summary: UsageSummary = {
    totalRequests: records.length,
    totalUploads: 0,
    totalProcessing: 0,
    totalDownloads: 0,
    totalBytesUploaded: BigInt(0),
    totalProcessingTimeMs: 0,
    totalAiTokensUsed: 0,
    totalCreditsUsed: 0,
    jobsCompleted,
    jobsFailed,
    jobsPending,
    jobsTotal,
    mediaCount: mediaStats._count,
    storageBytesUsed: mediaStats._sum.fileSizeBytes || BigInt(0),
  };

  for (const record of records) {
    switch (record.actionType) {
      case 'UPLOAD':
        summary.totalUploads++;
        if (record.fileSizeBytes) {
          summary.totalBytesUploaded += record.fileSizeBytes;
        }
        break;
      case 'PROCESS':
        summary.totalProcessing++;
        break;
      case 'DOWNLOAD':
        summary.totalDownloads++;
        break;
    }

    if (record.processingTimeMs) {
      summary.totalProcessingTimeMs += record.processingTimeMs;
    }
    if (record.aiTokensUsed) {
      summary.totalAiTokensUsed += record.aiTokensUsed;
    }
    if (record.creditsUsed) {
      summary.totalCreditsUsed += Number(record.creditsUsed);
    }
  }

  return summary;
}

export async function getDetailedUsage(
  organizationId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
    userId?: string;
  }
): Promise<DetailedUsage> {
  const where: Record<string, unknown> = { organizationId };

  if (options?.userId) {
    where.userId = options.userId;
  }

  const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = options?.endDate || new Date();

  where.timestamp = {
    gte: startDate,
    lte: endDate,
  };

  const records = await prisma.usageRecord.findMany({ where });

  const detailed: DetailedUsage = {
    byAction: {},
    byMediaType: {},
    byEndpoint: {},
    byDay: {},
  };

  for (const record of records) {
    // By action
    if (record.actionId) {
      detailed.byAction[record.actionId] = (detailed.byAction[record.actionId] || 0) + 1;
    }

    // By media type
    if (record.mediaType) {
      detailed.byMediaType[record.mediaType] = (detailed.byMediaType[record.mediaType] || 0) + 1;
    }

    // By endpoint
    detailed.byEndpoint[record.endpoint] = (detailed.byEndpoint[record.endpoint] || 0) + 1;

    // By day
    const day = record.timestamp.toISOString().split('T')[0]!;
    detailed.byDay[day] = (detailed.byDay[day] || 0) + 1;
  }

  return detailed;
}

export async function getUsageRecords(
  organizationId: string,
  options?: {
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    actionType?: UsageActionType;
    userId?: string;
  }
): Promise<{ records: UsageRecord[]; total: number }> {
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId };

  if (options?.userId) {
    where.userId = options.userId;
  }

  if (options?.startDate || options?.endDate) {
    where.timestamp = {};
    if (options.startDate) {
      (where.timestamp as Record<string, Date>).gte = options.startDate;
    }
    if (options.endDate) {
      (where.timestamp as Record<string, Date>).lte = options.endDate;
    }
  }

  if (options?.actionType) {
    where.actionType = ACTION_TYPE_MAP[options.actionType];
  }

  const [records, total] = await Promise.all([
    prisma.usageRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
    }),
    prisma.usageRecord.count({ where }),
  ]);

  return { records, total };
}
