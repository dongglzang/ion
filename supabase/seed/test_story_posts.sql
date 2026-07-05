-- ============================================
-- dev fixture — test 계정 스토리 피드 + 소셜 그래프 시드
-- ============================================
-- ⚠️ 트래킹 마이그레이션이 아님. 일회성 dev 데이터 시드 스크립트.
--   supabase/migrations/ 가 아니라 supabase/seed/ 에 두는 이유:
--   스키마 히스토리를 일회성 테스트 데이터로 오염시키지 않기 위해.
--
-- 실행:
--   supabase db execute --file supabase/seed/test_story_posts.sql
--   (또는 Supabase Dashboard → SQL Editor 붙여넣기)
--
-- 범위: testuser%@ion.test 계정 한정. 실제 유저 글 보존.
-- 재실행-safe: posts CASCADE 삭제 후 재삽입. likes/resonances ON CONFLICT 가드.
--
-- 결과(최초 실행 기준):
--   - posts 300개 (50 test 작성자 × 6, 스토리 형식)
--   - likes ~100~300 (mutual ring 100 + random 단방향, ON CONFLICT 가드)
--   - resonances 50 (mutual ring pair당 1)
--   - all_mutual_connections() = 100 edges
-- ============================================

BEGIN;

-- 1) test 계정의 기존 media_url 백업 (Storage orphan 재활용)
CREATE TEMP TABLE _orphan_media ON COMMIT DROP AS
SELECT media_url, media_type, row_number() OVER () - 1 AS i
FROM public.posts
WHERE author_id IN (SELECT id FROM public.profiles WHERE email LIKE 'testuser%@ion.test')
  AND media_url IS NOT NULL;

-- 2) test 계정 posts CASCADE 삭제 (likes/reports/resonances 자동)
DELETE FROM public.posts
WHERE author_id IN (SELECT id FROM public.profiles WHERE email LIKE 'testuser%@ion.test');

-- 3) 스토리 posts 300개 재생성 (50 작성자 × 6)
WITH
tpl AS (
  SELECT row_number() OVER () - 1 AS i, t.*
  FROM (VALUES
    ('혼자인 우주에서, 같은 하늘을 본다',  '#1e293b', 0.5::float8, 0.5::float8, 1.4::float8, '#ffffff', 0::int,  'sans'::text,  700::int, 'center'::text),
    ('수치로 잴 수 없는 나의 밤',          '#000000', 0.5, 0.5, 1.2, '#ffffff', 0,  'serif', 700, 'center'),
    ('조용히 빛나는 별처럼',                '#3b82f6', 0.5, 0.4, 1.3, '#ffffff', -3, 'serif', 400, 'center'),
    ('오늘의 궤도, 그저 여기에',            '#1e293b', 0.5, 0.78, 0.95, '#ffffff', 0, 'sans', 400, 'center'),
    ('메아리 없이도 닿는 마음',             '#8b5cf6', 0.5, 0.5, 1.2, '#ffffff', 2,  'sans', 700, 'center'),
    ('수치 없이, 존재로',                   '#ec4899', 0.5, 0.5, 1.5, '#ffffff', 0,  'sans', 700, 'center'),
    ('i''m alone, but not lonely',          '#000000', 0.5, 0.5, 1.1, '#ffffff', 0,  'mono', 700, 'center'),
    ('궤도에서 잠시 벗어난 오후',           '#f59e0b', 0.5, 0.5, 1.2, '#111111', 0, 'serif', 700, 'center'),
    ('말없이도 닿는 별빛',                  '#10b981', 0.5, 0.5, 1.3, '#ffffff', -2, 'sans', 700, 'center'),
    ('오늘도 그저, 여기에',                 '#1e293b', 0.5, 0.85, 0.9, '#ffffff', 0, 'sans', 400, 'center'),
    ('빛은 어두운 곳에서 더 빛난다',        '#000000', 0.5, 0.5, 1.0, '#ffffff', 0,  'serif', 700, 'center'),
    ('아무도 모르는 나의 밤',               '#1e293b', 0.5, 0.3, 1.2, '#ffffff', 0,  'sans', 400, 'center'),
    ('숫자 없이 서로를 알아보기',           '#3b82f6', 0.18, 0.5, 1.0, '#ffffff', 0, 'sans', 700, 'left'),
    ('침묵으로 말하기',                     '#ec4899', 0.5, 0.5, 1.4, '#ffffff', 4,  'serif', 700, 'center'),
    ('혼자만의 우주, 같은 하늘',            '#8b5cf6', 0.5, 0.5, 1.2, '#ffffff', 0,  'sans', 700, 'center'),
    ('표현할 수 없는 것들을 위해',          '#000000', 0.5, 0.6, 0.9, '#ffffff', 0,  'serif', 400, 'center'),
    ('가만히 머무는 시간',                  '#1e293b', 0.5, 0.5, 1.3, '#ffffff', -1, 'sans', 700, 'center'),
    ('수치 없이 존재하는 밤',               '#ec4899', 0.5, 0.5, 1.1, '#ffffff', 0,  'sans', 700, 'center'),
    ('조용한 별들 사이로',                  '#3b82f6', 0.5, 0.5, 1.0, '#ffffff', 0,  'serif', 400, 'center'),
    ('우주는 침묵 속에서 빛난다',           '#000000', 0.5, 0.5, 1.2, '#ffffff', 0,  'serif', 700, 'center'),
    ('혼자 있을 때 가장 나다운 나',         '#1e293b', 0.5, 0.55, 1.0, '#ffffff', 0, 'sans', 400, 'center'),
    ('수 없는 밤을 지나',                   '#8b5cf6', 0.5, 0.5, 1.1, '#ffffff', 0,  'sans', 700, 'center'),
    ('눈에 보이지 않는 궤도',               '#10b981', 0.5, 0.5, 1.2, '#ffffff', -2, 'serif', 700, 'center'),
    ('오늘은 아주 작은 별로',               '#1e293b', 0.5, 0.5, 1.0, '#ffffff', 0,  'sans', 400, 'center'),
    ('조용히 숨 쉬는 우주',                 '#000000', 0.5, 0.45, 1.1, '#ffffff', 0, 'sans', 700, 'center'),
    ('혼자 걷는 별빛 길',                   '#3b82f6', 0.5, 0.5, 1.3, '#ffffff', 3,  'serif', 700, 'center'),
    ('수치를 버리고 남는 것',               '#ec4899', 0.5, 0.5, 1.0, '#ffffff', 0,  'sans', 700, 'center'),
    ('같은 하늘 아래, 다른 궤도',           '#1e293b', 0.5, 0.5, 1.1, '#ffffff', 0,  'sans', 700, 'center'),
    ('침묵이 가진 온기',                    '#000000', 0.5, 0.5, 1.2, '#ffffff', 0,  'serif', 700, 'center'),
    ('수치로 잴 수 없는 것들',              '#ec4899', 0.5, 0.5, 1.1, '#ffffff', 0,  'sans', 700, 'center'),
    ('오늘의 작은 위성',                    '#3b82f6', 0.82, 0.5, 0.9, '#ffffff', 0, 'sans', 700, 'right'),
    ('조용히 떠 있는 시간',                 '#1e293b', 0.5, 0.5, 1.2, '#ffffff', 0,  'sans', 400, 'center'),
    ('빛나지 않아도 괜찮은 밤',             '#000000', 0.5, 0.5, 1.0, '#ffffff', 0,  'serif', 700, 'center'),
    ('아주 작은 별의 노래',                 '#8b5cf6', 0.5, 0.5, 1.1, '#ffffff', 2,  'sans', 700, 'center'),
    ('우주의 속삭임을 듣는 밤',             '#10b981', 0.5, 0.5, 1.0, '#ffffff', 0,  'serif', 400, 'center'),
    ('혼자여도 온전한 밤',                   '#1e293b', 0.5, 0.5, 1.3, '#ffffff', 0,  'sans', 700, 'center'),
    ('수치 없이, 이름 없이',                '#ec4899', 0.5, 0.5, 1.0, '#ffffff', 0,  'mono', 700, 'center'),
    ('조용히 빛나는 게 충분한 밤',          '#000000', 0.5, 0.5, 1.0, '#ffffff', 0,  'serif', 400, 'center'),
    ('같은 하늘, 다른 속도',                '#3b82f6', 0.5, 0.5, 1.1, '#ffffff', 0,  'sans', 700, 'center'),
    ('오늘도 가만히, 여기',                 '#1e293b', 0.5, 0.82, 0.9, '#ffffff', 0, 'sans', 400, 'center'),
    ('수 없는 별 중 하나로',                '#8b5cf6', 0.5, 0.5, 1.0, '#ffffff', 0,  'serif', 700, 'center'),
    ('혼자만의 우주가 모여 은하가 된다',    '#000000', 0.5, 0.5, 0.95, '#ffffff', 0, 'sans', 700, 'center'),
    ('말없이도 따뜻한 밤',                  '#ec4899', 0.5, 0.5, 1.1, '#ffffff', 0,  'sans', 700, 'center'),
    ('수치를 잊은 온전한 하루',             '#1e293b', 0.5, 0.5, 1.0, '#ffffff', 0,  'sans', 400, 'center'),
    ('조용히 흐르는 별빛',                  '#3b82f6', 0.5, 0.5, 1.2, '#ffffff', -2, 'serif', 700, 'center'),
    ('오늘의 작은 발견',                    '#f59e0b', 0.5, 0.5, 1.0, '#111111', 0, 'sans', 700, 'center'),
    ('수치 없이 살아가는 법',               '#ec4899', 0.5, 0.5, 1.0, '#ffffff', 0,  'sans', 700, 'center'),
    ('혼자만의 궤도를 그리며',              '#1e293b', 0.5, 0.55, 1.1, '#ffffff', 0, 'serif', 400, 'center'),
    ('조용히 깨어 있는 새벽',               '#000000', 0.5, 0.5, 1.2, '#ffffff', 0,  'sans', 700, 'center'),
    ('별빛이 닿지 않는 곳에서도',           '#8b5cf6', 0.5, 0.5, 1.0, '#ffffff', 0,  'serif', 400, 'center')
  ) AS t(text, bg, x, y, scale, color, rotation, family, weight, align)
),
authors AS (
  SELECT id, row_number() OVER (ORDER BY email) - 1 AS aidx
  FROM public.profiles
  WHERE email LIKE 'testuser%@ion.test'
),
media_n AS (SELECT COUNT(*) AS n FROM _orphan_media),
seed AS (
  SELECT
    a.id AS author_id,
    a.aidx,
    g.n AS pidx,
    (a.aidx * 13 + g.n * 7) % 50 AS tpl_i,
    CASE WHEN (SELECT n FROM media_n) > 0
         THEN (a.aidx * 5 + g.n * 3) % (SELECT n FROM media_n)
         ELSE -1 END AS media_i,
    CASE WHEN (a.aidx * 13 + g.n * 7) % 2 = 0 THEN true ELSE false END AS want_media
  FROM authors a
  CROSS JOIN generate_series(0, 5) AS g(n)
)
INSERT INTO public.posts (author_id, system_id, bg_color, media_url, media_type, overlays, created_at)
SELECT
  s.author_id,
  (SELECT id FROM public.systems WHERE slug = 'free'),
  CASE WHEN s.want_media AND om.media_url IS NOT NULL THEN NULL ELSE t.bg END,
  CASE WHEN s.want_media AND om.media_url IS NOT NULL THEN om.media_url ELSE NULL END,
  CASE WHEN s.want_media AND om.media_url IS NOT NULL THEN om.media_type ELSE NULL END,
  jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'text', t.text,
    'x', t.x,
    'y', t.y,
    'scale', t.scale,
    'color', CASE WHEN s.want_media AND om.media_url IS NOT NULL THEN '#ffffff' ELSE t.color END,
    'rotation', t.rotation,
    'family', t.family,
    'weight', t.weight,
    'align', t.align
  )),
  now() - (random() * interval '14 days')
FROM seed s
JOIN tpl t ON t.i = s.tpl_i
LEFT JOIN _orphan_media om ON om.i = s.media_i;

-- 4) mutual ring likes: (i, i+1) × 50쌍 양방향. all_mutual_connections() = 100 edges.
WITH
a AS (
  SELECT id, row_number() OVER (ORDER BY email) - 1 AS i
  FROM public.profiles WHERE email LIKE 'testuser%@ion.test'
),
fp AS (
  SELECT DISTINCT ON (author_id) id AS post_id, author_id
  FROM public.posts
  WHERE author_id IN (SELECT id FROM a)
  ORDER BY author_id, created_at DESC
),
pairs AS (
  SELECT
    x.id AS a_id, y.id AS b_id,
    fx.post_id AS a_post, fy.post_id AS b_post
  FROM a x
  JOIN a y ON y.i = (x.i + 1) % 50
  JOIN fp fx ON fx.author_id = x.id
  JOIN fp fy ON fy.author_id = y.id
)
INSERT INTO public.likes (user_id, post_id, created_at)
SELECT a_id, b_post, now() - (random() * interval '10 days') FROM pairs
UNION ALL
SELECT b_id, a_post, now() - (random() * interval '10 days') FROM pairs
ON CONFLICT (user_id, post_id) DO NOTHING;

-- 5) random 단방향 likes (200회 추첨, ON CONFLICT 가드)
INSERT INTO public.likes (user_id, post_id, created_at)
SELECT
  u.id,
  tp.post_id,
  now() - (random() * interval '10 days')
FROM generate_series(1, 200) gs
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles WHERE email LIKE 'testuser%@ion.test' ORDER BY random() LIMIT 1
) u
CROSS JOIN LATERAL (
  SELECT p.id AS post_id, p.author_id
  FROM public.posts p
  WHERE p.author_id IN (SELECT id FROM public.profiles WHERE email LIKE 'testuser%@ion.test')
  ORDER BY random() LIMIT 1
) tp
WHERE u.id <> tp.author_id
ON CONFLICT (user_id, post_id) DO NOTHING;

-- 6) resonances: mutual ring pair당 1개 (canonical ordering, UNIQUE 가드)
WITH
a AS (
  SELECT id, row_number() OVER (ORDER BY email) - 1 AS i
  FROM public.profiles WHERE email LIKE 'testuser%@ion.test'
),
fp AS (
  SELECT DISTINCT ON (author_id) id AS post_id, author_id
  FROM public.posts
  WHERE author_id IN (SELECT id FROM a)
  ORDER BY author_id, created_at DESC
),
pairs AS (
  SELECT
    x.id AS a_id, y.id AS b_id,
    fx.post_id AS a_post, fy.post_id AS b_post
  FROM a x
  JOIN a y ON y.i = (x.i + 1) % 50
  JOIN fp fx ON fx.author_id = x.id
  JOIN fp fy ON fy.author_id = y.id
)
INSERT INTO public.resonances (user_a, user_b, post_a, post_b, seen, created_at)
SELECT
  LEAST(a_id, b_id),
  GREATEST(a_id, b_id),
  CASE WHEN a_id < b_id THEN a_post ELSE b_post END,
  CASE WHEN a_id < b_id THEN b_post ELSE a_post END,
  (random() < 0.5)::boolean,
  now() - (random() * interval '10 days')
FROM pairs
ON CONFLICT (user_a, user_b) DO NOTHING;

COMMIT;
