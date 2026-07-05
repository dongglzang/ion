/**
 * 트레잇 → 픽셀 사양.
 * ============================================
 *
 * 두 렌더러(PlanetAvatar = SVG, WorldPage = Canvas)가 같은 모양을 그리기
 * 위한 단일 출처. toRenderSpec(traits, seed, radius) 한 번 호출로 두 렌더러가
 * 소비할 수 있는 PlanetRenderSpec 객체를 만든다. 픽셀 좌표/색을 여기서
 * 결정하므로, 렌더러는 마지막 "어디에 그릴지"만 책임진다.
 *
 * ⚠️ v1 동결: 이 파일의 분포/좌표 로직은 DERIVATION_VERSION=1 의 일부다.
 *    변경하려면 v2 를 출시할 것.
 */

import {
  type PlanetTraits,
  type PatternType,
  type RingType,
  mulberry32,
} from './proceduralPlanets';

export interface GradientStop {
  offset: number;
  color: string;
}

export interface RingSpec {
  /** ring outer radius factor (1.4..1.8) — radius 와 곱한다 */
  rx: number;
  /** ring thickness factor (0.18..0.32) — radius 와 곱한다 */
  ry: number;
  /** -45..45 deg */
  tilt: number;
  /** hsla() */
  color: string;
  /** line width factor — radius 와 곱한다 */
  width: number;
}

export interface PatternDot {
  x: number;
  y: number;
  r: number;
  /** 미리 계산된 hsla() 색상. 렌더러는 이것만 소비. */
  color: string;
}

export interface PatternBand {
  y: number;
  thickness: number;
  /** 미리 계산된 hsla() 색상. 렌더러는 이것만 소비. */
  color: string;
}

export interface GlowSpec {
  color: string;
  size: number;
}

export interface PlanetRenderSpec {
  bodyGradient: { stops: GradientStop[]; cx: number; cy: number };
  ring: RingSpec | null;
  /** spots / craters / swirls 점 패턴. */
  dots: PatternDot[];
  /** 가로 줄무늬 (gas/ice bands 패턴). */
  bands: PatternBand[];
  glow: GlowSpec;
}

const RING_PRESETS: Record<Exclude<RingType, 'none'>, { rx: number; ry: number; width: number }> = {
  thin:   { rx: 1.7, ry: 0.20, width: 0.15 },
  thick:  { rx: 1.6, ry: 0.32, width: 0.22 },
  tilted: { rx: 1.8, ry: 0.26, width: 0.16 },
};

// v1 spec 동결: 트레잇 분포는 변경 금지. 단, ring color alpha 같은
// 미세 조정 (toRenderSpec 의 시각적 결정) 은 v2 출시 전까지 자유롭게.
const RING_ALPHA = 0.9;

function hsla(h: number, s: number, l: number, a: number = 1): string {
  return `hsla(${h}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${a})`;
}

/** 시드된 패턴: 같은 시드 + traits.pattern + traits.surfaceCount → 같은 좌표. */
function generateDots(
  traits: PlanetTraits,
  seed: number,
): PatternDot[] {
  if (traits.pattern === 'bands' || traits.pattern === 'plain') return [];
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const dots: PatternDot[] = [];
  const placement = patternPlacementRadius(traits.pattern);

  for (let i = 0; i < traits.surfaceCount; i++) {
    // Box-Muller 1-shot
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const x = clamp(g * 0.4, -placement, placement);

    const u3 = Math.max(rng(), 1e-9);
    const u4 = rng();
    const g2 = Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
    const y = clamp(g2 * 0.4, -placement, placement);

    if (x * x + y * y > placement * placement) {
      i--;
      continue;
    }

    const r = patternDotSize(traits.pattern, rng);
    const alpha = patternAlpha(traits.pattern, rng);
    const hueShift = (rng() - 0.5) * 100;
    const shiftedHue = (traits.hue + hueShift + 360) % 360;
    const color = hsla(shiftedHue, traits.saturation, Math.max(0.08, traits.lightness * 0.5), alpha);

    dots.push({ x, y, r, color });
  }
  return dots;
}

/**
 * bands 패턴의 가로 줄무늬. v1 분포상 bands 는 gas(70%) 또는 ice(50%) 에서
 * 출현 → 그 외 sizeClass 는 빈 배열. 줄 수와 두께는 시드 결정적.
 * 밝은 줄/어두운 줄 교차로 목성/토성 느낌. color 미리 계산.
 */
function generateBands(
  traits: PlanetTraits,
  seed: number,
): PatternBand[] {
  if (traits.pattern !== 'bands') return [];
  const count =
    traits.sizeClass === 'gas'
      ? 4 + Math.floor(((seed * 31) >>> 0) % 3)
      : traits.sizeClass === 'ice'
      ? 2 + Math.floor(((seed * 17) >>> 0) % 3)
      : 0;
  if (count === 0) return [];

  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const pad = 0.05;
  const ys: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5 + (rng() - 0.5) * 0.6) / count;
    const y = -1 + 2 * pad + t * 2 * (1 - pad);
    ys.push(y);
  }
  return ys.map((y, i) => {
    const thickness = 0.10 + rng() * 0.10;
    const alpha = 0.55 + rng() * 0.25;
    const hueShift = (i % 2 === 0 ? 1 : -1) * (20 + rng() * 40);
    const shiftedHue = (traits.hue + hueShift + 360) % 360;
    const bandLight = i % 2 === 0
      ? Math.min(0.92, traits.lightness * 1.35)
      : Math.max(0.1, traits.lightness * 0.4);
    const color = hsla(shiftedHue, traits.saturation, bandLight, alpha);
    return { y, thickness, color };
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function patternPlacementRadius(p: PatternType): number {
  switch (p) {
    case 'bands':
      return 0.95;
    case 'swirls':
      return 0.85;
    case 'spots':
      return 0.8;
    case 'craters':
      return 0.78;
    case 'plain':
    default:
      return 0;
  }
}
function patternDotSize(p: PatternType, rng: () => number): number {
  switch (p) {
    case 'spots':
      return 0.07 + rng() * 0.09;
    case 'craters':
      return 0.08 + rng() * 0.12;
    case 'swirls':
      return 0.06 + rng() * 0.08;
    default:
      return 0;
  }
}

function patternAlpha(p: PatternType, rng: () => number): number {
  switch (p) {
    case 'craters':
      return 0.35 + rng() * 0.2;
    case 'spots':
      return 0.4 + rng() * 0.25;
    case 'swirls':
      return 0.35 + rng() * 0.2;
    default:
      return 0;
  }
}

/** 핵심: traits + seed + radius → 두 렌더러가 공유하는 픽셀 사양. */
export function toRenderSpec(
  traits: PlanetTraits,
  seed: number,
  radius: number,
): PlanetRenderSpec {
  const { hue, saturation, lightness, ringType, ringTilt, glowIntensity } = traits;

  // 본체 radial gradient (35%, 35% 강조점)
  const bodyGradient = {
    cx: 0.35,
    cy: 0.35,
    stops: [
      { offset: 0, color: hsla(hue, saturation, Math.min(lightness + 0.2, 0.95), 1) },
      { offset: 0.5, color: hsla(hue, saturation, lightness, 1) },
      { offset: 1, color: hsla(hue, saturation * 0.8, lightness * 0.6, 1) },
    ],
  };

  // 고리
  let ring: RingSpec | null = null;
  if (ringType !== 'none') {
    const preset = RING_PRESETS[ringType];
    ring = {
      rx: preset.rx,
      ry: preset.ry,
      tilt: ringTilt,
      width: preset.width,
      color: hsla(hue, saturation * 0.6, Math.min(lightness * 1.1, 0.95), RING_ALPHA),
    };
  }

  // 패턴: dots (spots/craters/swirls) + bands (gas/ice)
  const dots = generateDots(traits, seed);
  const bands = generateBands(traits, seed);

  const glow: GlowSpec = {
    color: hsla(hue, saturation, lightness, 0.6),
    size: radius * (0.4 + glowIntensity * 0.6),
  };

  return { bodyGradient, ring, dots, bands, glow };
}
