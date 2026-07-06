import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Overlay } from '@/types';

/**
 * 스토리식 텍스트 오버레이 렌더러 — 에디터(CreateStoryModal)와 뷰어(PostCard 등)가
 * 공유하는 단일 렌더 로직. 컨테이너 폭을 측정해 폰트 크기를 파생하므로
 * PostCard(작은 카드)·ExpandedCard(큰 모달) 어디서든 동일 비율로 렌더링된다.
 * (레거시 CollageOverlay 의 per-caller fontSize 하드코딩 함정 회피)
 *
 * 에디터/뷰어 드리프트 0 보장: 위치·transform·타이포·그림자는 buildOverlayStyle 에서
 * 단일 정의. 에디터는 여기에 인터랙티브 속성(outline/touchAction/cursor)만 합친다.
 */

/** 기준 폰트 비율: fontSize = containerWidth × BASE_RATIO × overlay.scale */
export const OVERLAY_BASE_RATIO = 0.05;

/** 에디터와 뷰어가 공유하는 폰트 크기 계산 — 드리프트 0 */
export function overlayFontSizePx(containerWidth: number, scale: number): number {
  return containerWidth * OVERLAY_BASE_RATIO * scale;
}

export const OVERLAY_FONT_FAMILY: Record<Overlay['family'], string> = {
  sans: 'var(--font-sans)',
  serif: "Georgia, 'Times New Roman', serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const OVERLAY_TEXT_SHADOW = '0 1px 3px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.3)';

/**
 * 오버레이 공통 스타일 — 위치·transform·폰트·타이포·그림자.
 * 에디터와 뷰어가 모두 이 함수를 사용한다. 여기에 인터랙티브 속성을 추가하지 말 것.
 */
export function buildOverlayStyle(containerWidth: number, o: Overlay): CSSProperties {
  return {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${o.rotation}deg)`,
    fontSize: containerWidth ? overlayFontSizePx(containerWidth, o.scale) : undefined,
    color: o.color,
    fontFamily: OVERLAY_FONT_FAMILY[o.family],
    fontWeight: o.weight,
    textAlign: o.align,
    lineHeight: 1.25,
    maxWidth: '92%',
    textShadow: OVERLAY_TEXT_SHADOW,
    wordBreak: 'keep-all',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  };
}

/** 컨테이너 크기 추적 — 폰트 파생에 필요. */
export function useContainerSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  { width: number; height: number },
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

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
