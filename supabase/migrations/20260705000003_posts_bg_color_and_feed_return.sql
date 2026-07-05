-- ============================================
-- posts.bg_color + feed_random bg_color 반환 — 스토리 단색 배경 누락 수정
-- ============================================
-- 배경: 미디어 없는 스토리(단색 bg + overlays)가 정상 폼(CreateStoryModal,
-- useMyPosts insert 경로)에서는 저장되지만 feed_random RPC가 bg_color 컬럼을
-- 반환하지 않아 FeedRow → mappers.toPost → PostCard 경로에서 bgColor 가
-- undefined 가 됨. 결과: 피드에서 bg-only 스토리가 배경 없는 컨테이너에
-- overlay만 떠서 안 보이거나 깨져 보임. MyPage/상세는 직접 SELECT 라 정상.
--
-- 이 마이그레이션:
--   1) posts.bg_color 컬럼 정의 (기존 live 에 ad-hoc 으로만 존재 → repo 캡처)
--   2) feed_random RETURNS + 모든 SELECT 리스트(candidates/recent_pick/
--      fill_pick/UNION 양쪽)에 bg_color 추가 — 누락 시 "조용히 사라짐"
--      (이 폴더의 반복되는 경고 패턴).
--   3) 동시에 author_planet → author_planet_seed, is_recent RETURNS 추가로
--      기존 스키마 drift(author_planet_seed rename, is_recent 노출)를 정리.
--
-- 멱등: ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS / DROP FUNCTION
-- IF EXISTS ... CASCADE / 마지막 GRANT EXECUTE. reset/repeat 안전.
-- ============================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS bg_color text;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_bg_color_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_bg_color_check
  CHECK (bg_color IS NULL OR bg_color ~ '^#[0-9a-fA-F]{6}$');

COMMENT ON COLUMN public.posts.bg_color
  IS '미디어 없는 스토리의 단색 배경 (#rrggbb hex). media_url 보다 우선순위 낮음.';

-- ============================================
-- feed_random 재정의 — bg_color / author_planet_seed / is_recent 포함
-- ============================================
-- SELECT 리스트 4개(candidates, recent_pick, fill_pick, 최종 UNION 양쪽) 모두
-- 동일한 컬럼 셋이어야 함. 하나라도 빠지면 조용히 사라짐.
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
  bg_color text,
  overlays jsonb,
  created_at timestamptz,
  author_display_name text,
  author_planet_seed bigint,
  system_id uuid,
  system_slug text,
  system_name text,
  is_recent boolean
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
      p.bg_color,
      p.overlays,
      p.created_at,
      pr.display_name                 AS author_display_name,
      pr.planet_seed                  AS author_planet_seed,
      s.id                            AS system_id,
      s.slug                          AS system_slug,
      s.name                          AS system_name,
      (p.created_at >= now() - make_interval(secs => GREATEST(0, recency_seconds))) AS is_recent
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    JOIN public.systems  s  ON s.id  = p.system_id
    WHERE (viewer_id IS NULL OR p.author_id <> viewer_id)
      AND (cardinality(exclude_ids) = 0 OR NOT (p.id = ANY(exclude_ids)))
      AND (filter_system_id IS NULL OR p.system_id = filter_system_id)
  ),
  recent_pick AS (
    SELECT c.id, c.author_id, c.media_url, c.media_type, c.bg_color, c.overlays,
           c.created_at, c.author_display_name, c.author_planet_seed,
           c.system_id, c.system_slug, c.system_name, c.is_recent
    FROM candidates c
    WHERE c.is_recent
    ORDER BY random()
    LIMIT LEAST(GREATEST(0, recent_cap), GREATEST(1, batch_size))
  ),
  fill_pick AS (
    SELECT c.id, c.author_id, c.media_url, c.media_type, c.bg_color, c.overlays,
           c.created_at, c.author_display_name, c.author_planet_seed,
           c.system_id, c.system_slug, c.system_name, c.is_recent
    FROM candidates c
    WHERE NOT c.is_recent
      AND NOT (c.id = ANY (SELECT id FROM recent_pick))
    ORDER BY random()
    LIMIT GREATEST(0, GREATEST(1, batch_size) - (SELECT count(*) FROM recent_pick))
  )
  SELECT id, author_id, media_url, media_type, bg_color, overlays,
         created_at, author_display_name, author_planet_seed,
         system_id, system_slug, system_name, is_recent
  FROM recent_pick
  UNION ALL
  SELECT id, author_id, media_url, media_type, bg_color, overlays,
         created_at, author_display_name, author_planet_seed,
         system_id, system_slug, system_name, is_recent
  FROM fill_pick;
$function$;

COMMENT ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer)
  IS '스토리(= media + overlays 또는 bg_color + overlays) 랜덤 피드 + 최근 글(recency) 가중 + 항성계 필터. '
     'filter_system_id=NULL → 전역(모든 항성계 합집합), 특정 uuid → 해당 항성계 글만. '
     '주의: 파라미터명이 filter_system_id 인 것은 컬럼 p.system_id 와의 섀도잉을 피하기 위함. '
     'viewer_id=NULL(비로그인)이면 자기 글 제외 생략. exclude_ids 는 dismiss/보유 카드 제외. '
     'overlays(jsonb) = 스토리식 텍스트 오버레이 배열. '
     'bg_color = 미디어 없는 스토리의 단색 배경. is_recent = recency 가중 적용 여부.';

GRANT EXECUTE ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer) TO PUBLIC;
