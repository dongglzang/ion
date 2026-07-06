-- ============================================
-- 레거시 피드 시스템 완전 삭제
-- ============================================
-- 스토리(= media + overlays)가 단일 피드 타입이 됨에 따라 옛 필드/흐름 제거:
--   posts.content         — 텍스트 본문 (스토리 모델에서 미사용; 텍스트는 overlays에 위치/스타일과 함께 저장됨)
--   posts.text_overlay    — 하단 단일 텍스트 모드 (white|black|color)
--   posts.text_color      — text_overlay=color 일 때의 hex
-- 그리고 feed_random 은 overlays 컬럼만 반환하도록 재정의.
-- (get_random_unviewed_posts 는 옛 함수 — feed_random 가 대체함 — 함께 정리.)
-- ============================================

ALTER TABLE public.posts
  DROP COLUMN IF EXISTS content,
  DROP COLUMN IF EXISTS text_overlay,
  DROP COLUMN IF EXISTS text_color;

DROP FUNCTION IF EXISTS public.get_random_unviewed_posts(uuid, int) CASCADE;

-- ============================================
-- feed_random 재정의 — overlays 만 반환
-- ============================================
-- SELECT 리스트 3개(recent_pick, fill_pick, 최종 UNION) 모두 overlays 단일 컬럼만.
-- 옛 content/text_overlay/text_color 누락 시 "조용히 사라짐" 경고 회피:
-- 모든 후보 CTE / 최종 SELECT 가 동일한 컬럼 셋을 반환.
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
  media_url text,
  media_type text,
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
      p.media_url,
      p.media_type,
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
    SELECT id, author_id, media_url, media_type, overlays,
           created_at, author_display_name, author_planet, system_id, system_slug, system_name
    FROM candidates
    WHERE is_recent
    ORDER BY random()
    LIMIT LEAST(GREATEST(0, recent_cap), GREATEST(1, batch_size))
  ),
  fill_pick AS (
    SELECT id, author_id, media_url, media_type, overlays,
           created_at, author_display_name, author_planet, system_id, system_slug, system_name
    FROM candidates c
    WHERE NOT c.is_recent
      AND c.id NOT IN (SELECT id FROM recent_pick)
    ORDER BY random()
    LIMIT GREATEST(0, GREATEST(1, batch_size) - (SELECT count(*) FROM recent_pick))
  )
  SELECT id, author_id, media_url, media_type, overlays,
         created_at, author_display_name, author_planet, system_id, system_slug, system_name
  FROM recent_pick
  UNION ALL
  SELECT id, author_id, media_url, media_type, overlays,
         created_at, author_display_name, author_planet, system_id, system_slug, system_name
  FROM fill_pick;
$function$;

COMMENT ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer)
  IS '스토리(= media + overlays) 랜덤 피드 + 최근 글(recency) 가중 + 항성계 필터. '
     'filter_system_id=NULL → 전역(모든 항성계 합집합), 특정 uuid → 해당 항성계 글만. '
     '주의: 파라미터명이 filter_system_id 인 것은 컬럼 p.system_id 와의 섀도잉을 피하기 위함. '
     'viewer_id=NULL(비로그인)이면 자기 글 제외 생략. exclude_ids 는 dismiss/보유 카드 제외. '
     'overlays(jsonb) = 스토리식 텍스트 오버레이 배열. media_url 이나 overlays 가 NULL 인 행도 그대로 노출.';

GRANT EXECUTE ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer) TO PUBLIC;
