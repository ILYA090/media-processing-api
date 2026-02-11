import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Copy, Trash2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/services/api';
import { formatDateTime } from '@/utils/helpers';
import { toast } from 'sonner';
import type { ApiKey } from '@/types';

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createApiKey({ name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKey(data.key);
      setNewKeyName('');
      toast.success('API key created');
    },
    onError: () => {
      toast.error('Failed to create API key');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Failed to revoke API key');
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => api.rotateApiKey(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKey(data.key);
      toast.success('API key rotated');
    },
    onError: () => {
      toast.error('Failed to rotate API key');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    createMutation.mutate(newKeyName);
  };

  return (
    <Layout>
      <PageHeader
        title="API Keys"
        description="Manage your API keys for programmatic access"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Key
          </Button>
        }
      />

      {/* API Keys List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : apiKeys?.data?.length === 0 ? (
        <Card className="text-center py-12">
          <Key className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No API keys yet</p>
          <Button onClick={() => setShowCreateModal(true)}>
            Create your first API key
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys?.data?.map((key: ApiKey) => (
            <Card key={key.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Key className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{key.name}</h3>
                      <Badge variant="status" status={key.status}>
                        {key.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 font-mono mt-1">
                      {key.keyPrefix}••••••••••••••••
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>Created: {formatDateTime(key.createdAt)}</span>
                      {key.lastUsedAt && (
                        <span>Last used: {formatDateTime(key.lastUsedAt)}</span>
                      )}
                      {key.expiresAt && (
                        <span>Expires: {formatDateTime(key.expiresAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rotateMutation.mutate(key.id)}
                    disabled={key.status !== 'ACTIVE'}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" /> Rotate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteConfirm(key.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {/* Rate Limits */}
              <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Requests/min</p>
                  <p className="text-sm font-medium">{key.rateLimits.requestsPerMinute}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Requests/day</p>
                  <p className="text-sm font-medium">{key.rateLimits.requestsPerDay}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Concurrent jobs</p>
                  <p className="text-sm font-medium">{key.rateLimits.maxConcurrentJobs}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Max file size</p>
                  <p className="text-sm font-medium">{key.rateLimits.maxFileSizeMb} MB</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Key Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewKeyName('');
          setCreatedKey(null);
        }}
        title={createdKey ? 'API Key Created' : 'Create API Key'}
        size="md"
      >
        {createdKey ? (
          <div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                Make sure to copy your API key now. You won't be able to see it again!
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <code className="flex-1 text-sm font-mono break-all">{createdKey}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(createdKey)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-end mt-6">
              <Button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreatedKey(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Input
              label="Key Name"
              placeholder="e.g., Production API Key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              hint="Give your key a descriptive name"
            />
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateKey} loading={createMutation.isPending}>
                Create Key
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Revoke API Key"
        size="sm"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to revoke this API key? Any applications using this key will
          immediately lose access.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
          >
            Revoke Key
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
