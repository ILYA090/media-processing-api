import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Image, Music, Trash2, Download, Zap, Search, Grid, List } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { AuthImage } from '@/components/ui/AuthImage';
import { api } from '@/services/api';
import { formatBytes, formatDateTime, truncateFilename } from '@/utils/helpers';
import { toast } from 'sonner';
import type { MediaFile } from '@/types';

export function MediaLibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: mediaList, isLoading } = useQuery({
    queryKey: ['media', mediaTypeFilter],
    queryFn: () =>
      api.getMediaList({
        mediaType: mediaTypeFilter === 'all' ? undefined : mediaTypeFilter,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Media deleted successfully');
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Failed to delete media');
    },
  });

  const filteredMedia = mediaList?.data?.filter((media: MediaFile) =>
    media.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProcess = (mediaId: string) => {
    navigate(`/process?mediaId=${mediaId}`);
  };

  const handleDownload = async (mediaId: string) => {
    const media = filteredMedia?.find((m: MediaFile) => m.id === mediaId);
    try {
      await api.downloadMedia(mediaId, media?.originalFilename || 'download');
    } catch {
      toast.error('Failed to download file');
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Media Library"
        description="Browse and manage your uploaded files"
        actions={
          <Button onClick={() => navigate('/upload')}>
            Upload New
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={mediaTypeFilter}
            onChange={(e) => setMediaTypeFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'image', label: 'Images' },
              { value: 'audio', label: 'Audio' },
            ]}
            className="w-40"
          />
          <div className="flex border rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Media Grid/List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredMedia?.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">No media files found</p>
          <Button onClick={() => navigate('/upload')} className="mt-4">
            Upload your first file
          </Button>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-4 gap-4">
          {filteredMedia?.map((media: MediaFile) => (
            <Card
              key={media.id}
              padding="none"
              className="overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedMedia(media)}
            >
              <div className="aspect-square bg-gray-100 relative">
                {media.mediaType === 'image' ? (
                  <AuthImage
                    src={media.thumbnailUrl}
                    alt={media.originalFilename}
                    className="w-full h-full object-cover"
                    fallback={<div className="w-full h-full flex items-center justify-center"><Image className="w-12 h-12 text-gray-400" /></div>}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProcess(media.id);
                    }}
                  >
                    <Zap className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(media.id);
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {media.originalFilename}
                </p>
                <p className="text-xs text-gray-500">{formatBytes(media.fileSizeBytes)}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">File</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Size</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Uploaded</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMedia?.map((media: MediaFile) => (
                <tr key={media.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                        {media.mediaType === 'image' ? (
                          <Image className="w-5 h-5 text-gray-500" />
                        ) : (
                          <Music className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <span className="text-sm text-gray-900">
                        {truncateFilename(media.originalFilename, 40)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{media.mimeType}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatBytes(media.fileSizeBytes)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="status" status={media.status}>
                      {media.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(media.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleProcess(media.id)}
                      >
                        <Zap className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(media.id)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(media.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Media Details Modal */}
      <Modal
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        title="Media Details"
        size="lg"
      >
        {selectedMedia && (
          <div className="grid grid-cols-2 gap-6">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
              {selectedMedia.mediaType === 'image' ? (
                <AuthImage
                  src={selectedMedia.thumbnailUrl}
                  alt={selectedMedia.originalFilename}
                  className="w-full h-full object-contain"
                  fallback={<div className="w-full h-full flex items-center justify-center"><Image className="w-16 h-16 text-gray-400" /></div>}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-16 h-16 text-gray-400" />
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Filename</p>
                <p className="font-medium">{selectedMedia.originalFilename}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium">{selectedMedia.mimeType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Size</p>
                <p className="font-medium">{formatBytes(selectedMedia.fileSizeBytes)}</p>
              </div>
              {selectedMedia.mediaType === 'image' && selectedMedia.metadata && (
                <div>
                  <p className="text-sm text-gray-500">Dimensions</p>
                  <p className="font-medium">
                    {(selectedMedia.metadata as any).width} x {(selectedMedia.metadata as any).height}
                  </p>
                </div>
              )}
              {selectedMedia.mediaType === 'audio' && selectedMedia.metadata && (
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium">
                    {Math.floor((selectedMedia.metadata as any).durationSeconds / 60)}:
                    {String(Math.floor((selectedMedia.metadata as any).durationSeconds % 60)).padStart(2, '0')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Uploaded</p>
                <p className="font-medium">{formatDateTime(selectedMedia.createdAt)}</p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => handleProcess(selectedMedia.id)} className="flex-1">
                  <Zap className="w-4 h-4 mr-2" /> Process
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownload(selectedMedia.id)}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setSelectedMedia(null);
                    setDeleteConfirm(selectedMedia.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Media"
        size="sm"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this file? This action cannot be undone.
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
            Delete
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
