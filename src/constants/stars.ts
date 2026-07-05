// ============================================
// 항성계(System) 시각 아이덴티티
// ============================================
// 유저 행성(PLANETS, 10종)과 시각적으로 분리된 성운/항성 팔레트.
// DB에는 palette: string[] (2~4 hex) 만 저장하고, 클라이언트에서
// gradient/glow 로 렌더링한다(임의 CSS 저장 X → XSS 방어).
// planets.ts 의 PlanetDef(gradient/glowColor) 패턴과 동일한 소비 방식.
// ============================================

export interface SystemVisual {
  /** CSS radial-gradient string — 인라인 style background 로 사용 */
  gradient: string;
  /** hex 색 — box-shadow 등에서 `${glow}40` 형태(8자리 hex = 알파)로 사용 */
  glow: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const FALLBACK: SystemVisual = {
  gradient: 'radial-gradient(circle at 35% 35%, #8B8FA3, #5A5F7A 60%, #3A3D52)',
  glow: '#5A5F7A',
};

/** palette(2~4 hex) → radial-gradient + glow. hex 검증 후 폴백. */
export function renderSystemVisual(palette: string[] | null | undefined): SystemVisual {
  if (!palette) return FALLBACK;
  const hexes = palette.filter((c) => HEX_RE.test(c));
  if (hexes.length < 2) return FALLBACK;
  const [inner, mid, outer] = hexes;
  return {
    gradient: `radial-gradient(circle at 35% 35%, ${inner}, ${mid} 60%, ${outer ?? mid})`,
    glow: inner,
  };
}

// ============================================
// 큐레이션된 성운/항성 프리셋 — 생성 모달 빠른 선택용
// ============================================
export interface NebulaPreset {
  id: string;
  nameKo: string;
  palette: string[];
}

export const NEBULA_PRESETS: NebulaPreset[] = [
  { id: 'aurora', nameKo: '오로라', palette: ['#7EF9C8', '#3AB0FF', '#5B5EEB'] },
  { id: 'ember',  nameKo: '잔불',   palette: ['#FF8A5C', '#FF4D6D', '#7A1E7A'] },
  { id: 'nebula', nameKo: '성운',   palette: ['#C77DFF', '#7B2CBF', '#240046'] },
  { id: 'solar',  nameKo: '태양',   palette: ['#FFE066', '#FF9F1C', '#E63946'] },
  { id: 'ice',    nameKo: '빙하',   palette: ['#CAF0F8', '#48CAE4', '#023E8A'] },
  { id: 'forest', nameKo: '심해',   palette: ['#95D5B2', '#52B788', '#1B4332'] },
  { id: 'rose',   nameKo: '장미',   palette: ['#FFAFCC', '#FF70A6', '#9D4EDD'] },
  { id: 'mono',   nameKo: '자유',   palette: ['#8B8FA3', '#5A5F7A', '#3A3D52'] },
  { id: 'dusk',   nameKo: '황혼',   palette: ['#FFB4A2', '#E5989B', '#6D6875'] },
  { id: 'volt',   nameKo: '전압',   palette: ['#D0FF00', '#00FFA3', '#00B4D8'] },
];
