-- ============================================
-- 항성계(System): 서브 커뮤니티 / 게시판
-- ============================================
-- 설계 결정 (2026-07-04):
--   - 시각: 커스텀 gradient → palette TEXT[] (2~4 hex) 저장, 행성 10종과 분리
--   - 글 지정: 필수 → posts.system_id NOT NULL (기본 항성계 'free' 시드 + 기존 글 backfill)
--   - 생성: open-UGC (인증 유저 누구나, creator만 편집/삭제)
--   - 전역 피드 '/' = 모든 항성계 합집합(발견 보존); '/s/:slug' = 단일 항성계
--
-- feed_random 변경:
--   - 시그니처 5 → 6 파라미터 (system_id uuid 추가). 기존 3-named-param 호출은 기본값 호환.
--   - RETURNS에 system_id/slug/name 추가 → 전역 피드 카드에서 항성계 배지 표시 가능.
--   - DROP ... CASCADE 후 6-param GRANT EXECUTE 재부여 필수 (advisory 정정 반영).
-- ============================================

-- ============================================
-- 1. systems 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.systems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL
              CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),   -- kebab-case
  name        TEXT NOT NULL,
  description TEXT,
  -- cardinality (NOT array_length): array_length([],1)=NULL → NULL BETWEEN 2 AND 4 는
  -- CHECK를 통과해버림. cardinality([])=0 이므로 빈 배열을 정확히 거름.
  palette     TEXT[] NOT NULL CHECK (cardinality(palette) BETWEEN 2 AND 4),
  creator_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_systems_slug ON public.systems(slug);

-- ============================================
-- 2. 기본 항성계 시드: 'free' (자유)
--    기존 글 마이그레이션 타겟 + 캐주얼 게시 기본 착지점.
--    creator_id = NULL, is_default = TRUE → RLS상 편집/삭제 불가(보호됨).
-- ============================================
INSERT INTO public.systems (slug, name, description, palette, is_default)
VALUES ('free', '자유', '기본 항성계',
        ARRAY['#8B8FA3','#5A5F7A','#3A3D52'], TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3. posts.system_id: 컬럼 추가 → backfill → NOT NULL
-- ============================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS system_id UUID REFERENCES public.systems(id);

UPDATE public.posts
SET system_id = (SELECT id FROM public.systems WHERE slug = 'free')
WHERE system_id IS NULL;

ALTER TABLE public.posts ALTER COLUMN system_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_system ON public.posts(system_id);

-- ============================================
-- 4. RLS (open-UGC)
-- ============================================
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "systems: read"   ON public.systems;
DROP POLICY IF EXISTS "systems: create" ON public.systems;
DROP POLICY IF EXISTS "systems: update" ON public.systems;
DROP POLICY IF EXISTS "systems: delete" ON public.systems;

CREATE POLICY "systems: read"   ON public.systems FOR SELECT USING (true);
CREATE POLICY "systems: create" ON public.systems FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "systems: update" ON public.systems FOR UPDATE
  USING (auth.uid() = creator_id);
CREATE POLICY "systems: delete" ON public.systems FOR DELETE
  USING (auth.uid() = creator_id AND is_default = FALSE);
-- 기본 항성계는 creator_id=NULL 이므로 어차피 삭제 불가; is_default=FALSE 조건으로 의도 명시.

-- ============================================
-- 5. text_overlay/text_color 멱등 보장 (drift 보정 — 기존 패턴)
-- ============================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS text_overlay TEXT
    CHECK (text_overlay IN ('white','black','color')),
  ADD COLUMN IF NOT EXISTS text_color TEXT;

-- ============================================
-- 6. feed_random 재정의: system_id 필터 + system 컬럼 반환
-- ============================================
-- 라이브 함수는 (uuid, integer, uuid[], integer, integer) 5-param.
-- 6-param으로 시그니처 변경. 두 시그니처 모두 멱등 DROP 후 재생성.
DROP FUNCTION IF EXISTS public.feed_random(uuid, integer, uuid[], integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.feed_random(uuid, integer, uuid[], uuid, integer, integer) CASCADE;

CREATE FUNCTION public.feed_random(
  viewer_id       uuid DEFAULT NULL,
  batch_size      integer DEFAULT 10,
  exclude_ids     uuid[] DEFAULT '{}'::uuid[],
  system_id       uuid DEFAULT NULL,        -- ★ NULL=전역(모든 항성계) / 특정=해당 항성계
  recency_seconds integer DEFAULT 86400,
  recent_cap      integer DEFAULT 8
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
      AND (system_id IS NULL OR p.system_id = system_id)   -- ★ 항성계 필터
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
  IS '랜덤 피드 + 최근 글(recency) 가중 + 항성계(system) 필터. '
     'system_id=NULL → 전역(모든 항성계 합집합), 특정 uuid → 해당 항성계 글만. '
     'viewer_id=NULL(비로그인)이면 자기 글 제외 생략. exclude_ids는 dismiss/보유 카드 제외. '
     'system_id/slug/name을 함께 반환하여 전역 피드 카드에 항성계 배지 표시.';

-- ★ DROP ... CASCADE 가 기존 EXECUTE 권한을 날리므로 6-param 시그니처로 재부여 필수.
--    생략 시 anon 역할이 'permission denied for function feed_random' → 피드 전체 중단.
GRANT EXECUTE ON FUNCTION public.feed_random(uuid, integer, uuid[], uuid, integer, integer) TO PUBLIC;
