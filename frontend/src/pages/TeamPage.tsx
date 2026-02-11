import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Copy, Check } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDateTime } from '@/utils/helpers';
import { toast } from 'sonner';
import type { User } from '@/types';

export function TeamPage() {
  const queryClient = useQueryClient();
  const { organization, user: currentUser } = useAuthStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', name: '', role: 'MEMBER', password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['organization-users', organization?.id],
    queryFn: () => api.getOrganizationUsers(organization!.id),
    enabled: !!organization,
  });

  const inviteMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {
        email: inviteData.email,
        name: inviteData.name,
        role: inviteData.role,
      };
      if (inviteData.password) {
        payload.password = inviteData.password;
      }
      return api.inviteUser(organization!.id, payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      if (!inviteData.password) {
        toast.success('User invited successfully (status: Invited)');
      } else {
        toast.success('User created successfully');
      }
      setShowInviteModal(false);
      setInviteData({ email: '', name: '', role: 'MEMBER', password: '' });
      setGeneratedPassword(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || error.message || 'Failed to create user');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeUser(organization!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      setDeleteConfirm(null);
      toast.success('User removed');
    },
    onError: () => {
      toast.error('Failed to remove user');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.updateUserRole(organization!.id, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      toast.success('Role updated');
    },
    onError: () => {
      toast.error('Failed to update role');
    },
  });

  const canManageUsers =
    currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  const roleOptions = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'MEMBER', label: 'Member' },
  ];

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let pw = '';
    for (let i = 0; i < 16; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(pw);
    setInviteData({ ...inviteData, password: pw });
  };

  const copyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Team"
        description="Manage your organization members"
        actions={
          canManageUsers && (
            <Button onClick={() => setShowInviteModal(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add Member
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Member</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Last Login</th>
                {canManageUsers && (
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users?.data?.map((user: User) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-700">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.name}
                          {user.id === currentUser?.id && (
                            <span className="text-gray-500 ml-2">(You)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManageUsers && user.role !== 'OWNER' && user.id !== currentUser?.id ? (
                      <Select
                        value={user.role}
                        onChange={(e) =>
                          updateRoleMutation.mutate({ userId: user.id, role: e.target.value })
                        }
                        options={roleOptions}
                        className="w-32"
                      />
                    ) : (
                      <Badge
                        className={
                          user.role === 'OWNER'
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'ADMIN'
                            ? 'bg-blue-100 text-blue-800'
                            : ''
                        }
                      >
                        {user.role}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="status" status={user.status || 'ACTIVE'}>
                      {user.status || 'ACTIVE'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                  </td>
                  {canManageUsers && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {user.role !== 'OWNER' && user.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(user.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setGeneratedPassword(null);
          setInviteData({ email: '', name: '', role: 'MEMBER', password: '' });
        }}
        title="Add Team Member"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="colleague@company.com"
            value={inviteData.email}
            onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
          />
          <Input
            label="Name"
            placeholder="John Doe"
            value={inviteData.name}
            onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
          />
          <Select
            label="Role"
            value={inviteData.role}
            onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
            options={roleOptions}
            hint="Admins can invite other members. Members cannot."
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">
                Password <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <Button variant="ghost" size="sm" onClick={generatePassword}>
                Generate
              </Button>
            </div>
            <Input
              type="text"
              placeholder="Leave empty to create as invited (no login yet)"
              value={inviteData.password}
              onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
            />
            {generatedPassword && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                <code className="flex-1 text-gray-700">{generatedPassword}</code>
                <Button variant="ghost" size="sm" onClick={copyPassword}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              If no password is set, the user will be created with &quot;Invited&quot; status and cannot log in until a password is set.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => {
              setShowInviteModal(false);
              setGeneratedPassword(null);
              setInviteData({ email: '', name: '', role: 'MEMBER', password: '' });
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              loading={inviteMutation.isPending}
              disabled={!inviteData.email || !inviteData.name}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {inviteData.password ? 'Create User' : 'Add as Invited'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Remove Team Member"
        size="sm"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to remove this member from the organization? They will lose access
          immediately.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={removeMutation.isPending}
            onClick={() => deleteConfirm && removeMutation.mutate(deleteConfirm)}
          >
            Remove Member
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
