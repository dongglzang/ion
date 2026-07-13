import { useState, useRef, useCallback } from 'react';
import { ImageCropperModal } from '@/components/ImageCropperModal';

interface CropResolver {
  resolve: (blob: Blob) => void;
  reject: (err: Error) => void;
}

export function useImageCropper() {
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const resolverRef = useRef<CropResolver | null>(null);

  const requestCrop = useCallback((file: File): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      resolverRef.current = { resolve, reject };
      setCropFile(file);
      setCropOpen(true);
    });
  }, []);

  const handleComplete = useCallback((blob: Blob) => {
    resolverRef.current?.resolve(blob);
    resolverRef.current = null;
    setCropOpen(false);
    setCropFile(null);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      if (resolverRef.current) {
        resolverRef.current.reject(new Error('cancelled'));
        resolverRef.current = null;
      }
      setCropOpen(false);
      setCropFile(null);
    }
  }, []);

  const CropModal = (
    <ImageCropperModal
      open={cropOpen}
      cropFile={cropFile}
      onOpenChange={handleOpenChange}
      onComplete={handleComplete}
    />
  );

  return { requestCrop, CropModal };
}
