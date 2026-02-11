import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Upload,
  FolderOpen,
  Zap,
  History,
  ArrowRight,
  Image,
  Music,
  CheckCircle,
  Clock,
  AlertCircle,
  HardDrive,
  FileText,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AuthImage } from '@/components/ui/AuthImage';
import { api } from '@/services/api';
import { formatBytes, formatDateTime } from '@/utils/helpers';
import { ACTION_LABELS } from '@/utils/constants';

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: usage } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: () => api.getUsageSummary(),
  });

  const { data: recentJobs } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => api.getJobs({ limit: 5 }),
  });

  const { data: recentMedia } = useQuery({
    queryKey: ['recent-media'],
    queryFn: () => api.getMediaList({ limit: 4 }),
  });

  const allJobs = recentJobs?.data || [];
  const completedCount = usage?.jobsCompleted || 0;
  const failedCount = usage?.jobsFailed || 0;
  const pendingCount = usage?.jobsPending || 0;

  const quickActions = [
    { name: 'Upload Media', href: '/upload', icon: Upload, color: 'bg-blue-500' },
    { name: 'Media Library', href: '/media', icon: FolderOpen, color: 'bg-green-500' },
    { name: 'View Jobs', href: '/jobs', icon: History, color: 'bg-orange-500' },
  ];

  return (
    <Layout>
      <PageHeader
        title="Dashboard"
        description="Overview of your media processing activity"
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {quickActions.map((action) => (
          <Link key={action.name} to={action.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${action.color}`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{action.name}</p>
                  <p className="text-sm text-gray-500">Click to open</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Media Files */}
        <Card>
          <CardTitle>Media Files</CardTitle>
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <HardDrive className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {usage?.mediaCount || recentMedia?.data?.length || 0}
                </p>
                <p className="text-sm text-gray-500">Total files</p>
              </div>
            </div>
            {usage?.storageBytesUsed && Number(usage.storageBytesUsed) > 0 && (
              <p className="text-sm text-gray-500 mt-3">
                {formatBytes(Number(usage.storageBytesUsed))} storage used
              </p>
            )}
          </div>
        </Card>

        {/* API Activity */}
        <Card>
          <CardTitle>API Activity</CardTitle>
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {usage?.totalRequests || 0}
                </p>
                <p className="text-sm text-gray-500">Total requests</p>
              </div>
            </div>
            <div className="flex gap-4 mt-3 text-sm text-gray-500">
              <span>{usage?.totalUploads || 0} uploads</span>
              <span>{usage?.totalDownloads || 0} downloads</span>
            </div>
          </div>
        </Card>

        {/* Processing Jobs */}
        <Card>
          <CardTitle>Processing Jobs</CardTitle>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto bg-green-100 rounded-full mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {completedCount}
              </p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto bg-yellow-100 rounded-full mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {pendingCount}
              </p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto bg-red-100 rounded-full mb-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {failedCount}
              </p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Recent Jobs</CardTitle>
            <Link to="/jobs">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {allJobs.length > 0 ? (
            <div className="space-y-3">
              {allJobs.map((job: any) => (
                <div
                  key={job.id}
                  onClick={() => navigate('/jobs')}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                      {job.actionCategory === 'modify' ? (
                        <Zap className="w-4 h-4 text-gray-600" />
                      ) : job.actionCategory === 'transcribe' ? (
                        <FileText className="w-4 h-4 text-gray-600" />
                      ) : (
                        <Image className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {ACTION_LABELS[job.actionId] || job.actionId}
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(job.createdAt)}</p>
                    </div>
                  </div>
                  <Badge variant="status" status={job.status}>
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No jobs yet</p>
          )}
        </Card>

        {/* Recent Media */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Recent Media</CardTitle>
            <Link to="/media">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {recentMedia?.data?.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {recentMedia.data.map((media: any) => (
                <div
                  key={media.id}
                  onClick={() => navigate(`/process?mediaId=${media.id}`)}
                  className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden group cursor-pointer"
                >
                  {media.mediaType === 'image' && media.thumbnailUrl ? (
                    <AuthImage
                      src={media.thumbnailUrl}
                      alt={media.originalFilename}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-8 h-8 text-gray-400" />
                        </div>
                      }
                    />
                  ) : media.mediaType === 'image' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-xs text-center px-2 truncate">
                      {media.originalFilename}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No media uploaded yet</p>
          )}
        </Card>
      </div>
    </Layout>
  );
}
