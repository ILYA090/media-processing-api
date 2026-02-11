import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/services/api';
import { formatBytes } from '@/utils/helpers';
import { ACTION_LABELS_SHORT } from '@/utils/constants';
import { toast } from 'sonner';

export function UsagePage() {
  const [period, setPeriod] = useState('7d');

  const { data: usage } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: () => api.getUsageSummary(),
  });

  const { data: detailed } = useQuery({
    queryKey: ['usage-detailed', period],
    queryFn: () => api.getUsageDetailed({ startDate: getStartDate(period) }),
  });

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const data = await api.exportUsage(format);
      const blob = new Blob([format === 'json' ? JSON.stringify(data) : data], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-report.${format}`;
      a.click();
      toast.success('Export downloaded');
    } catch {
      toast.error('Failed to export data');
    }
  };

  // Transform byDay data for charts
  const dailyData = detailed?.byDay
    ? Object.entries(detailed.byDay)
        .map(([date, count]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          requests: count as number,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  // Transform byAction data for charts
  const actionData = detailed?.byAction
    ? Object.entries(detailed.byAction)
        .map(([name, count]) => ({
          name: ACTION_LABELS_SHORT[name] || name,
          count: count as number,
        }))
        .sort((a, b) => (b.count as number) - (a.count as number))
    : [];

  // Compute stats from usage data
  const totalRequests = usage?.totalRequests || 0;
  const storageBytesUsed = Number(usage?.storageBytesUsed || 0);
  const jobsCompleted = usage?.jobsCompleted || 0;
  const jobsFailed = usage?.jobsFailed || 0;
  const jobsTotal = usage?.jobsTotal || 0;
  const successRate = jobsTotal > 0 ? Math.round((jobsCompleted / jobsTotal) * 100) : 0;
  const failureRate = jobsTotal > 0 ? Math.round((jobsFailed / jobsTotal) * 100) : 0;

  return (
    <Layout>
      <PageHeader
        title="Usage & Analytics"
        description="Monitor your API usage and processing statistics"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: '24h', label: 'Last 24 hours' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: '90d', label: 'Last 90 days' },
              ]}
              className="w-40"
            />
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-sm text-gray-500">Total API Requests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {totalRequests.toLocaleString()}
          </p>
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            <span>{usage?.totalUploads || 0} uploads</span>
            <span>{usage?.totalDownloads || 0} downloads</span>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-gray-500">Storage Used</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatBytes(storageBytesUsed)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {usage?.mediaCount || 0} files
          </p>
        </Card>

        <Card>
          <p className="text-sm text-gray-500">Jobs Completed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {jobsCompleted}
          </p>
          <p className="text-xs text-green-600 mt-2">
            {successRate}% success rate
          </p>
        </Card>

        <Card>
          <p className="text-sm text-gray-500">Jobs Failed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {jobsFailed}
          </p>
          <p className="text-xs text-red-600 mt-2">
            {failureRate}% failure rate
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <Card>
          <CardTitle>Requests Over Time</CardTitle>
          <div className="h-64 mt-4">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="#3b82f6"
                    fill="#93c5fd"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No request data for this period
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Usage by Action</CardTitle>
          <div className="h-64 mt-4">
            {actionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No action data for this period
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Endpoint breakdown */}
      {detailed?.byEndpoint && Object.keys(detailed.byEndpoint).length > 0 && (
        <Card>
          <CardTitle>Requests by Endpoint</CardTitle>
          <div className="mt-4 space-y-2">
            {Object.entries(detailed.byEndpoint)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 10)
              .map(([endpoint, count]) => (
                <div key={endpoint} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <code className="text-sm text-gray-700">{endpoint}</code>
                  <span className="text-sm font-medium text-gray-900">{(count as number).toLocaleString()}</span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </Layout>
  );
}

function getStartDate(period: string): string {
  const now = new Date();
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}
