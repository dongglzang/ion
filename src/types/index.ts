import type { PlanetKey } from '@/constants/planets';

/**
 * 스토리식 텍스트 오버레이 단위 요소.
 * 에디터(CreateStoryModal)가 조작하고 OverlayRenderer(뷰어)가 동일 렌더링 — 드리프트 없음.
 * 좌표/크기는 모두 정규화(0~1 또는 배수) → 카드·모달 등 모든 컨테이너에서 동일 비율.
 */
export interface Overlay {
  id: string;
  text: string;
  /** 중심점 x (0~1, 컨테이너 폭 기준) */
  x: number;
  /** 중심점 y (0~1, 컨테이너 높이 기준) */
  y: number;
  /** 폰트 크기 배수. OverlayRenderer 가 width * BASE_RATIO * scale 로 렌더. 기본 1. */
  scale: number;
  /** hex 색상 */
  color: string;
  /** 도 단위 회전 (-180~180) */
  rotation: number;
  family: 'sans' | 'serif' | 'mono';
  weight: 400 | 700;
  align: 'left' | 'center' | 'right';
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPlanet: PlanetKey;
  /** 미디어 없는 스토리의 단색 배경 (#rrggbb). media 보다 우선순위 낮음. */
  bgColor?: string;
  media?: string;
  mediaType?: 'image' | 'video';
  /** 스토리식 텍스트 오버레이. 단일 피드 타입 = 스토리. */
  overlays?: Overlay[];
  systemId: string;
  systemSlug?: string;
  systemName?: string;
  createdAt?: string;
}

export interface System {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** 2-4 hex colors → gradient/glow rendered client-side via stars.ts */
  palette: string[];
  creatorId: string | null;
  isDefault: boolean;
  createdAt: string;
}
export interface Resonance {
  id: string;
  userA: string;
  userB: string;
  postA: string;
  postB: string;
  seen: boolean;
  createdAt: string;
}

export type Theme = 'white' | 'black';
