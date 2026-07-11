import { useRef, useCallback, useEffect, useLayoutEffect, memo } from 'react';
import { imageSrcSet, sizesAttr, transformUrl } from '@/lib/imageUrl';
import type { Post, System } from '@/types';
import { positionStore } from '@/stores/positionStore';
import { OverlayRenderer } from '@/components/OverlayRenderer';
import { PlanetAvatar } from '@/components/PlanetAvatar';
import { renderSystemVisual } from '@/constants/stars';

interface PostCardProps {
  post: Post;
  size?: number;
  isLiked: boolean;
  /** 부모에서 1회 fetch한 system 캐시. 카드가 5~15개 동시 렌더 시 useSystems() 중복 호출 제거. */
  system?: System;
  /** 클릭 시 positionStore에서 직접 read한 현재 위치를 함께 전달.
   *  FeedCards의 render 시점에 capture된 stale rect를 피하기 위함. */
  onClick: (rect: { x: number; y: number; size: number }) => void;
  onToggleLike: () => void;
  onDelete?: () => void;
}

/**
 * v2: ref-driven PostCard.
 *
 * - 위치/크기/투명도는 prop으로 안 받음. rAF 루프가 positionStore에서
 *   setPosition으로 갱신 → 자기 containerRef.style.transform/opacity 직접 set.
 *   React는 mount/unmount + 정적 props 변화(좋아요, system) 시에만 reconcile.
 * - isDragging / isDeleteMode 시각 효과(red border, cursor, z-index)는
 *   PostCard가 자기 ref에 직접 class/boxShadow/style.zIndex를 토글.
 *   rAF는 알지 못함 — setDragging 호출이 notify → PostCard가 subscribe로 받아
 *   자기 상태에 반영.
 * - 드래그 좌표는 PostCard의 setPointerCapture + onPointerMove가
 *   positionStore.setDragPos (non-notifying)로 직접 push. 다음 rAF tick이
 *   그 좌표를 읽어 자기 transform에 반영.
 */
export const PostCard = memo(function PostCard({
  post,
  size = 150,
  isLiked,
  system,
  onClick,
  onToggleLike,
  onDelete,
}: PostCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
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
  const isDeleteModeRef = useRef(false);
  const systemVisual = system && !system.isDefault ? renderSystemVisual(system.palette) : null;

  // === ref registry: rAF가 직접 set할 수 있도록 containerRef를 positionStore에 등록 ===
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // mount 시 초기 transform 즉시 set (rAF 첫 frame까지 깜빡임 방지)
    const pos = positionStore.getPosition(post.id);
    if (pos) {
      el.style.transform = `translate3d(${pos.x - pos.size / 2}px, ${pos.y - pos.size / 2}px, 0) scale(1) rotate(var(--drag-rotation, 0deg))`;
      el.style.opacity = String(pos.opacity);
    } else {
      el.style.opacity = '0';
    }
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    positionStore.registerCard(post.id, el);
    return () => {
      positionStore.unregisterCard(post.id);
    };
  }, [post.id, size]);

  // === isDeleteMode 시각 업데이트 (self-managed) ===
  useEffect(() => {
    const apply = (modeId: string | null) => {
      const active = modeId === post.id;
      isDeleteModeRef.current = active;
      const inner = innerRef.current;
      if (inner) {
        if (active) {
          inner.style.boxShadow = '0 0 0 2px oklch(var(--destructive)), var(--shadow-md)';
        } else if (isDraggingRef.current) {
          inner.style.boxShadow = '0 0 0 1px oklch(var(--border)), var(--shadow-md)';
        } else {
          inner.style.boxShadow = '0 0 0 1px oklch(var(--border)), var(--shadow-md)';
        }
      }
    };
    apply(positionStore.getDeleteModeId());
    return positionStore.subscribeDeleteMode(apply);
  }, [post.id]);

  // === isDragging 시각 업데이트 (self-managed) ===
  useEffect(() => {
    const apply = (id: string | null) => {
      const dragging = id === post.id;
      isDraggingRef.current = dragging;
      const el = containerRef.current;
      if (el) {
        el.classList.toggle('cursor-grabbing', dragging);
        el.classList.toggle('cursor-grab', !dragging);
        el.style.zIndex = dragging ? '10' : '1';
      }
      const inner = innerRef.current;
      if (inner) {
        if (isDeleteModeRef.current) {
          inner.style.boxShadow = '0 0 0 2px oklch(var(--destructive)), var(--shadow-md)';
        } else if (dragging) {
          inner.style.boxShadow = '0 0 0 1px oklch(var(--border)), var(--shadow-md)';
        } else {
          inner.style.boxShadow = '0 0 0 1px oklch(var(--border)), var(--shadow-md)';
        }
      }
    };
    apply(positionStore.getDraggingId());
    return positionStore.subscribeDragging(apply);
  }, [post.id]);

  // === hover 시각 업데이트 (z-index만 살짝 올림) ===
  useEffect(() => {
    const apply = (id: string | null) => {
      const el = containerRef.current;
      if (!el) return;
      if (id === post.id && !isDraggingRef.current) {
        el.style.zIndex = '5';
      } else if (!isDraggingRef.current) {
        el.style.zIndex = '1';
      }
    };
    apply(positionStore.getHoveredId());
    return positionStore.subscribeHovered(apply);
  }, [post.id]);

  function animateRotation() {
    const diff = targetRotationRef.current - currentRotationRef.current;
    if (Math.abs(diff) < 0.1) {
      currentRotationRef.current = targetRotationRef.current;
      if (containerRef.current) {
        containerRef.current.style.setProperty('--drag-rotation', `${currentRotationRef.current}deg`);
      }
      rotationFrameRef.current = undefined;
      return;
    }
    currentRotationRef.current += diff * 0.18;
    if (containerRef.current) {
      containerRef.current.style.setProperty('--drag-rotation', `${currentRotationRef.current}deg`);
    }
    rotationFrameRef.current = requestAnimationFrame(animateRotation);
  }

  const startRotationAnim = useCallback(
    (target: number) => {
      targetRotationRef.current = target;
      if (rotationFrameRef.current === undefined) {
        rotationFrameRef.current = requestAnimationFrame(animateRotation);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (rotationFrameRef.current !== undefined) {
        cancelAnimationFrame(rotationFrameRef.current);
      }
    };
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 좋아요 버튼 클릭이 포인터 이벤트를 가로채면 카드 드래그 시작 안 함
      const target = e.target as HTMLElement;
      if (target.closest('button, a, [role="button"]')) return;
      if (e.button !== 0) return;

      const pos = positionStore.getPosition(post.id);
      if (!pos) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      hasMovedRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      prevDragRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        // 350ms 누름 → 삭제 모드 진입 (long-press). 드래그 시작 안 함.
        longPressTimerRef.current = null;
        positionStore.setDeleteMode(post.id);
      }, 350);
    },
    [post.id, clearLongPress],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!hasMovedRef.current && dist > 4) {
        hasMovedRef.current = true;
        clearLongPress();
        positionStore.setDeleteMode(null);
        positionStore.setDragging(post.id);
        const pos = positionStore.getPosition(post.id);
        if (pos) {
          dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }
      }

      if (hasMovedRef.current) {
        // 비-notifying 직접 쓰기. rAF가 다음 frame에서 읽어감.
        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;
        positionStore.setDragPos(post.id, newX, newY);

        // velocity 계산 (10ms 간격)
        const now = Date.now();
        if (prevDragRef.current) {
          const dt = now - prevDragRef.current.time;
          if (dt > 0) {
            const vx = (e.clientX - prevDragRef.current.x) / dt;
            const vy = (e.clientY - prevDragRef.current.y) / dt;
            positionStore.setDragVelocity(post.id, vx * 16, vy * 16);
          }
        }
        prevDragRef.current = { x: e.clientX, y: e.clientY, time: now };

        // 가장자리 감지 (release 시 dismiss 트리거용)
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (newX < 60) nearEdgeRef.current = 'left';
        else if (newX > w - 60) nearEdgeRef.current = 'right';
        else if (newY < 100) nearEdgeRef.current = 'top';
        else if (newY > h - 60) nearEdgeRef.current = 'bottom';
        else nearEdgeRef.current = null;
      }
    },
    [post.id, clearLongPress],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      clearLongPress();
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (isDraggingRef.current) {
        const velocity = positionStore.consumeDragVelocity(post.id);
        const vx = velocity?.vx ?? 0;
        const vy = velocity?.vy ?? 0;
        positionStore.setDragging(null);

        if (nearEdgeRef.current && (Math.abs(vx) > 1.2 || Math.abs(vy) > 1.2)) {
          const dir = nearEdgeRef.current;
          let ddvx = 0;
          let ddvy = 0;
          if (dir === 'left') ddvx = -15;
          else if (dir === 'right') ddvx = 15;
          else if (dir === 'top') ddvy = -15;
          else ddvy = 15;
          positionStore.markForDismissal(post.id, ddvx, ddvy);
        } else if (hasMovedRef.current) {
          // 일반 release: 회전 리셋
          startRotationAnim(0);
        }
      } else if (isDeleteModeRef.current) {
        positionStore.setDeleteMode(null);
        onDelete?.();
      } else {
        // 클릭 (이동 없음). 현재 위치는 mount 시점이 아니라 클릭 시점에 read.
        // FeedCards의 render 시점에 capture된 stale rect 회피.
        const clickPos = positionStore.getPosition(post.id);
        if (clickPos) onClick({ x: clickPos.x, y: clickPos.y, size: clickPos.size });
      }

      dragStartRef.current = null;
      prevDragRef.current = null;
      hasMovedRef.current = false;
      nearEdgeRef.current = null;
    },
    [post.id, onClick, onDelete, clearLongPress, startRotationAnim],
  );

  return (
    <div
      ref={containerRef}
      className="group absolute pointer-events-auto select-none cursor-grab"
      style={{
        left: 0,
        top: 0,
        width: size,
        height: size,
        touchAction: 'none',
        willChange: 'transform',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => positionStore.setHovered(post.id)}
      onPointerLeave={() => positionStore.setHovered(null)}
    >
      <div
        ref={innerRef}
        className="w-full h-full rounded-[20px] overflow-hidden relative"
        style={{ boxShadow: '0 0 0 1px oklch(var(--border)), var(--shadow-md)', backgroundColor: 'oklch(var(--surface-elevated))' }}
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
                  <svg className="w-4 h-4 dark:text-gray-100 text-black drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </>
            ) : (
              <img
                src={transformUrl(post.media, 640)}
                srcSet={imageSrcSet(post.media, { widths: [160, 320, 640, 960] })}
                sizes={sizesAttr(260)}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            )}
          </div>
        ) : post.bgColor ? (
          <div className="absolute inset-0" style={{ background: post.bgColor }} />
        ) : null}

        {post.overlays && post.overlays.length > 0 && (
          <OverlayRenderer overlays={post.overlays} />
        )}

        {systemVisual && (
          <div
            className="absolute inset-0 mix-blend-overlay pointer-events-none"
            style={{ opacity: 0.3, background: systemVisual.gradient }}
          />
        )}

        {post.systemId && system && !system.isDefault && (
          <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-foreground/70 text-background backdrop-blur-sm">
            {system.name}
          </span>
        )}

        {post.createdAt && (
          <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-foreground/70 text-background backdrop-blur-sm">
            {new Date(post.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* Bottom: author planet (top-right) + like button (bottom-right) */}
        {post.authorPlanetSeed !== undefined && (
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <PlanetAvatar planetSeed={post.authorPlanetSeed} size={20} />
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-1.5 right-1.5 z-10 w-7 h-7 rounded-full flex items-center justify-center bg-foreground/60 hover:bg-foreground/80 backdrop-blur-sm transition-all duration-200 active:scale-90"
          aria-label={isLiked ? '좋아요 취소' : '좋아요'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={isLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            className={isLiked ? 'text-rose-400' : 'text-background'}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* edge-drag gradient hint */}
        {nearEdgeRef.current && (
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
    </div>
  );
});
