-- ============================================
-- posts.overlays — 인스타 스토리식 자유 위치 텍스트 오버레이
-- ============================================
-- 기존 text_overlay(text: white|black|color) + text_color(text)는
-- 단일 content를 사진 하단 고정 위치에 렌더링(CollageOverlay)하는 레거시.
-- 새 overlays jsonb 는 다중 텍스트 요소를 정규화 좌표(0~1)로 자유 배치.
--
-- 스키마:
--   overlays jsonb  -- TextOverlay[] | null
--     TextOverlay = { id, text, x, y, scale, color, rotation, family, weight, align }
--       x,y      : 0~1 (컨테이너 중심점 기준 정규화 좌표)
--       scale    : 폰트 크기 배수 (OverlayRenderer 가 컨테이너 폭 * baseRatio * scale 로 렌더)
--       color    : hex
--       rotation : 도(-180~180)
--       family   : 'sans' | 'serif' | 'mono'
--       weight   : 400 | 700
--       align    : 'left' | 'center' | 'right'
--
-- overlays 가 있으면 OverlayRenderer 로 렌더, 없으면 기존 CollageOverlay 경로 유지(레거시 호환).
-- ============================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS overlays jsonb DEFAULT NULL;

COMMENT ON COLUMN public.posts.overlays
  IS '스토리식 텍스트 오버레이 배열(TextOverlay[]). null=레거시(텍스트 본문 또는 text_overlay 하단 고정).';

-- ============================================
-- feed_random 재정의 — overlays 컬럼 반환 추가
-- ============================================
-- 주의: SECURITY DEFINER + 명시적 RETURNS TABLE + 3개 SELECT 리스트 모두에
-- overlays 를 넣어야 피드에 전달됨. 누락 시 조용히 사라짐(에러 없음).
-- ============================================

DROP FUNCTION IF EXISTS public.feed_random(uuid, integer, uuid[], uuid, integer, integer) CASCADE;

CREATE FUNCTION public.feed_random(
  viewer_id        uuid DEFAULT NULL,
  batch_size       integer DEFAULT 10,
  exclude_ids      uuid[] DEFAULT '{}'::uuid[],
  filter_system_id uuid DEFAULT NULL,
  recency_seconds  integer DEFAULT 86400,
  recent_cap       integer DEFAULT 8
)
RETURNS TABLE(
  id uuid,
  author_id uuid,
  content text,
  media_url text,
  media_type text,
  text_overlay text,
  text_color text,
  overlays jsonb,
  created_at timestamptz,
  author_display_name text,
  author_planet text,
  system_id uuid,
  system_slug text,
  system_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  WITH candidates AS (
    SELECT
      p.id,
      p.author_id,
      p.content,
      p.media_url,
      p.media_type,
      p.text_overlay,
      p.text_color,
      p.overlays,
      p.created_at,
      pr.display_name AS author_display_name,
      pr.planet       AS author_planet,
      s.id            AS system_id,
      s.slug          AS system_slug,
      s.name          AS system_name,
      (p.created_at >= now() - make_interval(secs => GREATEST(0, recency_seconds))) AS is_recent
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    JOIN public.systems  s  ON s.id = p.system_id
    WHERE (viewer_id IS NULL OR p.author_id <> viewer_id)
      AND (cardinality(exclude_ids) = 0 OR NOT (p.id = ANY(exclude_ids)))
      AND (filter_system_id IS NULL OR p.system_id = filter_system_id)
  ),
  recent_pick AS (
    SELECT id, author_id, content, media_url, media_type, text_overlay, text_color, overlays,
           created_at, author_display_name, author_planet, system_id, system_slug, system_name
    FROM candidates
    WHERE is_recent
    ORDER BY random()
    LIMIT LEAST(GREATEST(0, recent_cap), GREATEST(1, batch_size))
  ),
  fill_pick AS (
    SELECT id, author_id, content, media_url, media_type, text_overlay, text_color, overlays,
           created_at, author_display_name, author_planet, system_id, system_slug, system_name
    FROM candidates c
    WHERE NOT c.is_recent
      AND c.id NOT IN (SELECT id FROM recent_pick)
    ORDER BY random()
    LIMIT GREATEST(0, GREATEST(1, batch_size) - (SELECT count(*) FROM recent_pick))
  )
  SELECT id, author_id, content, media_url, media_type, text_overlay, text_color, overlays,
         created_at, author_display_name, author_planet, system_id, system_slug, system_name
  FROM recent_pick
  UNION ALL
  SELECT id, author_id, content, media_url, media_type, text_overlay, text_color, overlays,
         created_at, author_display_name, author_planet, system_id, system_slug, system_name
  FROM fill_pick;
$function$;

COMMENT ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer)
  IS '랜덤 피드 + 최근 글(recency) 가중 + 항성계 필터. '
     'filter_system_id=NULL → 전역(모든 항성계 합집합), 특정 uuid → 해당 항성계 글만. '
     '주의: 파라미터명이 filter_system_id 인 것은 컬럼 p.system_id 와의 섀도잉을 피하기 위함. '
     'viewer_id=NULL(비로그인)이면 자기 글 제외 생략. exclude_ids는 dismiss/보유 카드 제외. '
     'overlays(jsonb) = 스토리식 텍스트 오버레이 배열.';

GRANT EXECUTE ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer) TO PUBLIC;
