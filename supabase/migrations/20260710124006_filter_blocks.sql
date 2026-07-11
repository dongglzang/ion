-- ============================================
-- 블록 적용: 피드 + World 그래프
-- ============================================
-- 배경:
--   user가 "차단"을 누르면 blocks 테이블에 row는 정상적으로 INSERT됨
--   (blockUser, RLS: FOR ALL USING auth.uid() = blocker_id, 모두 통과).
--   그러나 피드/World 그래프의 read path들이 blocks를 전혀 필터하지 않아
--   차단한 사용자의 글/edge가 그대로 노출됨. 차단 기능이 사실상 비활성.
--
-- 이 마이그레이션은 feed_random + mutual_connections 두 RPC에 block 필터를
-- 추가한다. 마스터의 v2 정의(mutual_connections v20260613034112)와 prod의
-- 현재 정의가 분기되어 있어, prod의 현재 정의를 그대로 따라가서 block 절만
-- 추가한다. SCHEMA mismatch 방지를 위해 body를 한 글자도 바꾸지 않는다.
--
-- 멱등: DROP FUNCTION IF EXISTS ... CASCADE / 마지막 GRANT EXECUTE.
-- ============================================

-- ============================================
-- 1) feed_random 재정의 — block filter 추가
-- ============================================
-- 20260705000003 / prod의 현재 정의를 그대로 따르되 candidates CTE에
-- NOT EXISTS(blocks) 한 줄만 추가. 13개 컬럼/시그니처/grant 전부 유지.

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
      -- block filter: viewer가 차단한 작성자 제외. anon(viewer_id NULL)에서는
      -- blocks 행이 어차피 viewer_id와 매치될 수 없으므로 no-op.
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE b.blocker_id = viewer_id AND b.blocked_id = p.author_id
      )
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
  IS '스토리 랜덤 피드 + 최근 글(recency) 가중 + 항성계 필터 + 차단 필터. '
     'filter_system_id=NULL → 전역(모든 항성계 합집합), 특정 uuid → 해당 항성계 글만. '
     'viewer_id=NULL(비로그인)이면 자기 글 제외 + 차단 필터 둘 다 생략. '
     'exclude_ids 는 dismiss/보유 카드 제외. '
     '차단 필터: viewer_id로 시작된 blocks 행이 있는 author_id는 후보에서 제외.';

GRANT EXECUTE ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer) TO PUBLIC;

-- ============================================
-- 2) mutual_connections 재정의 — block filter 추가
-- ============================================
-- prod의 현재 정의(`l1.post_id → p1.author_id → l2.user_id` 패턴)를 그대로 따르고
-- block 필터만 추가. 마스터의 v2 정의(`l1.post_id = l2.post_id` 패턴)와 다르므로
-- 마스터 정의를 그대로 쓰면 prod 동작이 깨진다 — 그래서 prod 기준을 사용.

DROP FUNCTION IF EXISTS public.mutual_connections(uuid) CASCADE;

CREATE FUNCTION public.mutual_connections(viewer_id uuid)
RETURNS TABLE(user_a uuid, user_b uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT DISTINCT
    l1.user_id AS user_a,
    p1.author_id AS user_b
  FROM likes l1
  JOIN posts p1 ON l1.post_id = p1.id
  WHERE l1.user_id = viewer_id
    AND p1.author_id != viewer_id
    AND EXISTS (
      SELECT 1 FROM likes l2
      JOIN posts p2 ON l2.post_id = p2.id
      WHERE l2.user_id = p1.author_id
        AND p2.author_id = viewer_id
    )
    -- viewer가 user_a 또는 user_b를 차단했다면 edge 숨김.
    -- 단방향(viewer → other). 상호 차단까지 숨길지는 product 결정.
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = viewer_id AND b.blocked_id = l1.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = viewer_id AND b.blocked_id = p1.author_id
    );
$function$;

COMMENT ON FUNCTION public.mutual_connections(uuid)
  IS 'viewer의 상호 좋아요 edge. viewer가 user_a 또는 user_b를 차단했다면 그 edge는 숨긴다. '
     'blocks 행은 RLS로 viewer만 자기 행을 보고/쓸 수 있으므로 SECURITY DEFINER여도 viewer-isolated.';

GRANT EXECUTE ON FUNCTION public.mutual_connections(uuid) TO PUBLIC;
