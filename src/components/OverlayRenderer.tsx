import { useContainerSize } from '@/hooks/useContainerSize';
import { buildOverlayStyle } from '@/components/overlay/style';
import type { Overlay } from '@/types';

interface OverlayRendererProps {
  overlays: Overlay[];
  /** 컨테이너 클래스 오버라이드 (기본 absolute inset-0 pointer-events-none) */
  className?: string;
}

export function OverlayRenderer({ overlays, className }: OverlayRendererProps) {
  const [ref, { width }] = useContainerSize<HTMLDivElement>();

  return (
    <div ref={ref} className={className ?? 'absolute inset-0 pointer-events-none'}>
      {overlays.map((o) => (
        <div key={o.id} className="absolute" style={buildOverlayStyle(width, o)}>
          {o.text}
        </div>
      ))}
    </div>
  );
}
