import type { Overlay } from '@/types';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// Types
// ============================================

export interface Profile {
  id: string;
  display_name: string;
  planet_seed: number;
  email: string | null;
  status_message: string | null;
  created_at: string;
}

export interface FeedRow {
  id: string;
  author_id: string;
  bg_color?: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  overlays?: unknown[] | null;
  created_at: string;
  author_display_name: string;
  author_planet_seed: number;
  system_id: string;
  system_slug: string;
  system_name: string;
}


export interface SystemRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  palette: string[];
  creator_id: string | null;
  is_default: boolean;
  created_at: string;
}

export interface ResonanceRow {
  id: string;
  user_a: string;
  user_b: string;
  post_a: string;
  post_b: string;
  seen: boolean;
  created_at: string;
}

// ============================================
// Auth
// ============================================

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

/** Dev-only: email/password login for test accounts */
export function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function onAuthStateChange(
  callback: (user: { id: string; display_name: string; planet_seed: number; status_message: string | null } | null) => void,
) {
  return supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) return callback(null);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, planet_seed, status_message')
      .eq('id', session.user.id)
      .single();

    callback({
      id: session.user.id,
      display_name: profile?.display_name ?? session.user.user_metadata?.full_name ?? 'Anonymous',
      planet_seed: (profile?.planet_seed ?? 0) >>> 0,
      status_message: profile?.status_message ?? null,
    });
  });
}

// ============================================
// Profiles
// ============================================

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, planet_seed, email, status_message, created_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export function updateDisplayName(userId: string, name: string) {
  return supabase.from('profiles').update({ display_name: name }).eq('id', userId);
}

export function updatePlanetSeed(userId: string, planetSeed: number) {
  return supabase.from('profiles').update({ planet_seed: (planetSeed >>> 0) }).eq('id', userId);
}

/** Empty string clears the user's status and falls back to the default slogan. */
export function updateStatusMessage(userId: string, statusMessage: string) {
  const trimmed = statusMessage.trim();
  return supabase
    .from('profiles')
    .update({ status_message: trimmed.length === 0 ? null : trimmed })
    .eq('id', userId);
}

// ============================================
// Storage
// ============================================

export async function uploadMedia(
  file: File,
  userId: string,
): Promise<{ url: string; type: 'image' | 'video' }> {
  const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${type}s/${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return { url: data.publicUrl, type };
}

// ============================================
// Posts
// ============================================

export async function createPost(opts: {
  author_id: string;
  bg_color?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  system_id: string;
  overlays?: Overlay[];
}) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: opts.author_id,
      bg_color: opts.bg_color ?? null,
      media_url: opts.media_url ?? null,
      media_type: opts.media_type ?? null,
      system_id: opts.system_id,
      overlays: opts.overlays ?? null,
    })
    .select('id, author_id, bg_color, media_url, media_type, overlays, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getFeed(
  viewerId: string,
  batchSize = 10,
  excludeIds: string[] = [],
  systemId?: string | null,
): Promise<FeedRow[]> {
  const { data, error } = await supabase.rpc('feed_random', {
    // 비로그인(anon) 허용 — viewer_id NULL이면 자기 글 제외 생략.
    // filter_system_id: NULL=전역(모든 항성계 합집합), 특정 uuid=해당 항성계만.
    // (컬럼 p.system_id 와의 섀도잉 방지로 파라미터명이 filter_system_id 임)
    viewer_id: viewerId || null,
    batch_size: batchSize,
    exclude_ids: excludeIds,
    filter_system_id: systemId ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getUserPosts(userId: string): Promise<FeedRow[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, author_id, bg_color, media_url, media_type, overlays, created_at, system_id,
      author_display_name:profiles!posts_author_id_fkey(display_name),
      author_planet_seed:profiles!posts_author_id_fkey(planet_seed),
      system_slug:systems!posts_system_id_fkey(slug),
      system_name:systems!posts_system_id_fkey(name)
    `)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    author_id: p.author_id as string,
    bg_color: p.bg_color as string | null | undefined,
    media_url: p.media_url as string | null,
    media_type: p.media_type as 'image' | 'video' | null,
    overlays: p.overlays as unknown[] | null | undefined,
    created_at: p.created_at as string,
    author_display_name: ((p.author_display_name as { display_name: string }[])?.[0]?.display_name) ?? '',
    author_planet_seed: ((p.author_planet_seed as { planet_seed: number }[])?.[0]?.planet_seed ?? 0) >>> 0,
    system_id: p.system_id as string,
    system_slug: ((p.system_slug as { slug: string }[])?.[0]?.slug) ?? '',
    system_name: ((p.system_name as { name: string }[])?.[0]?.name) ?? '',
  }));
}

// ============================================
// Systems (항성계)
// ============================================

export async function listSystems(): Promise<SystemRow[]> {
  const { data, error } = await supabase
    .from('systems')
    .select('id, slug, name, description, palette, creator_id, is_default, created_at')
    .order('is_default', { ascending: false }) // 기본 항성계 먼저
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getSystemBySlug(slug: string): Promise<SystemRow | null> {
  const { data, error } = await supabase
    .from('systems')
    .select('id, slug, name, description, palette, creator_id, is_default, created_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSystem(opts: {
  slug: string;
  name: string;
  description?: string;
  palette: string[];
  creator_id: string;
}): Promise<SystemRow> {
  const { data, error } = await supabase
    .from('systems')
    .insert({
      slug: opts.slug,
      name: opts.name,
      description: opts.description ?? null,
      palette: opts.palette,
      creator_id: opts.creator_id,
    })
    .select('id, slug, name, description, palette, creator_id, is_default, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(postId: string, userId: string) {
  // 호출 측(useDeletePost)이 userId 컨텍스트를 이미 알고 있음.
  // 매 삭제마다 supabase.auth.getUser() 호출 → 토큰 검증 + RLS user_id 추출
  // (불필요). 직접 eq 필터 + RLS 가 이중 방어.
  const { error } = await supabase.from('posts').delete()
    .eq('id', postId)
    .eq('author_id', userId);
  if (error) throw error;
}

// ============================================
// Likes
// ============================================

export async function likePost(userId: string, postId: string) {
  const { error } = await supabase.from('likes').insert({ user_id: userId, post_id: postId });
  if (error && error.code !== '23505') throw error;
}

export async function unlikePost(userId: string, postId: string) {
  const { error } = await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId);
  if (error) throw error;
}

export async function getMyLikedPostIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('likes').select('post_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: { post_id: string }) => r.post_id);
}

// ============================================
// World — 상호 연결
// ============================================

export async function getAllMutualConnections(): Promise<{ user_a: string; user_b: string }[]> {
  const { data, error } = await supabase.rpc('all_mutual_connections');
  if (error) throw error;
  return data ?? [];
}

export async function getMutualConnections(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('mutual_connections', { viewer_id: viewerId });
  if (error) throw error;
  // user_a가 항상 viewer, user_b가 상대방
  return (data ?? []).map((r: { user_b: string }) => r.user_b);
}

// ============================================
// Blocks
// ============================================

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
  if (error) throw error;
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

// ============================================
// Reports
// ============================================

export async function reportPost(reporterId: string, postId: string, reason: string, detail?: string) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    post_id: postId,
    reason,
    detail: detail ?? null,
  });
  if (error) throw error;
}

// ============================================
// Account Deletion (회원 탈퇴)
// ============================================

export async function deleteAccount(userId: string) {
  // 1. Delete all storage files for this user (images/* and videos/*)
  const [imageList, videoList] = await Promise.all([
    supabase.storage.from('media').list(`images/${userId}`),
    supabase.storage.from('media').list(`videos/${userId}`),
  ]);

  const paths: string[] = [];
  for (const list of [imageList, videoList]) {
    if (list.data) {
      for (const f of list.data) {
        // Folder entries have no name with extension; skip them
        if (f.name) paths.push(`${list === imageList ? 'images' : 'videos'}/${userId}/${f.name}`);
      }
    }
  }

  if (paths.length > 0) {
    await supabase.storage.from('media').remove(paths);
  }

  // 2. Delete the profile — cascades to posts, likes, resonances, blocks, reports
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (profileError) throw profileError;
}

// ============================================
// Resonances (공명)
// ============================================

export async function getUnseenResonances(userId: string) {
  const { data, error } = await supabase
    .from('resonances')
    .select('id, user_a, user_b, post_a, post_b, seen, created_at')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq('seen', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function markResonanceSeen(resonanceId: string) {
  const { error } = await supabase.from('resonances').update({ seen: true }).eq('id', resonanceId);
  if (error) throw error;
}

export async function markAllResonancesSeen(userId: string) {
  const { error } = await supabase
    .from('resonances')
    .update({ seen: true })
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq('seen', false);
  if (error) throw error;
}

export async function checkAndCreateResonance(userId: string, likedPostId: string) {
  // 단일 RPC로 통합 — 5 RTT → 1 RTT.
  // 서버에서 auth.uid() == userId 검증 + ON CONFLICT race 차단.
  // RLS INSERT 정책이 없으므로 SECURITY DEFINER가 필수.
  const { data, error } = await supabase.rpc('check_and_create_resonance', {
    p_user_id: userId,
    p_liked_post_id: likedPostId,
  });
  if (error) {
    // 42501 = insufficient_privilege (user_id mismatch) — 위조 시도, 호출자에게 노출하지 않음
    if (error.code === '42501') return null;
    throw error;
  }
  return data?.[0] ?? null;
}
