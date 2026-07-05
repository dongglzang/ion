import { useSyncExternalStore, useCallback, useEffect } from 'react';
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
  /** systemId → System 매핑. 부모에서 useSystems() 1회 호출 결과를 전달. */
  systemsById?: Map<string, System>;
}

export function FeedCards({ posts, onCardClick, onDelete, expandedPostId, likedIds = [], onToggleLike, systemsById }: FeedCardsProps) {
  const positions = useSyncExternalStore(
    positionStore.subscribe,
    positionStore.getSnapshot
  );
  const deleteModeId = positions.length > 0 ? positionStore.getDeleteModeId() : null;

  const handleDelete = useCallback((posId: string) => {
    onDelete(posId);
    positionStore.setDeleteMode(null);
  }, [onDelete]);

  // edge-drag dismiss 감시 (FeedPhysics가 처리 완료 후 notify → 여기서 onDelete)
  useEffect(() => {
    const id = positionStore.consumePendingDataDelete();
    if (id) onDelete(id);
  });

  if (positions.length === 0) return null;

  return (
    <div className="fixed inset-0 select-none z-20">
      {positions.map((pos) => {
        const post = posts.find((p) => p.id === pos.id);
        if (!post) return null;

        // 확장 모달로 열린 카드는 캔버스에서 숨김 (모달과 이중 표시 방지).
        if (expandedPostId && pos.id === expandedPostId) return null;

        return (
          <PostCard
            key={pos.id}
            post={post}
            x={pos.x}
            y={pos.y}
            size={pos.size}
            opacity={pos.opacity}
            isDragging={pos.isDragging}
            isDeleteMode={deleteModeId === pos.id}
            isLiked={likedIds.includes(post.id)}
            system={post.systemId ? systemsById?.get(post.systemId) : undefined}
            onClick={() => onCardClick(post, { x: pos.x, y: pos.y, size: pos.size })}
            onToggleLike={() => onToggleLike?.(post.id)}
            onDelete={() => handleDelete(pos.id)}
          />
        );
      })}
    </div>
  );
}
