/**
 * Supabase Storage image transform helpers.
 *
 * Supabase는 두 endpoint를 제공:
 *   - /storage/v1/object/public/...  → 원본 (transform 무시)
 *   - /storage/v1/render/image/public/... → transform 적용 (?width=N&quality=Q)
 *
 * getPublicUrl()은 /object/ URL을 반환하므로 transform을 쓰려면 path를
 * 재작성해야 함. 안 그러면 ?width=160이 silent no-op → full-res 4장 받음
 * (오히려 4× 안 좋아짐).
 *
 * 검증 (2026-07-10):
 *   원본 58879 bytes → w=160: 13483 (77%↓) / w=320: 22478 / w=640: 39574
 */

const OBJECT_BASE = '/storage/v1/object/public/';
const RENDER_BASE = '/storage/v1/render/image/public/';

export interface SrcSetOptions {
  /** device pixel ratio를 적용한 px 너비 배열. 예: [160, 320, 640] */
  widths: number[];
  /** 1-100. 기본 75 — 모바일에서 화질/용량 균형. */
  quality?: number;
  /** 'origin' = 원본 포맷, 'webp' = webp 변환. 기본 'origin' (브라우저 부담 적음). */
  format?: 'origin' | 'webp';
}

function toRenderUrl(publicUrl: string): string {
  if (!publicUrl) return publicUrl;
  // /object/ → /render/image/public/ 한 번만 치환 (이미 render URL이면 그대로)
  const idx = publicUrl.indexOf(OBJECT_BASE);
  if (idx === -1) return publicUrl;
  return publicUrl.slice(0, idx) + RENDER_BASE + publicUrl.slice(idx + OBJECT_BASE.length);
}

function transformQuery(width: number, quality: number, format: 'origin' | 'webp'): string {
  const parts = [`width=${width}`, `quality=${quality}`];
  if (format === 'webp') parts.push('format=webp');
  return parts.join('&');
}

/**
 * srcset 문자열 생성.
 *
 * @example
 *   imageSrcSet(post.media, { widths: [160, 320, 640] })
 *   // "https://...render/image/public/media/abc.jpg?width=160&quality=75 160w, ..."
 */
export function imageSrcSet(url: string, opts: SrcSetOptions): string {
  if (!url) return '';
  const target = toRenderUrl(url);
  const quality = opts.quality ?? 75;
  const format = opts.format ?? 'origin';
  const sep = target.includes('?') ? '&' : '?';
  return opts.widths
    .map((w) => `${target}${sep}${transformQuery(w, quality, format)} ${w}w`)
    .join(', ');
}

/**
 * sizes attribute 생성. 호출처에서 viewport-relative 계산.
 *
 * @example
 *   sizes={sizesAttr(getDynamicCardSize(width, zoom) * dpr)}
 */
export function sizesAttr(maxWidth: number): string {
  return `${maxWidth}px`;
}

/**
 * 단일 transform URL (fallback용 — srcset 미지원 환경).
 */
export function transformUrl(
  url: string,
  width: number,
  quality: number = 75,
  format: 'origin' | 'webp' = 'origin',
): string {
  if (!url) return url;
  const target = toRenderUrl(url);
  const sep = target.includes('?') ? '&' : '?';
  return `${target}${sep}${transformQuery(width, quality, format)}`;
}
