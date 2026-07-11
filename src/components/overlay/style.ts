import type { CSSProperties } from 'react';
import type { Overlay } from '@/types';

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
