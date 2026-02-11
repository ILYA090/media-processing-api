import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Users } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type { AdminOrganization } from '@/types';

export function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    adminEmail: '',
    adminPassword: '',
    adminName: '',
  });

  const fetchOrgs = () => {
    setLoading(true);
    api.adminGetOrganizations({ limit: 100 })
      .then((res) => {
        const data = res.data ?? res;
        setOrgs(Array.isArray(data) ? data : []);
      })
      .catch(() => toast.error('Failed to load organizations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.adminEmail || !form.adminPassword || !form.adminName) {
      toast.error('All fields are required');
      return;
    }
    setCreating(true);
    try {
      await api.adminCreateOrganization(form);
      toast.success('Organization created');
      setShowCreate(false);
      setForm({ name: '', adminEmail: '', adminPassword: '', adminName: '' });
      fetchOrgs();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (orgId: string, orgName: string) => {
    if (!window.confirm(`Delete organization "${orgName}"? This action is irreversible.`)) return;
    try {
      await api.adminDeleteOrganization(orgId);
      toast.success('Organization deleted');
      fetchOrgs();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to delete organization');
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-500 mt-1">Manage platform organizations</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No organizations yet. Create one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Slug</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Email</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Users</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Media</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Jobs</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{org.name}</td>
                    <td className="py-3 px-2 text-gray-500">{org.slug}</td>
                    <td className="py-3 px-2 text-gray-500">{org.email}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{org.userCount}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{org.mediaCount}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{org.jobCount}</td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/organizations/${org.id}/users`}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100"
                          title="View users"
                        >
                          <Users className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(org.id, org.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
                          title="Delete organization"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Organization Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Organization">
        <div className="space-y-4">
          <Input
            label="Organization Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Acme Inc."
          />
          <Input
            label="Admin Name"
            value={form.adminName}
            onChange={(e) => setForm({ ...form, adminName: e.target.value })}
            placeholder="John Doe"
          />
          <Input
            label="Admin Email"
            type="email"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            placeholder="admin@acme.com"
          />
          <Input
            label="Admin Password"
            type="password"
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
            placeholder="Minimum 6 characters"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
