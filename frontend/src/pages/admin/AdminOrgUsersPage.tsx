import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type { AdminOrgUser } from '@/types';

export function AdminOrgUsersPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [users, setUsers] = useState<AdminOrgUser[]>([]);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    if (!orgId) return;
    setLoading(true);
    api.adminGetOrgUsers(orgId, { limit: 100 })
      .then((res) => {
        const data = res.data ?? res;
        setUsers(data.users || []);
        setOrgName(data.organization?.name || '');
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [orgId]);

  const handleDelete = async (userId: string, userName: string) => {
    if (!orgId) return;
    if (!window.confirm(`Delete user "${userName}"? This action is irreversible.`)) return;
    try {
      await api.adminDeleteUser(orgId, userId);
      toast.success('User deleted');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to delete user');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <Link
          to="/admin/organizations"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to organizations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Users{orgName ? ` - ${orgName}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">Manage users in this organization</p>
      </div>

      <Card>
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No users in this organization.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Email</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Last Login</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Created</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{user.name}</td>
                    <td className="py-3 px-2 text-gray-500">{user.email}</td>
                    <td className="py-3 px-2">
                      <Badge>{user.role}</Badge>
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant="status" status={user.status}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-gray-500">{formatDate(user.lastLoginAt)}</td>
                    <td className="py-3 px-2 text-gray-500">{formatDate(user.createdAt)}</td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}
