/**
 * 프로시저럴 행성 (NFT-스타일 결정성 도출)
 * ============================================
 *
 * 모델:
 *   profiles.planet_seed (uint32) ──→  PlanetTraits
 *                                       │
 *                                       └─→ toRenderSpec (constants/proceduralPlanetRender)
 *                                              │
 *                                              ├─→ PlanetAvatar (CSS+SVG)
 *                                              └─→ WorldPage.drawPlanet (Canvas)
 *
 * 시간 축 결정성 (v1 동결 규약):
 *   - DERIVATION_VERSION = 1 의 트레잇 분포, 색 범위, 패턴 분포, 이름 사전은
 *     출시 후 절대 변경 금지.
 *   - 비주얼 변형이 필요해지면 v2 를 출시하고 profiles.planet_seed_v2 컬럼을
 *     추가한다. v1 분포와 v1 컬럼은 영구 호환을 위해 그대로 남는다.
 *   - 같은 시드 → 같은 트레잇 → 같은 모양. 디바이스/시각/렌더러 무관.
 */

export const DERIVATION_VERSION = 1 as const;
export const SEED_MAX = 0xffffffff; // uint32
export type SupportedVersion = 1;

export type SizeClass = 'rocky' | 'gas' | 'ice';
export type RingType = 'none' | 'thin' | 'thick' | 'tilted';
export type PatternType = 'plain' | 'bands' | 'spots' | 'craters' | 'swirls';

export interface PlanetTraits {
  /** 0..360 */
  hue: number;
  /** 0..1 */
  saturation: number;
  /** 0..1 */
  lightness: number;
  ringType: RingType;
  /** -45..45 deg, ringType !== 'none' 일 때만 의미 있음 */
  ringTilt: number;
  pattern: PatternType;
  surfaceCount: number;
  /** 0..1 */
  glowIntensity: number;
  sizeClass: SizeClass;
}

/** 결정적 PRNG (mulberry32). 같은 시드 → 같은 수열. */
export function mulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function pickPattern(sizeClass: SizeClass, rng: () => number): PatternType {
  // 가스형은 띠/소용돌이 위주, 암석은 점/크레이터, 빙성은 무늬 적게
  if (sizeClass === 'gas') {
    return rng() < 0.7 ? pick<'bands' | 'swirls'>(['bands', 'swirls'], rng) : 'plain';
  }
  if (sizeClass === 'ice') {
    return rng() < 0.5 ? 'bands' : 'plain';
  }
  const r = rng();
  if (r < 0.4) return 'spots';
  if (r < 0.7) return 'craters';
  if (r < 0.9) return 'swirls';
  return 'plain';
}

/** v1 트레잇 도출. version !== 1 이면 즉시 실패 (시간 축 결정성 보호). */
export function derivePlanetTraits(
  seed: number,
  version: number = DERIVATION_VERSION,
): PlanetTraits {
  if (version !== 1) {
    throw new Error(
      `Unsupported derivation version: ${version}. ` +
        `See DERIVATION_VERSION in constants/proceduralPlanets.ts.`,
    );
  }
  const rng = mulberry32(seed >>> 0);

  // sizeClass: rocky 50% / gas 35% / ice 15%
  let sizeClass: SizeClass;
  {
    const r = rng();
    sizeClass = r < 0.5 ? 'rocky' : r < 0.85 ? 'gas' : 'ice';
  }

  // 고리: 가스 70%, 암석 15%, 빙성 40%
  const ringChance = sizeClass === 'gas' ? 0.7 : sizeClass === 'rocky' ? 0.15 : 0.4;
  let ringType: RingType;
  if (rng() < ringChance) {
    ringType = pick<Exclude<RingType, 'none'>>(['thin', 'thick', 'tilted'], rng);
  } else {
    ringType = 'none';
  }

  return {
    hue: rng() * 360,
    saturation: 0.35 + rng() * 0.5,
    lightness: 0.25 + rng() * 0.5,
    ringType,
    ringTilt: ringType !== 'none' ? (rng() - 0.5) * 90 : 0,
    pattern: pickPattern(sizeClass, rng),
    surfaceCount: 3 + Math.floor(rng() * 12),
    glowIntensity: 0.4 + rng() * 0.6,
    sizeClass,
  };
}

/** crypto 기반 uint32 시드 생성. */
export function generateRandomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! >>> 0;
}

/**
 * cyrb53 — 53-bit 해시. uuid 등 가변 길이 문자열을 uint32 결정적 시드로.
 * 같은 입력 → 같은 출력 (모든 디바이스/세션/뷰어에서 동일).
 */
function cyrb53(s: string, seed: number = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // 53-bit XOR → uint32 로 마스킹
  return (h1 ^ h2) >>> 0;
}

/** 사용자 id (UUID) → 결정적 uint32 시드. */
export function userIdToSeed(userId: string): number {
  return cyrb53(userId, 0) >>> 0;
}

/**
 * DB 값 (number | string | null | undefined) → 정규화된 uint32 시드.
 *
 * 결정성 규약 (across-viewers + across-time):
 *   1. 명시적 시드 (DB planet_seed) → 그대로 uint32. 모든 뷰어 동일.
 *   2. NULL/무효 → fallbackKey 해시. fallbackKey 는 작성자의 userId.
 *      모든 뷰어가 같은 작성자에 대해 같은 시드를 도출 → 깜빡임 없음.
 *   3. fallbackKey 도 없으면 generateRandomSeed() 1회성.
 *      (실제로는 DB NOT NULL + 트리거 백필로 이 경로는 dead code.)
 *
 * 절대 per-render random 으로 NULL 을 채우지 않는다 — 이건
 * "내 행성" 정체성을 매 리프레시마다 흔드는 ship-breaking 버그.
 */
export function resolveSeed(
  value: number | string | null | undefined,
  fallbackKey?: string,
): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value >>> 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0 && /^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isFinite(n) && n >= 0 && n <= SEED_MAX) return n >>> 0;
    }
  }
  if (fallbackKey && fallbackKey.length > 0) {
    return userIdToSeed(fallbackKey);
  }
  return generateRandomSeed();
}

/** 시드의 짧은 16진수 표현. 아바타 alt / 디버깅용. */
export function seedToHex(seed: number): string {
  return (seed >>> 0).toString(16).padStart(8, '0');
}
