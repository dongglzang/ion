import { useDeviceSize } from '@/hooks/useDeviceSize';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ backgroundColor: 'hsla(40, 12%, 90%, 0.6)' }}
    />
  );
}

// 데스크탑/태블릿 그리드 placeholder 개수.
// physics 부트 전이라 정확도 불필요 — 시각적 면적만 맞으면 됨.
function getDesktopPlaceholderCount(breakpoint: string): number {
  switch (breakpoint) {
    case 'desktop':
      return 14;
    case 'laptop':
      return 10;
    case 'tablet':
      return 6;
    default:
      return 4;
  }
}

function DesktopFeedSkeleton() {
  const { breakpoint, width, height } = useDeviceSize();
  const count = getDesktopPlaceholderCount(breakpoint);

  // 헤더(64) + 항성계 오비트(64) + 여백(32) — 실제 FeedPhysics와 동일.
  const TOP_OFFSET = 64 + 64 + 32;
  const BOTTOM_OFFSET = 96;
  const availH = Math.max(240, height - TOP_OFFSET - BOTTOM_OFFSET);
  const availW = Math.max(320, width);

  // PC 카드는 viewport에 맞춰 작게 — 너무 크면 한두 개만 보임.
  // FeedPhysics의 dynamic size와 비슷한 비율 (viewport 0.09 base) 유지.
  const baseRatio = breakpoint === 'desktop' ? 0.085 : breakpoint === 'laptop' ? 0.09 : 0.1;
  const cardSize = Math.min(180, Math.max(90, availW * baseRatio));

  // 그리드 비율을 viewport에 맞춰 추정.
  const cellSize = cardSize + 20;
  const cols = Math.max(2, Math.floor(availW / cellSize));
  const rows = Math.max(1, Math.ceil(count / cols));

  return (
    <div
      className="relative w-full h-full select-none"
      style={{
        paddingTop: 'calc(var(--safe-area-top) + 144px)',
        paddingBottom: 'calc(var(--safe-area-bottom) + 24px)',
        paddingLeft: 'max(24px, var(--safe-area-left))',
        paddingRight: 'max(24px, var(--safe-area-right))',
      }}
    >
      <div
        className="grid w-full h-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, ${availH / rows}px)`,
          gap: '20px',
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden"
            style={{
              boxShadow:
                '0 0 24px hsla(275, 60%, 55%, 0.18), 0 0 48px hsla(330, 65%, 55%, 0.1)',
            }}
          >
            <Skeleton className="w-full h-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  const { isMobile } = useDeviceSize();
  if (!isMobile) return <DesktopFeedSkeleton />;

  return (
    <div
      className="relative w-full h-full flex flex-col select-none"
      style={{
        paddingTop: 'calc(var(--safe-area-top) + 88px)',
        paddingBottom: 'calc(var(--safe-area-bottom) + 24px)',
        paddingLeft: 'max(16px, var(--safe-area-left))',
        paddingRight: 'max(16px, var(--safe-area-right))',
      }}
    >
      <div className="mx-auto w-full max-w-[420px] flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-[42px] h-[42px] rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-2.5 w-16 rounded" />
          </div>
        </div>

        <div className="mb-4 flex-shrink-0">
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              aspectRatio: '4/5',
              boxShadow: '0 0 24px hsla(275, 60%, 55%, 0.2), 0 0 48px hsla(330, 65%, 55%, 0.12)',
            }}
          >
            <Skeleton className="w-full h-full rounded-2xl" />
          </div>
        </div>

        <div className="flex-1 space-y-3 mb-4">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-[85%] rounded" />
          <Skeleton className="h-4 w-[70%] rounded" />
        </div>

        <div
          className="flex items-center gap-1 pt-3 border-t"
          style={{ borderColor: 'hsla(40, 10%, 87%, 0.3)' }}
        >
          <Skeleton className="w-11 h-11 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="w-11 h-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}
