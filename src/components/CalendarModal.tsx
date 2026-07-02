import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { CalendarPage } from '@/components/CalendarPage';
import { Calendar as CalendarIcon, ChevronLeft, X } from 'lucide-react';
import { useAuth } from '@/hooks/AuthProvider';
import { useMyPostsQuery, useDeletePost, useUpdatePost, useCreatePost } from '@/hooks/queries/useMyPosts';
import { CreatePostModal } from '@/components/CreatePostModal';
import { useImageCropper } from '@/hooks/useImageCropper';
import { Button } from '@/components/ui/button';
import type { Post } from '@/types';

type View = 'month' | 'detail' | 'expanded';

interface CalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarModal({ open, onOpenChange }: CalendarModalProps) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [view, setView] = useState<View>('month');
  const [, setSelectedPost] = useState<Post | null>(null);
  const { requestCrop, CropModal } = useImageCropper();

  const { data: posts = [], refetch } = useMyPostsQuery(userId);
  const { mutate: deletePostMutate } = useDeletePost(userId);
  const { mutateAsync: updatePostMutate } = useUpdatePost(userId);
  const { mutateAsync: createPostMutate } = useCreatePost(userId, user?.displayName ?? '');

  const handleBack = () => {
    if (view === 'expanded') {
      setSelectedPost(null);
      setView('detail');
    } else if (view === 'detail') {
      setView('month');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setView('expanded');
  };

  const handleDeletePost = (postId: string) => {
    deletePostMutate(postId);
    setView('detail');
    setSelectedPost(null);
  };

  const handleUpdatePost = async (postId: string, opts: { content: string; mediaFile?: File }) => {
    await updatePostMutate({ postId, ...opts });
    refetch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-h-[820px] w-[calc(100vw-1rem)] max-w-[640px] flex-col gap-0 overflow-hidden rounded-2xl border-border/50 bg-card/95 p-0 shadow-glow backdrop-blur-xl sm:w-[calc(100vw-2rem)] sm:rounded-3xl">
        <DialogHeader className="flex shrink-0 items-center justify-between border-b border-border/30 px-5 py-2.5">
          {/* 좌측: 월간=없음, 일간/확장=뒤로가기 (좌측끝) */}
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

          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
            <CalendarIcon className="h-[15px] w-[15px] text-accent" />
          </div>

          {/* 우측: 일간/확장에서만 X 닫기 */}
          {view !== 'month' ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <X className="h-[18px] w-[18px]" />
            </Button>
          ) : (
            <div className="w-9 shrink-0" />
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1">
          {user && (
            <CalendarPage
              posts={posts}
              view={view}
              onViewChange={setView}
              onDeletePost={handleDeletePost}
              onUpdatePost={handleUpdatePost}
              onWritePost={() => setCreatePostOpen(true)}
              onPostClick={handlePostClick}
              currentUserId={userId}
            />
          )}
        </div>
      </DialogContent>
      <CreatePostModal
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        onSubmit={async (opts) => {
          await createPostMutate(opts);
          refetch();
        }}
        requestImageCrop={requestCrop}
      />
      {CropModal}
    </Dialog>
  );
}
