import { useRef, useCallback, useEffect } from 'react';
import type { Post, System } from '@/types';
import { positionStore } from '@/stores/positionStore';
import { OverlayRenderer } from '@/components/OverlayRenderer';
import { PlanetAvatar } from '@/components/PlanetAvatar';
import { renderSystemVisual } from '@/constants/stars';

interface PostCardProps {
  post: Post;
  x: number;
  y: number;
  size: number;
  opacity: number;
  isDragging: boolean;
  isDeleteMode?: boolean;
  isLiked: boolean;
  /** 부모에서 1회 fetch한 system 캐시. 카드가 5~15개 동시 렌더 시 useSystems() 중복 호출 제거. */
  system?: System;
  onClick: () => void;
  onToggleLike: () => void;
  onDelete?: () => void;
}

export function PostCard({
  post,
  x,
  y,
  size = 150,
  opacity,
  isDragging,
  isDeleteMode,
  isLiked,
  system,
  onClick,
  onToggleLike,
  onDelete,
}: PostCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const prevDragRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const currentRotationRef = useRef(0);
  const targetRotationRef = useRef(0);
  const rotationFrameRef = useRef<number | undefined>(undefined);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const nearEdgeRef = useRef<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const systemVisual = system && !system.isDefault ? renderSystemVisual(system.palette) : null;

  function animateRotation() {
    const diff = targetRotationRef.current - currentRotationRef.current;
    if (Math.abs(diff) < 0.1) {
      currentRotationRef.current = targetRotationRef.current;
      containerRef.current?.style.setProperty(
        '--drag-rotation',
        `${currentRotationRef.current}deg`,
      );
      rotationFrameRef.current = undefined;
      return;
    }
    currentRotationRef.current += diff * 0.15;
    containerRef.current?.style.setProperty(
      '--drag-rotation',
      `${currentRotationRef.current}deg`,
    );
    rotationFrameRef.current = requestAnimationFrame(animateRotation);
  }

  const startRotationAnim = useCallback(
    (target: number) => {
      targetRotationRef.current = target;
      if (!rotationFrameRef.current) {
        rotationFrameRef.current = requestAnimationFrame(animateRotation);
      }
    },
    [animateRotation],
  );

  useEffect(() => {
    return () => {
      if (rotationFrameRef.current) cancelAnimationFrame(rotationFrameRef.current);
    };
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;

      clearLongPress();
      isDraggingRef.current = true;
      hasMovedRef.current = false;
      nearEdgeRef.current = null;

      dragOffsetRef.current = { x: e.clientX - x, y: e.clientY - y };
      dragStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      prevDragRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

      positionStore.setDragging(post.id);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      longPressTimerRef.current = setTimeout(() => {
        if (isDraggingRef.current) {
          positionStore.setDeleteMode(post.id);
        }
      }, 600);
    },
    [post.id, x, y, clearLongPress],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;

      const now = Date.now();
      const newX = e.clientX;
      const newY = e.clientY;

      if (dragStartRef.current) {
        const dx = newX - dragStartRef.current.x;
        const dy = newY - dragStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          hasMovedRef.current = true;
          clearLongPress();
        }
      }

      const rawCenterX = newX - dragOffsetRef.current.x;
      const rawCenterY = newY - dragOffsetRef.current.y;
      let centerX = rawCenterX;
      let centerY = rawCenterY;

      const TOP_OFFSET = 72;
      const minX = size / 2;
      const maxX = window.innerWidth - size / 2;
      const minY = TOP_OFFSET + size / 2;
      const maxY = window.innerHeight - size / 2;
      centerX = Math.max(minX, Math.min(maxX, centerX));
      centerY = Math.max(minY, Math.min(maxY, centerY));

      if (rawCenterX < minX) nearEdgeRef.current = 'left';
      else if (rawCenterX > maxX) nearEdgeRef.current = 'right';
      else if (rawCenterY < minY) nearEdgeRef.current = 'top';
      else if (rawCenterY > maxY) nearEdgeRef.current = 'bottom';
      else nearEdgeRef.current = null;

      if (prevDragRef.current) {
        const dt = Math.max(1, now - prevDragRef.current.time);
        const vx = ((newX - prevDragRef.current.x) / dt) * 16;
        const vy = ((newY - prevDragRef.current.y) / dt) * 16;
        positionStore.setDragVelocity(post.id, vx, vy);

        const targetRotation = Math.max(-12, Math.min(12, vx * 3));
        startRotationAnim(targetRotation);
      }

      prevDragRef.current = { x: newX, y: newY, time: now };
      positionStore.updateSinglePosition(post.id, centerX, centerY);
    },
    [post.id, clearLongPress, startRotationAnim],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;

      clearLongPress();
      isDraggingRef.current = false;

      const edge = nearEdgeRef.current;
      if (hasMovedRef.current && edge) {
        const edgeDir: Record<
          'left' | 'right' | 'top' | 'bottom',
          { vx: number; vy: number }
        > = {
          left: { vx: -1, vy: 0 },
          right: { vx: 1, vy: 0 },
          top: { vx: 0, vy: -1 },
          bottom: { vx: 0, vy: 1 },
        };
        const dir = edgeDir[edge];
        const vel = positionStore.getDragVelocity(post.id) ?? { vx: 0, vy: 0 };
        positionStore.markForDismissal(
          post.id,
          dir.vx * 4 + vel.vx * 0.3,
          dir.vy * 4 + vel.vy * 0.3,
        );
        positionStore.setDragging(null);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        return;
      }

      const deleteModeId = positionStore.getDeleteModeId();
      if (deleteModeId === post.id) {
        positionStore.setDragging(null);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        return;
      }

      positionStore.setDragging(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      if (!hasMovedRef.current) {
        onClick();
      }

      nearEdgeRef.current = null;
      startRotationAnim(0);
    },
    [post.id, onClick, clearLongPress, startRotationAnim],
  );

  const cardBorderStyle: React.CSSProperties = isDeleteMode
    ? { boxShadow: '0 0 0 2px oklch(var(--destructive)), var(--shadow-md)' }
    : isDragging
      ? { boxShadow: '0 0 0 1px oklch(var(--border)), var(--shadow-md)' }
      : { boxShadow: '0 0 0 1px oklch(var(--border)), var(--shadow-md)' };

  return (
    <div
      ref={containerRef}
      className={`group absolute pointer-events-auto select-none ${isDragging ? 'cursor-grabbing z-10' : 'cursor-grab'}`}
      style={{
        width: size,
        height: size,
        left: 0,
        top: 0,
        '--drag-rotation': `${currentRotationRef.current}deg`,
        transform: `translate3d(${x - size / 2}px, ${y - size / 2}px, 0) scale(${isDragging ? 1.05 : 1}) rotate(var(--drag-rotation, 0deg))`,
        opacity,
        transition: 'box-shadow 0.3s ease',
        touchAction: 'none',
        willChange: 'transform',
      } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => positionStore.setHovered(post.id)}
      onMouseLeave={() => positionStore.setHovered(null)}
    >
      <div
        className="w-full h-full rounded-[20px] overflow-hidden relative"
        style={{ ...cardBorderStyle, backgroundColor: 'oklch(var(--surface-elevated))' }}
      >
        {post.media ? (
          <div className="absolute inset-0">
            {post.mediaType === 'video' ? (
              <>
                <video
                  src={post.media}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  playsInline
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-foreground/70 backdrop-blur-sm flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-background ml-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </>
            ) : (
              <img
                src={post.media}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            )}
            {post.overlays && post.overlays.length > 0 && (
              <OverlayRenderer overlays={post.overlays} />
            )}
          </div>
        ) : post.bgColor ? (
          <div
            className="absolute inset-0"
            style={{ background: post.bgColor }}
          >
            {systemVisual && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/45 backdrop-blur-sm pointer-events-none max-w-[70%]">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: systemVisual.gradient }} />
                <span className="text-[10px] text-white/90 truncate">{system?.name}</span>
              </div>
            )}
            {post.overlays && post.overlays.length > 0 && (
              <OverlayRenderer overlays={post.overlays} />
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pt-9">
            {systemVisual && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/45 backdrop-blur-sm pointer-events-none max-w-[70%]">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: systemVisual.gradient }} />
                <span className="text-[10px] text-white/90 truncate">{system?.name}</span>
              </div>
            )}
            {post.overlays && post.overlays.length > 0 && (
              <OverlayRenderer overlays={post.overlays} />
            )}
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike();
          }}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md z-10 active:scale-[0.85] focus-visible:opacity-100 transition-opacity duration-150 ${isLiked ? 'opacity-100' : 'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100'}"
          style={{
            backgroundColor: isLiked ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.32)',
          }}
          aria-label="like"
        >
          <svg
            className="w-4 h-4 transition-[fill,stroke] duration-200"
            style={{
              fill: isLiked ? '#ec4899' : 'none',
              stroke: '#ffffff',
            }}
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            bottom: Math.round(size * 0.03),
            left: Math.round(size * 0.05),
          }}
          aria-hidden
        >
          <PlanetAvatar
            planetSeed={post.authorPlanetSeed}
            fallbackUserId={post.authorId}
            size={Math.max(24, Math.min(48, Math.round(size * 0.22)))}
            flat
          />
        </div>
        {isDeleteMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-[hsl(5,65%,48%)] text-white rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-all duration-200 z-20 active:scale-90"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isDragging && nearEdgeRef.current && (
        <>
          {nearEdgeRef.current === 'left' && (
            <div
              className="fixed inset-y-0 left-0 w-20 pointer-events-none z-20"
              style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.18), transparent 70%)' }}
            />
          )}
          {nearEdgeRef.current === 'right' && (
            <div
              className="fixed inset-y-0 right-0 w-20 pointer-events-none z-20"
              style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.18), transparent 70%)' }}
            />
          )}
          {nearEdgeRef.current === 'top' && (
            <div
              className="fixed inset-x-0 top-0 h-20 pointer-events-none z-20"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.18), transparent 70%)' }}
            />
          )}
          {nearEdgeRef.current === 'bottom' && (
            <div
              className="fixed inset-x-0 bottom-0 h-20 pointer-events-none z-20"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.18), transparent 70%)' }}
            />
          )}
        </>
      )}
    </div>
  );
}
