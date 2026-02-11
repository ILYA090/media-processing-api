import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Image,
  Music,
  FileText,
  Wand2,
  BarChart3,
  ArrowLeft,
  Loader2,
  Download,
  CheckCircle,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ActionForm } from '@/components/actions/ActionForm';
import { AuthImage } from '@/components/ui/AuthImage';
import { api } from '@/services/api';
import { formatBytes } from '@/utils/helpers';
import { toast } from 'sonner';
import type { MediaFile, Action, ProcessingJob } from '@/types';

const categoryIcons = {
  transcribe: FileText,
  modify: Wand2,
  process: BarChart3,
};

const categoryDescriptions = {
  transcribe: 'Extract text and information from your media',
  modify: 'Transform and edit your media file',
  process: 'Analyze without modifying the original',
};

function ResultDisplay({ data, actionId }: { data: Record<string, unknown>; actionId: string }) {
  // Extract text / OCR result
  if (actionId === 'img_ocr' && data.text) {
    return (
      <div className="text-left">
        <h4 className="text-sm font-medium text-gray-500 mb-2">Extracted Text</h4>
        <div className="bg-gray-50 rounded-lg p-4 border">
          <p className="text-gray-900 whitespace-pre-wrap">{String(data.text)}</p>
        </div>
        {data.language && data.language !== 'auto' && (
          <p className="text-xs text-gray-400 mt-2">Language: {String(data.language)}</p>
        )}
      </div>
    );
  }

  // Describe result
  if (actionId === 'img_describe' && data.description) {
    return (
      <div className="text-left">
        <h4 className="text-sm font-medium text-gray-500 mb-2">Image Description</h4>
        <div className="bg-gray-50 rounded-lg p-4 border">
          <p className="text-gray-900 whitespace-pre-wrap">{String(data.description)}</p>
        </div>
        {data.provider && (
          <p className="text-xs text-gray-400 mt-2">Provider: {String(data.provider)}</p>
        )}
      </div>
    );
  }

  // Analyze result
  if (actionId === 'img_analyze' && data.analysis) {
    const analysis = data.analysis as Record<string, unknown>;
    return (
      <div className="text-left">
        <h4 className="text-sm font-medium text-gray-500 mb-2">Image Analysis</h4>
        <div className="bg-gray-50 rounded-lg p-4 border">
          <p className="text-gray-900 whitespace-pre-wrap">{String(analysis.fullAnalysis || '')}</p>
        </div>
        {data.metadata && (
          <div className="mt-3">
            <h4 className="text-sm font-medium text-gray-500 mb-1">Image Info</h4>
            <div className="flex gap-4 text-sm text-gray-600">
              {(data.metadata as any).width && (
                <span>{(data.metadata as any).width} x {(data.metadata as any).height} px</span>
              )}
              {(data.metadata as any).format && (
                <span>Format: {String((data.metadata as any).format)}</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Transcription result
  if ((actionId === 'aud_transcribe' || actionId === 'aud_translate') && data.text) {
    return (
      <div className="text-left">
        <h4 className="text-sm font-medium text-gray-500 mb-2">
          {actionId === 'aud_translate' ? 'Translation' : 'Transcription'}
        </h4>
        <div className="bg-gray-50 rounded-lg p-4 border">
          <p className="text-gray-900 whitespace-pre-wrap">{String(data.text)}</p>
        </div>
        {data.language && (
          <p className="text-xs text-gray-400 mt-2">Language: {String(data.language)}</p>
        )}
      </div>
    );
  }

  // Fallback: raw JSON
  return (
    <div className="text-left">
      <h4 className="text-sm font-medium text-gray-500 mb-2">Result</h4>
      <div className="bg-gray-50 rounded-lg p-4 border">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export function ProcessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mediaId = searchParams.get('mediaId');

  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);

  // Fetch media details
  const { data: media, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', mediaId],
    queryFn: () => api.getMedia(mediaId!),
    enabled: !!mediaId,
  });

  // Fetch available actions for this media type
  const { data: actions } = useQuery({
    queryKey: ['actions', media?.mediaType?.toLowerCase()],
    queryFn: () => api.getActionsByMediaType(media!.mediaType.toLowerCase()),
    enabled: !!media,
  });

  // Poll job status
  const { data: jobStatus } = useQuery({
    queryKey: ['job', currentJob?.id],
    queryFn: () => api.getJob(currentJob!.id),
    enabled: !!currentJob && !['completed', 'failed', 'cancelled'].includes(currentJob.status),
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (jobStatus) {
      setCurrentJob(jobStatus);
    }
  }, [jobStatus]);

  // Submit processing job
  const submitMutation = useMutation({
    mutationFn: (data: { actionId: string; parameters: object }) =>
      api.submitJob({
        mediaId: mediaId!,
        actionId: data.actionId,
        parameters: data.parameters,
      }),
    onSuccess: (job) => {
      setCurrentJob(job);
      toast.success('Processing job submitted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to submit job');
    },
  });

  const handleActionSelect = (action: Action) => {
    setSelectedAction(action);
    setCurrentJob(null);
  };

  const handleSubmit = (parameters: object) => {
    if (!selectedAction) return;
    submitMutation.mutate({
      actionId: selectedAction.actionId,
      parameters,
    });
  };

  const handleDownloadResult = async () => {
    if (currentJob?.resultMediaId) {
      try {
        await api.downloadMedia(currentJob.resultMediaId, currentJob.resultData?.filename as string || 'result');
      } catch {
        toast.error('Failed to download result');
      }
    }
  };

  const groupedActions = actions?.reduce(
    (acc: Record<string, Action[]>, action: Action) => {
      if (!acc[action.category]) {
        acc[action.category] = [];
      }
      acc[action.category].push(action);
      return acc;
    },
    {}
  );

  if (!mediaId) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No media selected</p>
          <Button onClick={() => navigate('/media')}>Select from Library</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Process Media"
        description="Select an action to apply to your media"
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Media Preview */}
        <div className="col-span-1">
          <Card>
            {mediaLoading ? (
              <div className="aspect-square flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : media ? (
              <>
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                  {media.mediaType === 'image' ? (
                    <AuthImage
                      src={media.thumbnailUrl}
                      alt={media.originalFilename}
                      className="w-full h-full object-contain"
                      fallback={<div className="w-full h-full flex items-center justify-center"><Image className="w-16 h-16 text-gray-400" /></div>}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-gray-900 truncate">{media.originalFilename}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Badge>{media.mediaType}</Badge>
                    <span>{formatBytes(media.fileSizeBytes)}</span>
                  </div>
                  {media.mediaType === 'image' && media.metadata && (
                    <p className="text-sm text-gray-500">
                      {(media.metadata as any).width} x {(media.metadata as any).height} px
                    </p>
                  )}
                  {media.mediaType === 'audio' && media.metadata && (
                    <p className="text-sm text-gray-500">
                      Duration:{' '}
                      {Math.floor((media.metadata as any).durationSeconds / 60)}:
                      {String(Math.floor((media.metadata as any).durationSeconds % 60)).padStart(2, '0')}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-500">Media not found</p>
            )}
          </Card>
        </div>

        {/* Right: Actions / Form / Result */}
        <div className="col-span-2">
          {!selectedAction ? (
            // Action Selection
            <Tabs defaultValue="transcribe">
              <TabsList>
                {['transcribe', 'modify', 'process'].map((category) => {
                  const Icon = categoryIcons[category as keyof typeof categoryIcons];
                  return (
                    <TabsTrigger key={category} value={category}>
                      <Icon className="w-4 h-4 mr-2" />
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {['transcribe', 'modify', 'process'].map((category) => (
                <TabsContent key={category} value={category}>
                  <Card>
                    <p className="text-gray-500 mb-4">
                      {categoryDescriptions[category as keyof typeof categoryDescriptions]}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {groupedActions?.[category]?.map((action: Action) => (
                        <button
                          key={action.actionId}
                          onClick={() => handleActionSelect(action)}
                          className="flex items-start gap-3 p-4 border rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
                        >
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {category === 'transcribe' && <FileText className="w-5 h-5 text-gray-600" />}
                            {category === 'modify' && <Wand2 className="w-5 h-5 text-gray-600" />}
                            {category === 'process' && <BarChart3 className="w-5 h-5 text-gray-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{action.buttonLabel}</p>
                            <p className="text-sm text-gray-500">{action.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          ) : currentJob ? (
            // Job Status / Result
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <CardTitle>{selectedAction.displayName}</CardTitle>
                  <CardDescription>{selectedAction.description}</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedAction(null)}>
                  Choose Different Action
                </Button>
              </div>

              {/* Job Status */}
              <div className="border rounded-lg p-6">
                {currentJob.status === 'completed' ? (
                  <div>
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Processing Complete!</h3>
                      <p className="text-sm text-gray-500">
                        Completed in {((currentJob.processingTimeMs || 0) / 1000).toFixed(1)}s
                      </p>
                    </div>

                    {/* File Result Display */}
                    {currentJob.resultType === 'FILE' && currentJob.resultMediaId && (
                      <div className="space-y-4">
                        {/* Result image preview */}
                        {media?.mediaType === 'image' && (
                          <div className="max-w-md mx-auto bg-gray-100 rounded-lg overflow-hidden">
                            <AuthImage
                              src={`/api/v1/media/${currentJob.resultMediaId}/download`}
                              alt="Result"
                              className="w-full h-auto object-contain max-h-80"
                              fallback={<div className="p-8 text-center text-gray-400">Preview unavailable</div>}
                            />
                          </div>
                        )}
                        {/* Result info */}
                        {currentJob.resultData && (
                          <div className="flex justify-center gap-4 text-sm text-gray-500">
                            {(currentJob.resultData as any).width && (
                              <span>{(currentJob.resultData as any).width} x {(currentJob.resultData as any).height} px</span>
                            )}
                            {(currentJob.resultData as any).format && (
                              <span>Format: {String((currentJob.resultData as any).format)}</span>
                            )}
                          </div>
                        )}
                        {/* Action buttons */}
                        <div className="flex justify-center gap-3">
                          <Button onClick={handleDownloadResult}>
                            <Download className="w-4 h-4 mr-2" /> Download Result
                          </Button>
                          <Button variant="outline" onClick={() => navigate('/media')}>
                            View in Library
                          </Button>
                        </div>
                      </div>
                    )}

                    {currentJob.resultType === 'JSON' && currentJob.resultData && (
                      <ResultDisplay data={currentJob.resultData} actionId={currentJob.actionId} />
                    )}
                  </div>
                ) : currentJob.status === 'failed' ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">!</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Failed</h3>
                    <p className="text-red-600 mb-4">{currentJob.errorMessage}</p>
                    <Button onClick={() => setCurrentJob(null)}>Try Again</Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing...</h3>
                    <p className="text-gray-500">
                      Status: <Badge variant="status" status={currentJob.status}>{currentJob.status}</Badge>
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            // Action Form
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <CardTitle>{selectedAction.displayName}</CardTitle>
                  <CardDescription>{selectedAction.description}</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedAction(null)}>
                  Back to Actions
                </Button>
              </div>

              <ActionForm
                action={selectedAction}
                onSubmit={handleSubmit}
                isLoading={submitMutation.isPending}
              />
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
