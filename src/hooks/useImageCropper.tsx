import { useState, useRef, useCallback, lazy, Suspense } from 'react';

// 이미지 크롭 모달은 사용자가 이미지 선택 후에나 필요.
// lazy 청크로 분리해 초기 페인트 부담 감소.
const ImageCropModal = lazy(() =>
  import('@/components/ImageCropModal').then((m) => ({ default: m.ImageCropModal }))
);

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

  // fallback=null — 모달은 open 상태에서만 보이므로 빈 fallback이
  // 시각적 깜빡임 없이 자연스러움. 첫 오픈 시 청크 fetch가 미세하게
  // 지연될 수 있으나 수십 ms 수준.
  const CropModal = (
    <Suspense fallback={null}>
      <ImageCropModal
        open={cropOpen}
        onOpenChange={handleOpenChange}
        imageFile={cropFile}
        onCropComplete={handleComplete}
      />
    </Suspense>
  );

  return { requestCrop, CropModal };
}
