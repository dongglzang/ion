import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // feed_random RPC는 ORDER BY random() → 탭 복귀마다 카드가 통째로
      // 바뀌는 UX 혼란. 신선도보다 안정성을 우선해 비활성.
      // (세계 그래프·좋아요 등 핵심 데이터는 다음 상호작용에서 fresh로 전환)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
