import { useState, useEffect, useMemo, startTransition, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { useFeedQuery, useDismissPost, useRefetchFeed } from '@/hooks/queries/useFeed';
import { useLikedIdsQuery, useToggleLike } from '@/hooks/queries/useLikes';
import { useCreatePost } from '@/hooks/queries/useMyPosts';
import { FeedView } from '@/components/FeedView';
import { FeedSkeleton } from '@/components/ui/skeleton';
import { ZoomSlider } from '@/components/ZoomSlider';
import { LoginModal } from '@/components/LoginModal';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { useI18n } from '@/i18n';
import { useImageCropper } from '@/hooks/useImageCropper';
import { SystemOrbitStrip } from '@/components/SystemOrbitStrip';
import { useSystems } from '@/hooks/queries/useSystems';

// 모달은 사용자 명시적 액션으로만 열림 → lazy 청크로 분리.
// CreateStoryModal/CreateSystemModal/ExpandedCard: 명시적 액션 후에만 열림 → lazy.
const CreateStoryModal = lazy(() =>
  import('@/components/CreateStoryModal').then((m) => ({ default: m.CreateStoryModal }))
);
const CreateSystemModal = lazy(() =>
  import('@/components/CreateSystemModal').then((m) => ({ default: m.CreateSystemModal }))
);
const ExpandedCard = lazy(() =>
  import('@/components/ExpandedCard').then((m) => ({ default: m.ExpandedCard }))
);

export function FeedRoute({
  systemId,
  activeSystemSlug,
}: {
  systemId?: string | null;
  activeSystemSlug?: string | null;
} = {}) {
  const { t } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const userId = user?.id ?? '';
  const authorName = user?.displayName ?? '';

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [createSystemOpen, setCreateSystemOpen] = useState(false);
  const [createStoryModalOpen, setCreateStoryModalOpen] = useState(false);

  const { requestCrop, CropModal } = useImageCropper();

  useEffect(() => {
    if (location.state?.showLogin) {
      startTransition(() => {
        setLoginModalOpen(true);
      });
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // 항성계: 라우트 systemId 가 있으면 그 항성계, 없으면 기본(free). 비로그인도 동일.
  const { data: systems = [] } = useSystems();
  // 카드 5~15개가 매번 useSystems() 를 호출하지 않도록 부모에서 1회만 Map 구성.
  // systems 가 변할 때만 재계산 — 카드 props 안정성 유지.
  const systemsById = useMemo(
    () => new Map(systems.map((s) => [s.id, s])),
    [systems]
  );
  const defaultSystemId = systems.find((s) => s.isDefault)?.id;
  const currentSystemId = systemId ?? defaultSystemId ?? '';

  const { data: posts = [], isLoading: feedLoading, isError, refetch } = useFeedQuery(userId, currentSystemId || null);
  const { data: likedIds = [] } = useLikedIdsQuery(userId);
  const dismissPost = useDismissPost(userId, currentSystemId || null);
  const refetchFeed = useRefetchFeed(userId, currentSystemId || null);
  const { mutate: toggleLike } = useToggleLike(userId);
  const { mutateAsync: createPostMutate } = useCreatePost(userId, authorName);

  const isLoggedIn = !!user;
  const expandedPost = expandedPostId ? posts.find(p => p.id === expandedPostId) ?? null : null;

  const handleToggleLike = (postId: string) => {
    if (!isLoggedIn) { setLoginModalOpen(true); return; }
    const wasLiked = likedIds.includes(postId);
    toggleLike({ postId, wasLiked });
  };

  const handleDismiss = (postId: string) => {
    dismissPost(postId);
  };

  const handleCreatePostClick = () => {
    if (!isLoggedIn) {
      setLoginModalOpen(true);
      return;
    }
    // 스토리가 단일 피드 타입. 분기 시트 없이 직접 연다.
    setCreateStoryModalOpen(true);
  };

  const handleCardClick = (post: { id: string }) => {
    setExpandedPostId(post.id);
  };

  if (authLoading || feedLoading) {
    return <FeedSkeleton />;
  }

  if (isError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t('feedRoute.failed')}</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-accent text-accent-foreground rounded-xl">
            {t('feedRoute.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SystemOrbitStrip
        activeSystemSlug={activeSystemSlug ?? null}
        onCreateSystem={isLoggedIn ? () => setCreateSystemOpen(true) : undefined}
      />
      <main className="pt-14 sm:pt-[64px] w-full h-screen relative flex">
        <FeedView
          posts={posts}
          onCardClick={handleCardClick}
          onDelete={handleDismiss}
          onCreatePostClick={handleCreatePostClick}
          expandedPostId={expandedPostId}
          onRefetch={refetchFeed}
          likedIds={likedIds}
          onToggleLike={handleToggleLike}
          systemsById={systemsById}
        />
      </main>
      <Suspense fallback={null}>
        <CreateSystemModal open={createSystemOpen} onOpenChange={setCreateSystemOpen} creatorId={userId} />
      </Suspense>
      <ZoomSlider />
      <FloatingActionButton onClick={handleCreatePostClick} />

      <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
      <Suspense fallback={null}>
        <CreateStoryModal
          open={createStoryModalOpen}
          onOpenChange={setCreateStoryModalOpen}
          onSubmit={async (opts) => {
            await createPostMutate({
              mediaFile: opts.mediaFile,
              bgColor: opts.bgColor,
              systemId: currentSystemId,
              overlays: opts.overlays,
            });
          }}
          requestImageCrop={requestCrop}
          defaultSystemId={currentSystemId}
        />
      </Suspense>
      {CropModal}

      <Suspense fallback={null}>
        <ExpandedCard
          open={expandedPost !== null}
          onClose={() => setExpandedPostId(null)}
          post={expandedPost}
          isLiked={expandedPost ? likedIds.includes(expandedPost.id) : false}
          onToggleLike={() => expandedPost && handleToggleLike(expandedPost.id)}
        />
      </Suspense>
    </>
  );
}
