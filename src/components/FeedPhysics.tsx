import { useEffect, useRef, useCallback } from 'react';
import { positionStore } from '@/stores/positionStore';
import { useClient } from '@/hooks/ClientProvider';
import { useDeviceSize, getCardCountForViewport, getDynamicCardSize } from '@/hooks/useDeviceSize';
import type { Post } from '@/types';

// 피드 카드 상단 오프셋 = 헤더(56 mobile / 64 sm) + 항성계 오비트 스트립(64) + 여백.
// 카드가 스트립과 겹치지 않고 스트립 아래에 깔리도록(getBounds minY).
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
  entering: boolean; // 반대편 벽 바깥에서 화면 안으로 진입 중인 새 카드 (벽 튕김/클램핑 건너뜀)
}

interface FeedPhysicsProps {
  posts: Post[];
}

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
  // 매 프레임 getComputedStyle → style invalidation 회피.
  // 테마 변경 시 1회만 재계산.
  const bgVarRef = useRef<string>(
    getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
  );

  useEffect(() => { isDarkModeRef.current = isDarkMode; }, [isDarkMode]);
  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => {
    // 테마 전환 시 --background 가 바뀜 → 1회 fetch.
    bgVarRef.current = getComputedStyle(document.documentElement)
      .getPropertyValue('--background').trim();
  }, [theme]);

  useEffect(() => {
    if (posts.length === 0) {
      initializedRef.current = false;
      nodesRef.current = [];
    }
  }, [posts]);

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

    const baseSize = getCardSize(zoomLevel);
    const maxCards = getCardCountForViewport(canvas.width, canvas.height, baseSize);
    const slicedPosts = posts.slice(0, maxCards);

    if (slicedPosts.length === 0) return;

    initializedRef.current = true;

    nodesRef.current = slicedPosts.map((post) => {
      const size = baseSize + Math.random() * 20;
      const b = getBounds(canvas, size);
      return {
        id: post.id,
        x: b.minX + Math.random() * (b.maxX - b.minX),
        y: b.minY + Math.random() * (b.maxY - b.minY),
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size,
        opacity: 0,
        targetOpacity: 1,
        dismissing: false,
        entering: false,
      };
    });
  }, [posts, zoomLevel, getCardSize, getBounds]);

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

    const animate = () => {
    const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bgVar = bgVarRef.current;
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, `oklch(${bgVar})`);
      gradient.addColorStop(1, `oklch(${bgVar})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // dismiss 처리: 노드를 dismissing 상태로 만들고 onDelete 예약
      const did = positionStore.getDismissedId();
      if (did) {
        const dn = nodesRef.current.find(n => n.id === did);
        if (dn && !dn.dismissing) {
          dn.dismissing = true;
          dn.targetOpacity = 0;
          const dir = positionStore.getDismissDirection();
          if (dir) { dn.vx = dir.vx * 0.3; dn.vy = dir.vy * 0.3; }
          // dismiss 정보 저장 (두 번째 useEffect에서 반대편 스폰에 사용)
          lastDismissRef.current = { x: dn.x, y: dn.y };
          positionStore.consumeDismissedAndNotify(did);
        }
      }

      nodesRef.current.forEach((node) => {
        const isDragged = node.id === positionStore.getDraggingId();

        if (isDragged) {
          const pos = positionStore.getSnapshot().find(p => p.id === node.id);
          if (pos) {
            node.x = pos.x;
            node.y = pos.y;
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
          }

          node.x += node.vx;
          node.y += node.vy;

          // entering(화면 밖에서 진입 중) 해제: 화면 안에 완전히 들어오면 일반 물리로 전환
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

            const isHovered = node.id === positionStore.getHoveredId();
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
            // 진입 중: 벽 튕김은 없고 감속만 (자연스럽게 안으로 미끄러져 들어옴)
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

      positionStore.updatePositions(
        nodesRef.current.map((node) => ({
          id: node.id,
          x: node.x,
          y: node.y,
          size: node.size,
          opacity: node.opacity,
          isDragging: node.id === positionStore.getDraggingId(),
        }))
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [initNodes, getBounds]);

  useEffect(() => {
    if (!canvasRef.current || posts.length === 0) return;

    const canvas = canvasRef.current;
    const baseSize = getCardSize(zoomLevel);
    const maxCards = getCardCountForViewport(canvas.width, canvas.height, baseSize);
    const slicedPosts = posts.slice(0, maxCards);

    const existingIds = new Set(nodesRef.current.map(n => n.id));
    const postsToAdd = slicedPosts.filter(p => !existingIds.has(p.id));

    // dismiss 발생 시: 새 카드를 반대편 가장자리 바깥에서 튀어나오게 스폰.
    // 중요 — posts는 dismiss마다 두 번 바뀐다(① 제거 → ② 보충 도착). ① 시점엔
    // postsToAdd가 비어있으므로 dismiss 정보를 소진하지 않고 보존해야, ②에서
    // 실제 새 카드가 벽 스폰으로 투입된다. 그렇지 않으면 랜덤 스폰으로 깜빡임.
    let usedDismiss = false;

    postsToAdd.forEach((post) => {
      const size = baseSize + Math.random() * 20;
      let sx: number, sy: number, svx: number, svy: number;
      let startOpacity = 0.3;
      let entering = false;

      if (lastDismissRef.current && !usedDismiss) {
        // 친 카드 위치의 정반대편 벽 바깥에서 투입
        usedDismiss = true;
        const info = lastDismissRef.current;
        const cw = canvas.width;
        const ch = canvas.height;
        const cx = cw / 2;
        const cy = (ch - TOP_OFFSET) / 2 + TOP_OFFSET;
        const dx = info.x - cx;
        const dy = info.y - cy;
        const speed = 5; // 벽에서 튀어나오는 속도
        if (Math.abs(dx) >= Math.abs(dy)) {
          sx = dx > 0 ? -size : cw + size;
          sy = TOP_OFFSET + size / 2 + Math.random() * (ch - TOP_OFFSET - size);
          svx = dx > 0 ? speed : -speed;
          svy = (Math.random() - 0.5) * 1;
        } else {
          sx = size / 2 + Math.random() * (cw - size);
          sy = dy > 0 ? TOP_OFFSET - size : ch + size;
          svx = (Math.random() - 0.5) * 1;
          svy = dy > 0 ? speed : -speed;
        }
        // 화면 밖에서 투입되므로 0에서 시작 → 들어오며 fade-in
        startOpacity = 0;
        entering = true;
      } else {
        // 일반 랜덤 스폰
        const b = getBounds(canvas, size);
        sx = b.minX + Math.random() * (b.maxX - b.minX);
        sy = b.minY + Math.random() * (b.maxY - b.minY);
        svx = (Math.random() - 0.5) * 0.2;
        svy = (Math.random() - 0.5) * 0.2;
      }

      nodesRef.current.push({
        id: post.id, x: sx, y: sy, vx: svx, vy: svy, size,
        opacity: startOpacity, targetOpacity: 1, dismissing: false, entering,
      });
    });

    // 실제로 entering 카드를 만들었을 때만 dismiss 정보 소비 (posts 제거 시점엔 보존)
    if (usedDismiss) lastDismissRef.current = null;

    nodesRef.current.forEach((node) => {
      node.targetOpacity = slicedPosts.some(p => p.id === node.id) ? 1 : 0;
      // entering(화면 밖 진입)·dismissing(퇴장 중)은 위치를 보존 — 클램핑하면
      // 벽에 끌려붙거나 퇴장이 튀어서 깜빡인다.
      if (!node.entering && !node.dismissing) clampPosition(node, canvas);
    });

    nodesRef.current = nodesRef.current.filter(node => node.opacity > 0.01 || node.targetOpacity > 0);
  }, [zoomLevel, posts, getCardSize, getBounds]);

  // zoom 변경 시에만 기존 노드 카드 크기 재조정 (posts 변경마다 실행 X)
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
