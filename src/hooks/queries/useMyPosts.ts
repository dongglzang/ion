import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getUserPosts, createPost, deletePost as deletePostDb, uploadMedia } from '@/lib/supabase';
import { toPost } from '@/lib/mappers';
import type { Post, Overlay, System } from '@/types';

export function useMyPostsQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.myPosts(userId),
    queryFn: async () => {
      const rows = await getUserPosts(userId);
      return rows.map(toPost);
    },
    enabled: !!userId,
  });
}

export function useCreatePost(userId: string, authorName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opts: { mediaFile?: File; bgColor?: string; systemId: string; overlays?: Overlay[] }) => {
      let mediaUrl: string | undefined;
      let mediaType: 'image' | 'video' | undefined;

      if (opts.mediaFile) {
        const result = await uploadMedia(opts.mediaFile, userId);
        mediaUrl = result.url;
        mediaType = result.type;
      }

      const row = await createPost({
        author_id: userId,
        bg_color: opts.bgColor,
        media_url: mediaUrl,
        media_type: mediaType,
        system_id: opts.systemId,
        overlays: opts.overlays,
      });

      // createPost 반환엔 system slug/name 이 없으므로 systems 캐시에서 해석.
      // 캐시 미스면 undefined(옵션) — myPosts 리패치로 보정.
      const systems = queryClient.getQueryData<System[]>(queryKeys.systems()) ?? [];
      const sys = systems.find((s) => s.id === opts.systemId);

      // 작성자의 행성은 useProfile 캐시에서 해석 (낙관적 표시 시 깜빡임 방지).
      // 캐시 미스 시 마이페이지 리패치로 보정. 'moon' 폴백은 행성 미선택 사용자.
      const profile = queryClient.getQueryData<{ planet?: string }>(queryKeys.profile(userId));
      const overlays = Array.isArray(row.overlays) ? (row.overlays as Overlay[]) : undefined;

      return {
        id: row.id,
        authorId: row.author_id,
        authorName,
        authorPlanet: (profile?.planet as Post['authorPlanet']) ?? 'moon',
        bgColor: row.bg_color ?? undefined,
        media: row.media_url ?? undefined,
        mediaType: row.media_type ?? undefined,
        overlays,
        createdAt: row.created_at,
        systemId: opts.systemId,
        systemSlug: sys?.slug,
        systemName: sys?.name,
      } satisfies Post;
    },
    onSuccess: (newPost) => {
      // myPosts에 낙관적 추가
      queryClient.setQueryData<Post[]>(queryKeys.myPosts(userId), (old = []) => [
        newPost,
        ...old,
      ]);
      // 새 글은 특정 항성계에 속함 → 전역(NULL) + 해당 항성계 피드 모두 무효화.
      // 부분 키 ['feed', userId] 로 모든 system 변형 매칭.
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
    },
  });
}

export function useDeletePost(userId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.myPosts(userId);

  return useMutation({
    mutationFn: (postId: string) => deletePostDb(postId, userId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Post[]>(key);
      queryClient.setQueryData<Post[]>(key, (old = []) =>
        old.filter(p => p.id !== postId)
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(key, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed(userId) });
    },
  });
}

