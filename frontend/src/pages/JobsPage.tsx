import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Download,
  XCircle,
  Eye,
  Filter,
  FileText,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/services/api';
import { formatDateTime } from '@/utils/helpers';
import { ACTION_LABELS } from '@/utils/constants';
import { toast } from 'sonner';
import type { ProcessingJob } from '@/types';

function getResultPreview(job: ProcessingJob): string | null {
  if (job.status !== 'completed' || !job.resultData) return null;
  const data = job.resultData as Record<string, unknown>;

  if (data.text) return String(data.text).substring(0, 80);
  if (data.description) return String(data.description).substring(0, 80);
  if ((data.analysis as any)?.fullAnalysis) return String((data.analysis as any).fullAnalysis).substring(0, 80);

  return null;
}

function JobResultDisplay({ job }: { job: ProcessingJob }) {
  const navigate = useNavigate();
  const data = job.resultData as Record<string, unknown> | null;

  if (job.status !== 'completed') return null;

  // Text results (OCR, describe, analyze, transcribe)
  if (job.resultType === 'JSON' && data && Object.keys(data).length > 0) {
    const mainText = data.text || data.description || (data.analysis as any)?.fullAnalysis;

    return (
      <div className="space-y-3">
        {mainText && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {data.text ? 'Extracted Text' : data.description ? 'Description' : 'Analysis'}
            </p>
            <div className="bg-gray-50 border rounded-lg p-3 max-h-64 overflow-auto">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{String(mainText)}</p>
            </div>
          </div>
        )}
        {/* Show other fields */}
        {data.language && data.language !== 'auto' && (
          <p className="text-xs text-gray-500">Language: {String(data.language)}</p>
        )}
        {data.provider && (
          <p className="text-xs text-gray-500">Provider: {String(data.provider)}</p>
        )}
        {data.metadata && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Metadata</p>
            <div className="bg-gray-50 border rounded-lg p-3">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(data.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
        {/* Fallback for unknown structure */}
        {!mainText && !data.metadata && (
          <div className="bg-gray-50 border rounded-lg p-3">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // File result
  if (job.resultType === 'FILE' && job.resultMediaId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <FileText className="w-5 h-5 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-900">Output file saved to Media Library</p>
            <p className="text-xs text-green-700">Media ID: {job.resultMediaId}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/media`)}
            >
              <ExternalLink className="w-3 h-3 mr-1" /> Library
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await api.downloadMedia(job.resultMediaId!, 'result');
                } catch {
                  toast.error('Failed to download');
                }
              }}
            >
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function JobsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcessingJob | null>(null);
  const [deleteResultFile, setDeleteResultFile] = useState(true);

  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () =>
      api.getJobs({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel job');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteResult }: { id: string; deleteResult: boolean }) =>
      api.deleteJob(id, deleteResult),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setDeleteTarget(null);
      if (selectedJob?.id === deleteTarget?.id) setSelectedJob(null);
      toast.success('Job deleted');
    },
    onError: () => {
      toast.error('Failed to delete job');
    },
  });

  const handleDownloadResult = async (job: ProcessingJob) => {
    try {
      if (job.resultMediaId) {
        await api.downloadMedia(job.resultMediaId);
      }
    } catch {
      toast.error('Failed to download result');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-purple-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Processing Jobs"
        description="View and manage your processing jobs"
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'queued', label: 'Queued' },
              { value: 'processing', label: 'Processing' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            className="w-40"
          />
        </div>
      </Card>

      {/* Jobs Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : jobs?.data?.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500 mb-4">No jobs found</p>
          <Button onClick={() => navigate('/process')}>Start Processing</Button>
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Action</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Result</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Duration</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Created</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs?.data?.map((job: ProcessingJob) => {
                const preview = getResultPreview(job);
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {ACTION_LABELS[job.actionId] || job.actionId}
                      </p>
                      <p className="text-xs text-gray-500">{job.actionCategory}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(job.status)}
                        <Badge variant="status" status={job.status}>
                          {job.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {job.status === 'completed' ? (
                        job.resultType === 'FILE' ? (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> File output
                          </span>
                        ) : preview ? (
                          <p className="text-xs text-gray-600 truncate max-w-[200px]">{preview}...</p>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )
                      ) : job.status === 'failed' ? (
                        <p className="text-xs text-red-500 truncate max-w-[200px]">
                          {job.errorMessage?.substring(0, 50) || 'Error'}
                        </p>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {job.processingTimeMs
                        ? `${(job.processingTimeMs / 1000).toFixed(1)}s`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDateTime(job.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedJob(job)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {job.status === 'completed' && job.resultType === 'FILE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadResult(job)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        {['pending', 'queued'].includes(job.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelMutation.mutate(job.id)}
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeleteTarget(job);
                            setDeleteResultFile(!!job.resultMediaId);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Job Details Modal */}
      <Modal
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title="Job Details"
        size="lg"
      >
        {selectedJob && (
          <div className="space-y-5">
            {/* Header info */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {ACTION_LABELS[selectedJob.actionId] || selectedJob.actionId}
                </h3>
                <p className="text-sm text-gray-500">{selectedJob.actionCategory}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {getStatusIcon(selectedJob.status)}
                <Badge variant="status" status={selectedJob.status}>
                  {selectedJob.status}
                </Badge>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Job ID</p>
                <p className="font-mono text-xs">{selectedJob.id}</p>
              </div>
              <div>
                <p className="text-gray-500">Created</p>
                <p>{formatDateTime(selectedJob.createdAt)}</p>
              </div>
              {selectedJob.completedAt && (
                <div>
                  <p className="text-gray-500">Completed</p>
                  <p>{formatDateTime(selectedJob.completedAt)}</p>
                </div>
              )}
              {selectedJob.processingTimeMs && (
                <div>
                  <p className="text-gray-500">Processing Time</p>
                  <p>{(selectedJob.processingTimeMs / 1000).toFixed(1)}s</p>
                </div>
              )}
            </div>

            {/* Error */}
            {selectedJob.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-600 mt-1">{selectedJob.errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {selectedJob.status === 'completed' && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Result</p>
                <JobResultDisplay job={selectedJob} />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteTarget(selectedJob);
                  setDeleteResultFile(!!selectedJob.resultMediaId);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Job
              </Button>
              <div className="flex gap-2">
                {selectedJob.status === 'completed' && selectedJob.resultType === 'FILE' && (
                  <Button onClick={() => handleDownloadResult(selectedJob)}>
                    <Download className="w-4 h-4 mr-2" /> Download Result
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedJob(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Job"
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to permanently delete this job?
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-900">
                {ACTION_LABELS[deleteTarget.actionId] || deleteTarget.actionId}
              </p>
              <p className="text-xs text-gray-500 font-mono mt-1">{deleteTarget.id}</p>
            </div>

            {deleteTarget.resultMediaId && (
              <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteResultFile}
                  onChange={(e) => setDeleteResultFile(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <div>
                  <p className="text-sm font-medium text-amber-900">Also delete result file</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    The output file in your Media Library will also be removed
                  </p>
                </div>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() =>
                  deleteMutation.mutate({
                    id: deleteTarget.id,
                    deleteResult: deleteResultFile,
                  })
                }
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
