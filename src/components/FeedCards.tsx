import { useEffect, useMemo } from 'react';
import type { Post, System } from '@/types';
import { positionStore } from '@/stores/positionStore';
import { PostCard } from './PostCard';

interface CardPosition {
  x: number;
  y: number;
  size: number;
}

interface FeedCardsProps {
  posts: Post[];
  onCardClick: (post: Post, cardRect: CardPosition) => void;
  onDelete: (postId: string) => void;
  expandedPostId?: string | null;
  likedIds?: string[];
  onToggleLike?: (postId: string) => void;
  systemsById?: Map<string, System>;
}

/**
 * v2: ref-driven. 60Hz re-render storm 제거.
 *
 * - useSyncExternalStore 제거. PostCard는 mount/unmount만.
 * - PostCard가 자기 containerRef를 positionStore에 등록, rAF가 직접 transform set.
 * - dismiss는 subscribePendingDelete 이벤트로 받음.
 */
export function FeedCards({
  posts,
  onCardClick,
  onDelete,
  expandedPostId,
  likedIds = [],
  onToggleLike,
  systemsById,
}: FeedCardsProps) {
  useEffect(() => {
    return positionStore.subscribePendingDelete((id) => {
      onDelete(id);
    });
  }, [onDelete]);

  const likedSet = useMemo(() => new Set(likedIds), [likedIds]);

  const handlers = useMemo(() => {
    const click = new Map<string, (rect: CardPosition) => void>();
    const toggle = new Map<string, () => void>();
    const del = new Map<string, () => void>();
    for (const post of posts) {
      click.set(post.id, (rect) => onCardClick(post, rect));
      toggle.set(post.id, () => onToggleLike?.(post.id));
      del.set(post.id, () => onDelete(post.id));
    }
    return { click, toggle, del };
  }, [posts, onCardClick, onToggleLike, onDelete]);

  return (
    <div className="fixed inset-0 select-none z-20">
      {posts.map((post) => {
        if (expandedPostId && post.id === expandedPostId) return null;
        const pos = positionStore.getPosition(post.id);
        const size = pos?.size;
        const clickHandler = handlers.click.get(post.id);
        const toggleHandler = handlers.toggle.get(post.id) ?? noop;
        const deleteHandler = handlers.del.get(post.id) ?? noop;
        return (
          <PostCard
            key={post.id}
            post={post}
            size={size}
            isLiked={likedSet.has(post.id)}
            system={post.systemId ? systemsById?.get(post.systemId) : undefined}
            onClick={() => {
              if (pos && clickHandler) clickHandler({ x: pos.x, y: pos.y, size: pos.size });
            }}
            onToggleLike={toggleHandler}
            onDelete={deleteHandler}
          />
        );
      })}
    </div>
  );
}

function noop() {}
