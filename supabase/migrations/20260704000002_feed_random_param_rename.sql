-- ============================================
-- feed_random 파라미터 섀도잉 버그 수정
-- ============================================
-- 버그: 이전 마이그레이션에서 파라미터명을 system_id 로 지었는데,
-- SQL-언어 함수 본문에서 bare `system_id` 가 FROM 컬럼 p.system_id 로 해석됨
-- (PostgreSQL: SQL 함수에서 FROM 컬럼이 동명 파라미터를 가림).
-- 결과: WHERE (system_id IS NULL OR p.system_id = system_id) 는
--   → p.system_id IS NULL (항상 FALSE, NOT NULL) OR p.system_id = p.system_id (항상 TRUE)
--   → 영구 no-op → /s/:slug 가 모든 글을 반환. 핵심 기능 사망.
--
-- 수정: 파라미터명을 filter_system_id 로 변경(컬럼과 충불가).
-- 함수 식별은 인자 타입 기준이므로 시그니처 (uuid,int,uuid[],uuid,int,int) 는 동일.
-- 클라이언트는 항성계 피드에서 filter_system_id 를 전달; 생략 시 NULL(전역).
-- ============================================

DROP FUNCTION IF EXISTS public.feed_random(uuid, integer, uuid[], uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.feed_random(uuid, integer, uuid[], integer, integer) CASCADE;

CREATE FUNCTION public.feed_random(
  viewer_id        uuid DEFAULT NULL,
  batch_size       integer DEFAULT 10,
  exclude_ids      uuid[] DEFAULT '{}'::uuid[],
  filter_system_id uuid DEFAULT NULL,        -- ★ 컬럼과 충돌 방지용 rename
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
      AND (filter_system_id IS NULL OR p.system_id = filter_system_id)   -- ★ 고침
  ),
  recent_pick AS (
    SELECT id, author_id, content, media_url, media_type, text_overlay, text_color,
           created_at, author_display_name, author_planet, system_id, system_slug, system_name
    FROM candidates
    WHERE is_recent
    ORDER BY random()
    LIMIT LEAST(GREATEST(0, recent_cap), GREATEST(1, batch_size))
  ),
  fill_pick AS (
    SELECT id, author_id, content, media_url, media_type, text_overlay, text_color,
           created_at, author_display_name, author_planet, system_id, system_slug, system_name
    FROM candidates c
    WHERE NOT c.is_recent
      AND c.id NOT IN (SELECT id FROM recent_pick)
    ORDER BY random()
    LIMIT GREATEST(0, GREATEST(1, batch_size) - (SELECT count(*) FROM recent_pick))
  )
  SELECT id, author_id, content, media_url, media_type, text_overlay, text_color,
         created_at, author_display_name, author_planet, system_id, system_slug, system_name
  FROM recent_pick
  UNION ALL
  SELECT id, author_id, content, media_url, media_type, text_overlay, text_color,
         created_at, author_display_name, author_planet, system_id, system_slug, system_name
  FROM fill_pick;
$function$;

COMMENT ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer)
  IS '랜덤 피드 + 최근 글(recency) 가중 + 항성계 필터. '
     'filter_system_id=NULL → 전역(모든 항성계 합집합), 특정 uuid → 해당 항성계 글만. '
     '주의: 파라미터명이 filter_system_id 인 것은 컬럼 p.system_id 와의 섀도잉을 피하기 위함. '
     'viewer_id=NULL(비로그인)이면 자기 글 제외 생략. exclude_ids는 dismiss/보유 카드 제외.';

GRANT EXECUTE ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer) TO PUBLIC;
