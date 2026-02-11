import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface AuthImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function AuthImage({ src, alt, className, fallback }: AuthImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    fetch(src, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load image');
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, accessToken]);

  if (!src || error) {
    return <>{fallback || null}</>;
  }

  if (!blobUrl) {
    return (
      <div className={className + ' flex items-center justify-center bg-gray-100'}>
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}
