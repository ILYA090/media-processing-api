import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, FolderOpen, History } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/Card';
import { api } from '@/services/api';
import type { AdminOrganization } from '@/types';

export function AdminDashboardPage() {
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminGetOrganizations({ limit: 100 })
      .then((res) => {
        const data = res.data ?? res;
        setOrgs(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error('Failed to load organizations:', err))
      .finally(() => setLoading(false));
  }, []);

  const totalOrgs = orgs.length;
  const totalUsers = orgs.reduce((sum, o) => sum + (o.userCount || 0), 0);
  const totalMedia = orgs.reduce((sum, o) => sum + (o.mediaCount || 0), 0);
  const totalJobs = orgs.reduce((sum, o) => sum + (o.jobCount || 0), 0);

  const stats = [
    { label: 'Organizations', value: totalOrgs, icon: Building2, color: 'bg-blue-500' },
    { label: 'Total Users', value: totalUsers, icon: Users, color: 'bg-green-500' },
    { label: 'Media Files', value: totalMedia, icon: FolderOpen, color: 'bg-purple-500' },
    { label: 'Processing Jobs', value: totalJobs, icon: History, color: 'bg-orange-500' },
  ];

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Platform overview and management</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <div className="animate-pulse h-20" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <div className="flex items-center gap-4">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Organizations</h2>
              <Link
                to="/admin/organizations"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View all
              </Link>
            </div>
            {orgs.length === 0 ? (
              <p className="text-gray-500 text-sm">No organizations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-500">Name</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500">Slug</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500">Users</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500">Media</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500">Jobs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.slice(0, 5).map((org) => (
                      <tr key={org.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 font-medium text-gray-900">{org.name}</td>
                        <td className="py-3 px-2 text-gray-500">{org.slug}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{org.userCount}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{org.mediaCount}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{org.jobCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </AdminLayout>
  );
}
