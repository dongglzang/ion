import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSystemBySlug } from '@/hooks/queries/useSystems';
import { FeedRoute } from '@/routes/FeedRoute';
import { FeedSkeleton } from '@/components/ui/skeleton';

/**
 * /s/:slug — 항성계 전용 피드. slug → system 해석 후 FeedRoute 에 systemId 주입.
 * 알 수 없는 slug 는 전역 피드(/)로 안내 토스트와 함께.
 */
export function SystemRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { data: system, isLoading, isError } = useSystemBySlug(slug);

  const notFound = !isLoading && !isError && !system;

  useEffect(() => {
    if (notFound) {
      toast.error('알 수 없는 항성계입니다');
    }
  }, [notFound]);

  if (isLoading) return <FeedSkeleton />;
  if (!system || isError) return <Navigate to="/" replace />;

  return <FeedRoute systemId={system.id} activeSystemSlug={system.slug} />;
}
