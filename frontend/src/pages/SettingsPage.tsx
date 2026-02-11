import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Building2, Bell, Shield, Trash2, Brain, Eye, EyeOff, Check, X } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { organization, setOrganization, aiSettings, setAiSettings } = useAuthStore();

  const [orgName, setOrgName] = useState(organization?.name || '');
  const [webhookUrl, setWebhookUrl] = useState(organization?.settings?.webhookUrl || '');

  // AI Provider state
  const [defaultProvider, setDefaultProvider] = useState(aiSettings?.defaultProvider || 'anthropic');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  const aiSettingsMutation = useMutation({
    mutationFn: (data: { defaultProvider?: string; anthropicApiKey?: string; openaiApiKey?: string }) =>
      api.updateAiSettings(data),
    onSuccess: (data) => {
      setAiSettings({
        defaultProvider: data.defaultProvider,
        hasAnthropicKey: data.hasAnthropicKey,
        hasOpenaiKey: data.hasOpenaiKey,
        anthropicKeyMasked: data.anthropicKeyMasked,
        openaiKeyMasked: data.openaiKeyMasked,
      });
      setAnthropicKey('');
      setOpenaiKey('');
      toast.success('AI settings saved');
    },
    onError: () => {
      toast.error('Failed to save AI settings');
    },
  });

  const handleSaveAiSettings = () => {
    const payload: { defaultProvider?: string; anthropicApiKey?: string; openaiApiKey?: string } = {
      defaultProvider,
    };
    if (anthropicKey) payload.anthropicApiKey = anthropicKey;
    if (openaiKey) payload.openaiApiKey = openaiKey;
    aiSettingsMutation.mutate(payload);
  };

  const handleClearAnthropicKey = () => {
    aiSettingsMutation.mutate({ anthropicApiKey: '' });
  };

  const handleClearOpenaiKey = () => {
    aiSettingsMutation.mutate({ openaiApiKey: '' });
  };

  const updateOrgMutation = useMutation({
    mutationFn: (data: { name?: string; settings?: object }) =>
      api.updateOrganization(organization!.id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      setOrganization(data);
      toast.success('Settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  const handleSaveGeneral = () => {
    updateOrgMutation.mutate({ name: orgName });
  };

  const handleSaveWebhook = () => {
    updateOrgMutation.mutate({
      settings: {
        ...organization?.settings,
        webhookUrl,
      },
    });
  };

  return (
    <Layout>
      <PageHeader title="Settings" description="Manage your organization settings" />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <Building2 className="w-4 h-4 mr-2" /> General
          </TabsTrigger>
          <TabsTrigger value="ai-providers">
            <Brain className="w-4 h-4 mr-2" /> AI Providers
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Bell className="w-4 h-4 mr-2" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="limits">
            <Shield className="w-4 h-4 mr-2" /> Limits
          </TabsTrigger>
          <TabsTrigger value="danger">
            <Trash2 className="w-4 h-4 mr-2" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Basic information about your organization</CardDescription>

            <div className="mt-6 space-y-4 max-w-md">
              <Input
                label="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <Input label="Organization Slug" value={organization?.slug} disabled />
              <Input label="Primary Email" value={organization?.email} disabled />

              <Button onClick={handleSaveGeneral} loading={updateOrgMutation.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* AI Providers */}
        <TabsContent value="ai-providers">
          <Card>
            <CardTitle>AI Provider Configuration</CardTitle>
            <CardDescription>
              Add your API keys to use AI-powered features like OCR, image description, and analysis.
              You need at least one API key configured.
            </CardDescription>

            <div className="mt-6 space-y-6 max-w-lg">
              {/* Default Provider */}
              <Select
                label="Default AI Provider"
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value as 'anthropic' | 'openai')}
                options={[
                  { value: 'anthropic', label: 'Anthropic (Claude)' },
                  { value: 'openai', label: 'OpenAI (ChatGPT)' },
                ]}
                hint="This provider will be used by default for AI actions"
              />

              {/* Anthropic Key */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Anthropic API Key
                  </label>
                  {aiSettings?.hasAnthropicKey ? (
                    <Badge className="bg-green-100 text-green-800">Configured</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500">Not Set</Badge>
                  )}
                </div>
                {aiSettings?.hasAnthropicKey && aiSettings.anthropicKeyMasked && (
                  <p className="text-xs text-gray-400">{aiSettings.anthropicKeyMasked}</p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showAnthropicKey ? 'text' : 'password'}
                      placeholder={aiSettings?.hasAnthropicKey ? 'Enter new key to replace' : 'sk-ant-...'}
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {aiSettings?.hasAnthropicKey && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAnthropicKey}
                      className="text-red-600 hover:text-red-700 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* OpenAI Key */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    OpenAI API Key
                  </label>
                  {aiSettings?.hasOpenaiKey ? (
                    <Badge className="bg-green-100 text-green-800">Configured</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500">Not Set</Badge>
                  )}
                </div>
                {aiSettings?.hasOpenaiKey && aiSettings.openaiKeyMasked && (
                  <p className="text-xs text-gray-400">{aiSettings.openaiKeyMasked}</p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showOpenaiKey ? 'text' : 'password'}
                      placeholder={aiSettings?.hasOpenaiKey ? 'Enter new key to replace' : 'sk-...'}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {aiSettings?.hasOpenaiKey && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearOpenaiKey}
                      className="text-red-600 hover:text-red-700 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Your API keys are encrypted and stored securely. They are never exposed in API responses.
                  You need at least one key to use AI-powered features (OCR, Describe, Analyze).
                </p>
              </div>

              <Button onClick={handleSaveAiSettings} loading={aiSettingsMutation.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save AI Settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Webhook Settings */}
        <TabsContent value="webhooks">
          <Card>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              Receive notifications when jobs complete or fail
            </CardDescription>

            <div className="mt-6 space-y-4 max-w-xl">
              <Input
                label="Webhook URL"
                placeholder="https://your-server.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                hint="We'll send POST requests to this URL when events occur"
              />

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Supported Events</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <code>job.completed</code> - Processing job finished successfully</li>
                  <li>• <code>job.failed</code> - Processing job failed</li>
                  <li>• <code>quota.warning</code> - Approaching quota limit</li>
                  <li>• <code>quota.exceeded</code> - Quota limit reached</li>
                </ul>
              </div>

              <Button onClick={handleSaveWebhook} loading={updateOrgMutation.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save Webhook
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Limits */}
        <TabsContent value="limits">
          <Card>
            <CardTitle>Organization Limits</CardTitle>
            <CardDescription>Current limits for your organization</CardDescription>

            <div className="mt-6 grid grid-cols-2 gap-6 max-w-2xl">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Max File Size</p>
                <p className="text-xl font-semibold">
                  {organization?.settings?.maxFileSizeMb || 50} MB
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Storage Limit</p>
                <p className="text-xl font-semibold">
                  {organization?.settings?.maxStorageGb || 10} GB
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Requests per Day</p>
                <p className="text-xl font-semibold">
                  {organization?.settings?.requestsPerDay?.toLocaleString() || '10,000'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Concurrent Jobs</p>
                <p className="text-xl font-semibold">
                  {organization?.settings?.concurrentJobs || 10}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">File Retention</p>
                <p className="text-xl font-semibold">
                  {organization?.settings?.retentionDays || 30} days
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Max Users</p>
                <p className="text-xl font-semibold">
                  {organization?.settings?.maxUsers || 'Unlimited'}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mt-6">
              Contact support to adjust these limits.
            </p>
          </Card>
        </TabsContent>

        {/* Danger Zone */}
        <TabsContent value="danger">
          <Card className="border-red-200">
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Delete All Media</p>
                  <p className="text-sm text-gray-500">
                    Permanently delete all uploaded media files
                  </p>
                </div>
                <Button variant="danger" size="sm">
                  Delete All Media
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Delete Organization</p>
                  <p className="text-sm text-gray-500">
                    Permanently delete this organization and all data
                  </p>
                </div>
                <Button variant="danger" size="sm">
                  Delete Organization
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
