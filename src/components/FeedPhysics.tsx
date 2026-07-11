import { useEffect, useRef, useCallback } from 'react';
import { positionStore } from '@/stores/positionStore';
import { useClient } from '@/hooks/ClientProvider';
import { useDeviceSize, getCardCountForViewport, getDynamicCardSize } from '@/hooks/useDeviceSize';
import type { Post } from '@/types';

// 피드 카드 상단 오프셋 = 헤더(56 mobile / 64 sm) + 항성계 오비트 스트립(64) + 여백.
const TOP_OFFSET = 136;
const MAX_VELOCITY = 20;
const FRICTION = 0.9985;
const MIN_SPEED = 1.5;
const HOVER_FRICTION = 0.92;
const HOVER_MIN_SPEED = 0.3;
const BOUNCE_RETENTION = 0.85;

interface FloatingNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  targetOpacity: number;
  dismissing: boolean;
  entering: boolean;
}

interface FeedPhysicsProps {
  posts: Post[];
}

/**
 * v2: rAF가 직접 DOM transform/opacity를 set. React 깨우지 않음.
 *
 * - positionStore.setPosition (non-notifying) + positionStore.getCard(id).style
 * - FeedCards가 60Hz로 re-render되던 useSyncExternalStore 경로 제거됨
 * - drag read-back: positionStore.getDragPos (non-notifying) — PostCard의
 *   pointermove가 setDragPos로 직접 push, rAF가 읽음
 */
export function FeedPhysics({ posts }: FeedPhysicsProps) {
  const { theme, zoomLevel } = useClient();
  const { width } = useDeviceSize();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<FloatingNode[]>([]);
  const animationRef = useRef<number | undefined>(undefined);
  const initializedRef = useRef(false);

  const isDarkMode = theme === 'black';
  const isDarkModeRef = useRef(isDarkMode);
  const postsRef = useRef(posts);
  const zoomLevelRef = useRef(zoomLevel);
  const widthRef = useRef(width);
  const lastDismissRef = useRef<{ x: number; y: number } | null>(null);
  const bgVarRef = useRef<string>(
    getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
  );

  useEffect(() => { isDarkModeRef.current = isDarkMode; }, [isDarkMode]);
  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => {
    bgVarRef.current = getComputedStyle(document.documentElement)
      .getPropertyValue('--background').trim();
  }, [theme]);

  const getCardSize = useCallback((zl: number): number => {
    return getDynamicCardSize(width, zl);
  }, [width]);

  const getBounds = useCallback((canvas: HTMLCanvasElement, nodeSize: number) => ({
    minX: nodeSize / 2,
    maxX: canvas.width - nodeSize / 2,
    minY: TOP_OFFSET + nodeSize / 2,
    maxY: canvas.height - nodeSize / 2,
  }), []);

  const clampPosition = (node: FloatingNode, canvas: HTMLCanvasElement) => {
    const b = getBounds(canvas, node.size);
    node.x = Math.max(b.minX, Math.min(b.maxX, node.x));
    node.y = Math.max(b.minY, Math.min(b.maxY, node.y));
  };

  const initNodes = useCallback((canvas: HTMLCanvasElement) => {
    if (initializedRef.current) return;
    const baseSize = getCardSize(zoomLevelRef.current);
    const maxCards = getCardCountForViewport(canvas.width, canvas.height, baseSize);
    const slicedPosts = postsRef.current.slice(0, maxCards);
    if (slicedPosts.length === 0) return;

    initializedRef.current = true;
    nodesRef.current = slicedPosts.map((post) => {
      const size = baseSize + Math.random() * 20;
      const b = getBounds(canvas, size);
      return {
        id: post.id,
        x: b.minX + Math.random() * (b.maxX - b.minX),
        y: b.minY + Math.random() * (b.maxY - b.minY),
        vx: (Math.random() - 0.5) * MIN_SPEED,
        vy: (Math.random() - 0.5) * MIN_SPEED,
        size,
        opacity: 0,
        targetOpacity: 1,
        dismissing: false,
        entering: false,
      };
    });
  }, [getCardSize, getBounds]);

  // === 메인 rAF 루프 ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    const handleResize = () => {
      resizeCanvas();
      nodesRef.current.forEach(node => clampPosition(node, canvas));
    };
    window.addEventListener('resize', handleResize);

    initNodes(canvas);

    const scheduleNext = () => {
      if (animationRef.current !== undefined) return;
      animationRef.current = requestAnimationFrame(animate);
    };
    const cancelNext = () => {
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };

    const animate = () => {
      animationRef.current = undefined;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bgVar = bgVarRef.current;
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, `oklch(${bgVar})`);
      gradient.addColorStop(1, `oklch(${bgVar})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // dismiss 처리
      const did = positionStore.getDismissedId();
      if (did) {
        const dn = nodesRef.current.find(n => n.id === did);
        if (dn && !dn.dismissing) {
          dn.dismissing = true;
          dn.targetOpacity = 0;
          const dir = positionStore.getDismissDirection();
          if (dir) { dn.vx = dir.vx * 0.3; dn.vy = dir.vy * 0.3; }
          lastDismissRef.current = { x: dn.x, y: dn.y };
          positionStore.consumeDismissedAndNotify(did);
        }
      }

      const draggingId = positionStore.getDraggingId();
      const hoveredId = positionStore.getHoveredId();

      nodesRef.current.forEach((node) => {
        const isDragged = node.id === draggingId;

        if (isDragged) {
          // PostCard의 pointermove가 setDragPos로 직접 push한 좌표를 읽음.
          // non-notifying. React 안 깨움.
          const dragPos = positionStore.getPosition(node.id);
          if (dragPos) {
            node.x = dragPos.x;
            node.y = dragPos.y;
          }
          node.vx = 0;
          node.vy = 0;
        } else {
          const releasedVelocity = positionStore.consumeDragVelocity(node.id);
          if (releasedVelocity) {
            const speed = Math.sqrt(releasedVelocity.vx ** 2 + releasedVelocity.vy ** 2);
            if (speed > MAX_VELOCITY) {
              const scale = MAX_VELOCITY / speed;
              node.vx = releasedVelocity.vx * scale;
              node.vy = releasedVelocity.vy * scale;
            } else {
              node.vx = releasedVelocity.vx;
              node.vy = releasedVelocity.vy;
            }
          } else if (node.vx === 0 && node.vy === 0) {
            // drag 중이었다면 release 시 velocity가 0이 아닐 수 있으나,
            // pointermove가 setPointerCapture 실패로 setDragVelocity를
            // 호출 못한 경우 (puppeteer 등) 또는 빠르게 멈춘 경우:
            // 영원히 멈춤. MIN_SPEED floor가 적용되도록 random initial kick.
            // (드래그 안 한 카드는 initNodes에서 MIN_SPEED kick를 받음.)
            node.vx = (Math.random() - 0.5) * MIN_SPEED * 2;
            node.vy = (Math.random() - 0.5) * MIN_SPEED * 2;
          }

          // Integrate velocity into position. SWAP silent-drop의 핵심
          // 함정: 이 2줄이 빠지면 velocity/friction/bounce가 계산되어도
          // 적용 안 됨 → 모든 카드가 정지.
          node.x += node.vx;
          node.y += node.vy;
          if (node.entering) {
            const b = getBounds(canvas, node.size);
            if (node.x >= b.minX && node.x <= b.maxX && node.y >= b.minY && node.y <= b.maxY) {
              node.entering = false;
            }
          }

          if (!node.dismissing && !node.entering) {
            const b = getBounds(canvas, node.size);

            if (node.x < b.minX) {
              node.x = b.minX;
              node.vx = Math.abs(node.vx) * BOUNCE_RETENTION;
            } else if (node.x > b.maxX) {
              node.x = b.maxX;
              node.vx = -Math.abs(node.vx) * BOUNCE_RETENTION;
            }
            if (node.y < b.minY) {
              node.y = b.minY;
              node.vy = Math.abs(node.vy) * BOUNCE_RETENTION;
            } else if (node.y > b.maxY) {
              node.y = b.maxY;
              node.vy = -Math.abs(node.vy) * BOUNCE_RETENTION;
            }

            const isHovered = node.id === hoveredId;
            const friction = isHovered ? HOVER_FRICTION : FRICTION;
            const minSpeed = isHovered ? HOVER_MIN_SPEED : MIN_SPEED;

            node.vx *= friction;
            node.vy *= friction;

            const currentSpeed = Math.sqrt(node.vx ** 2 + node.vy ** 2);
            if (currentSpeed > 0 && currentSpeed < minSpeed) {
              const scale = minSpeed / currentSpeed;
              node.vx *= scale;
              node.vy *= scale;
            }
          } else if (node.entering) {
            node.vx *= FRICTION;
            node.vy *= FRICTION;
          } else {
            node.vx *= 0.995;
            node.vy *= 0.995;
          }
        }

        node.opacity += (node.targetOpacity - node.opacity) * 0.08;
      });

      nodesRef.current = nodesRef.current.filter(n => !n.dismissing || n.opacity > 0.02);

      // === rAF → DOM 직접 쓰기 (React 우회) ===
      for (const node of nodesRef.current) {
        // positionStore에 최신 위치 push (다음 frame에서 read-back용, e.g. drag)
        positionStore.setPosition(node.id, {
          id: node.id,
          x: node.x,
          y: node.y,
          size: node.size,
          opacity: node.opacity,
          isDragging: node.id === draggingId,
        });
        // DOM ref 직접 set. PostCard가 자기 ref를 register해뒀음.
        const el = positionStore.getCard(node.id);
        if (el) {
          el.style.transform = `translate3d(${node.x - node.size / 2}px, ${node.y - node.size / 2}px, 0) scale(${node.id === draggingId ? 1.05 : 1}) rotate(var(--drag-rotation, 0deg))`;
          el.style.opacity = String(node.opacity);
        }
      }

      // dismissing 완료된 노드 정리
      for (const node of nodesRef.current) {
        if (node.dismissing && node.opacity <= 0.02) {
          // 노드 배열에서 제거 + positionStore에서도 제거
          positionStore.removePosition(node.id);
        }
      }
      nodesRef.current = nodesRef.current.filter(n => !(n.dismissing && n.opacity <= 0.02));

      scheduleNext();
    };

    scheduleNext();

    // resume: setDragging/setHovered/setDeleteMode/markForDismissal이 notify하면
    // 안전하게 rAF 재개. MIN_SPEED floor로 항상 떠다니므로 사실상 불필요하지만
    // 안전망으로 둠.
    const unsubscribe = positionStore.subscribe(() => {
      scheduleNext();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelNext();
      unsubscribe();
    };
  }, [initNodes, getBounds]);

  // === posts 변경 (dismiss 보충/새 카드 도착) ===
  useEffect(() => {
    if (!canvasRef.current || posts.length === 0) return;

    const canvas = canvasRef.current;
    const baseSize = getCardSize(zoomLevel);
    const maxCards = getCardCountForViewport(canvas.width, canvas.height, baseSize);
    const slicedPosts = posts.slice(0, maxCards);

    const existingIds = new Set(nodesRef.current.map(n => n.id));
    const postsToAdd = slicedPosts.filter(p => !existingIds.has(p.id));

    let usedDismiss = false;

    postsToAdd.forEach((post) => {
      const size = baseSize + Math.random() * 20;
      const lastDismiss = lastDismissRef.current;
      let spawnX: number;
      let spawnY: number;
      let spawnVx: number;
      let spawnVy: number;
      const b = getBounds(canvas, size);

      if (lastDismiss && !usedDismiss) {
        const dx = lastDismiss.x - canvas.width / 2;
        const dy = lastDismiss.y - canvas.height / 2;
        if (Math.abs(dx) > Math.abs(dy)) {
          spawnX = dx > 0 ? b.minX : b.maxX;
          spawnY = b.minY + Math.random() * (b.maxY - b.minY);
          spawnVx = dx > 0 ? MAX_VELOCITY * 0.4 : -MAX_VELOCITY * 0.4;
          spawnVy = (Math.random() - 0.5) * MAX_VELOCITY * 0.3;
        } else {
          spawnY = dy > 0 ? b.minY : b.maxY;
          spawnX = b.minX + Math.random() * (b.maxX - b.minX);
          spawnVy = dy > 0 ? MAX_VELOCITY * 0.4 : -MAX_VELOCITY * 0.4;
          spawnVx = (Math.random() - 0.5) * MAX_VELOCITY * 0.3;
        }
        usedDismiss = true;
      } else {
        spawnX = b.minX + Math.random() * (b.maxX - b.minX);
        spawnY = b.minY + Math.random() * (b.maxY - b.minY);
        spawnVx = (Math.random() - 0.5) * MIN_SPEED;
        spawnVy = (Math.random() - 0.5) * MIN_SPEED;
      }

      nodesRef.current.push({
        id: post.id,
        x: spawnX,
        y: spawnY,
        vx: spawnVx,
        vy: spawnVy,
        size,
        opacity: 0,
        targetOpacity: 1,
        dismissing: false,
        entering: true,
      });

      // 새 카드를 positionStore에 등록. PostCard가 mount되기 전이라도
      // rAF가 다음 frame에서 push.
      positionStore.setPosition(post.id, {
        id: post.id,
        x: spawnX,
        y: spawnY,
        size,
        opacity: 0,
        isDragging: false,
      });
    });

    lastDismissRef.current = null;

    nodesRef.current.forEach((node) => {
      if (!node.entering && !node.dismissing) clampPosition(node, canvas);
    });

    nodesRef.current = nodesRef.current.filter(node => node.opacity > 0.01 || node.targetOpacity > 0);
  }, [zoomLevel, posts, getCardSize, getBounds]);

  // zoom 변경 시 카드 크기 재조정
  useEffect(() => {
    if (!canvasRef.current) return;
    const baseSize = getCardSize(zoomLevel);
    nodesRef.current.forEach((node) => {
      node.size = baseSize + (node.size % 20);
    });
  }, [zoomLevel, getCardSize]);

  return (
    <div className="fixed inset-0 select-none z-10">
      <canvas ref={canvasRef} className="w-full h-full pointer-events-none" />
    </div>
  );
}
