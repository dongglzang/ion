import { FeedPhysics } from './FeedPhysics';
import { FeedCards } from './FeedCards';
import { EmptyFeedState } from '@/components/EmptyFeedState';
import type { Post, System } from '@/types';

interface FeedViewProps {
  posts: Post[];
  onCardClick: (post: Post) => void;
  onDelete: (postId: string) => void;
  onCreatePostClick: () => void;
  expandedPostId?: string | null;
  onRefetch: () => void;
  likedIds?: string[];
  onToggleLike?: (postId: string) => void;
  /** systemId → System 매핑. FeedRoute에서 useSystems 1회 결과를 전달. */
  systemsById?: Map<string, System>;
}

export function FeedView(props: FeedViewProps) {
  if (props.posts.length === 0) {
    return <EmptyFeedState onCreatePost={props.onCreatePostClick} />;
  }

  return (
    <div className="fixed inset-0 select-none">
      <FeedPhysics posts={props.posts} />
      <FeedCards
        posts={props.posts}
        onCardClick={props.onCardClick}
        onDelete={props.onDelete}
        expandedPostId={props.expandedPostId}
        likedIds={props.likedIds}
        onToggleLike={props.onToggleLike}
        systemsById={props.systemsById}
      />
      <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-10 flex justify-center">
        <span className="px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/40 text-[11px] text-muted-foreground shadow-sm">
          ↑ 위 · ← 제외 · ♡ 좋아요
        </span>
      </div>
    </div>
  );
}
