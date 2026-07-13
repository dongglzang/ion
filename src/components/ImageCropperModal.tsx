import { lazy, Suspense } from 'react';

// 이미지 크롭 모달은 사용자가 이미지 선택 후에나 필요.
// lazy 청크로 분리해 초기 페인트 부담 감소.
const ImageCropModal = lazy(() =>
  import('@/components/ImageCropModal').then((m) => ({ default: m.ImageCropModal }))
);

interface ImageCropperModalProps {
  open: boolean;
  cropFile: File | null;
  onOpenChange: (open: boolean) => void;
  onComplete: (blob: Blob) => void;
}

/**
 * lazy 청크로 분리된 이미지 크롭 모달.
 * 모달이 보이는 동안에만 청크가 로드되며, fallback=null은
 * 모달이 닫힌 상태에서는 보이지 않으므로 자연스럽다.
 */
export function ImageCropperModal({ open, cropFile, onOpenChange, onComplete }: ImageCropperModalProps) {
  return (
    <Suspense fallback={null}>
      <ImageCropModal
        open={open}
        onOpenChange={onOpenChange}
        imageFile={cropFile}
        onCropComplete={onComplete}
      />
    </Suspense>
  );
}
