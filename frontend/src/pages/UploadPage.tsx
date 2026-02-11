import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileImage, FileAudio, Link as LinkIcon } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { api } from '@/services/api';
import { formatBytes } from '@/utils/helpers';
import { toast } from 'sonner';

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  mediaId?: string;
}

export function UploadPage() {
  const navigate = useNavigate();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newFiles]);

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const fileIndex = uploadingFiles.length + i;

      try {
        const result = await api.uploadMedia(file, (progress) => {
          setUploadingFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex ? { ...f, progress } : f
            )
          );
        });

        setUploadingFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex
              ? { ...f, status: 'completed', progress: 100, mediaId: result.id }
              : f
          )
        );

        toast.success(`${file.name} uploaded successfully`);
      } catch (error: any) {
        setUploadingFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex
              ? { ...f, status: 'error', error: error.message || 'Upload failed' }
              : f
          )
        );
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  }, [uploadingFiles.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'],
      'audio/*': ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.webm'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return;

    setUrlLoading(true);
    try {
      const urlResult = await api.uploadMediaFromUrl(urlInput);
      toast.success('File uploaded from URL successfully');
      setUrlInput('');
      navigate('/media');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to upload from URL');
    } finally {
      setUrlLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const goToLibrary = () => {
    navigate('/media');
  };

  return (
    <Layout>
      <PageHeader
        title="Upload Media"
        description="Upload images or audio files to process"
      />

      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file">File Upload</TabsTrigger>
          <TabsTrigger value="url">From URL</TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <Card padding="lg">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-gray-100 rounded-full">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
              </div>
              <p className="text-lg font-medium text-gray-900 mb-1">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="text-gray-500 mb-4">or click to browse</p>
              <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4" />
                  <span>Images (JPG, PNG, WebP, GIF)</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4" />
                  <span>Audio (MP3, WAV, FLAC, OGG)</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Maximum file size: 100MB</p>
            </div>

            {/* Upload Progress */}
            {uploadingFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-medium text-gray-900">Uploads</h3>
                {uploadingFiles.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                      {item.file.type.startsWith('image/') ? (
                        <FileImage className="w-5 h-5 text-gray-600" />
                      ) : (
                        <FileAudio className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-gray-500">{formatBytes(item.file.size)}</p>
                      {item.status === 'uploading' && (
                        <Progress value={item.progress} size="sm" className="mt-2" />
                      )}
                      {item.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">{item.error}</p>
                      )}
                    </div>
                    {item.status === 'completed' && (
                      <Button size="sm" onClick={goToLibrary}>
                        View in Library
                      </Button>
                    )}
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="url">
          <Card padding="lg">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <LinkIcon className="w-5 h-5 text-gray-400" />
                <h3 className="font-medium text-gray-900">Upload from URL</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Enter the URL of an image or audio file to upload
              </p>
              <div className="flex gap-3">
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleUrlUpload} loading={urlLoading}>
                  Upload
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
