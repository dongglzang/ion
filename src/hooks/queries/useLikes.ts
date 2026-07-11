import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { getMyLikedPostIds, likePost, unlikePost, checkAndCreateResonance } from '@/lib/supabase';

export function useLikedIdsQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.likedIds(userId),
    queryFn: () => getMyLikedPostIds(userId),
    enabled: !!userId,
  });
}

export function useToggleLike(userId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.likedIds(userId);

  return useMutation({
    mutationFn: async ({ postId, wasLiked }: { postId: string; wasLiked: boolean }) => {
      if (wasLiked) {
        await unlikePost(userId, postId);
      } else {
        await likePost(userId, postId);
        // Check for resonance after liking
        try {
          const resonance = await checkAndCreateResonance(userId, postId);
          if (resonance) {
            queryClient.invalidateQueries({ queryKey: queryKeys.resonances(userId) });
          }
        } catch (err) {
          // RPC가 깨지면 사용자가 mutual connection 알림을 못 받으므로
          // dev/QA가 인지. 좋아요 자체는 저장되었으므로 block하지 않음.
          console.warn('[useToggleLike] resonance check failed', err);
        }
      }
    },
    onMutate: async ({ postId, wasLiked }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<string[]>(key);
      queryClient.setQueryData<string[]>(key, (old = []) =>
        wasLiked ? old.filter(id => id !== postId) : [...old, postId]
      );
      return { prev };
    },
    onError: (err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(key, context.prev);
      // 낙관적 업데이트가 롤백되어도 사용자에겐 "꺼졌다"로만 보임.
      // 명시적 피드백 없이는 네트워크 실패와 자기 의도취소를 구분 못 함.
      console.warn('[useToggleLike] like toggle failed', err);
      toast.error('좋아요 저장에 실패했어요.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
