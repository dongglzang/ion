import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { CalendarPage } from '@/components/CalendarPage';
import { Calendar as CalendarIcon, ChevronLeft, X } from 'lucide-react';
import { useAuth } from '@/hooks/AuthProvider';
import { useMyPostsQuery, useDeletePost, useCreatePost } from '@/hooks/queries/useMyPosts';
import { useSystems } from '@/hooks/queries/useSystems';
import { CreateStoryModal } from '@/components/CreateStoryModal';
import { useImageCropper } from '@/hooks/useImageCropper';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Post } from '@/types';
type View = 'month' | 'day' | 'post-detail';

const VIEW_TITLES: Record<View, { label: string; parent?: View }> = {
  month: { label: '달력' },
  day: { label: '하루', parent: 'month' },
  'post-detail': { label: '게시물', parent: 'day' },
};

interface CalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarModal({ open, onOpenChange }: CalendarModalProps) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [view, setView] = useState<View>('month');
  const [, setSelectedPost] = useState<Post | null>(null);

  const { requestCrop } = useImageCropper();

  const { data: posts = [], refetch } = useMyPostsQuery(userId);

  const { mutate: deletePostMutate } = useDeletePost(userId);
  const { mutateAsync: createPostMutate } = useCreatePost(userId, user?.displayName ?? '');
  const { data: systems = [] } = useSystems();
  const defaultSystemId = systems.find((s) => s.isDefault)?.id ?? '';

  // 편집 흐름 제거됨. 캘린더는 열람/삭제/신규 작성만.
  const handleBack = () => {
    const parent = VIEW_TITLES[view].parent;
    if (parent) {
      if (view === 'post-detail') setSelectedPost(null);
      setView(parent);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setView('post-detail');
  };

  const handleDeletePost = (postId: string) => {
    deletePostMutate(postId);
    setView('day');
    setSelectedPost(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-h-[820px] w-[calc(100vw-1rem)] max-w-[640px] flex-col gap-0 overflow-hidden rounded-2xl border-border/50 bg-card/95 p-0 shadow-glow backdrop-blur-xl sm:w-[calc(100vw-2rem)] sm:rounded-3xl">
        <DialogHeader className="flex shrink-0 items-center justify-between border-b border-border/30 px-5 py-2.5">
          {/* 좌측: month가 아니면 뒤로가기 */}
          {view !== 'month' ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Back"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </Button>
          ) : (
            <div className="w-9 shrink-0" />
          )}

          {/* 중앙: breadcrumb (현재 view 표시) */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
              <CalendarIcon className="h-[15px] w-[15px] text-accent" />
            </div>
            <span className={cn(
              'text-sm font-semibold',
              view !== 'month' ? 'text-foreground' : 'text-foreground/80'
            )}>
              {VIEW_TITLES[view].label}
            </span>
          </div>

          {/* 우측: 항상 X 닫기 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Close"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <X className="h-[18px] w-[18px]" />
          </Button>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          {user && (
            <CalendarPage
              posts={posts}
              view={view}
              onViewChange={setView}
              onDeletePost={handleDeletePost}
              onWritePost={() => setCreateStoryOpen(true)}
              onPostClick={handlePostClick}
              currentUserId={userId}
            />
          )}
        </div>
      </DialogContent>
      <CreateStoryModal
        open={createStoryOpen}
        onOpenChange={setCreateStoryOpen}
        onSubmit={async (opts) => {
          await createPostMutate({ mediaFile: opts.mediaFile, bgColor: opts.bgColor, systemId: defaultSystemId, overlays: opts.overlays });
          refetch();
        }}
        requestImageCrop={requestCrop}
      />
    </Dialog>
  );
}
