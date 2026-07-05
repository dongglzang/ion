import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSystems } from '@/hooks/queries/useSystems';
import { renderSystemVisual } from '@/constants/stars';
import { Plus } from 'lucide-react';

interface SystemOrbitStripProps {
  /** null = 전역(global) 활성. 특정 slug = 해당 항성계 활성. */
  activeSystemSlug: string | null;
  /** 제공되면 끝에 "새 항성계 만들기" + 버튼 표시 (로그인 시). */
  onCreateSystem?: () => void;
}

/**
 * 피드 상단 항성계 오비트 스트립. 행성 선택하듯 항성계를 고른다.
 * - "전체" → / (모든 항성계 합집합, 발견)
 * - 각 항성계 별 → /s/:slug (해당 항성계 피드)
 * 헤더 바로 아래 고정 오버레이. 카드는 물리 기반이라 일부 가려짐(블러 처리) — v1.
 */
export function SystemOrbitStrip({ activeSystemSlug, onCreateSystem }: SystemOrbitStripProps) {
  const navigate = useNavigate();
  const { data: systems = [] } = useSystems();

  const allActive = activeSystemSlug === null;

  return (
    <nav className="fixed top-14 sm:top-[64px] inset-x-0 z-30 h-[64px] bg-background/60 backdrop-blur-xl border-b border-border/30">
      <div className="flex items-center gap-3.5 overflow-x-auto h-full px-4 sm:px-6" style={{ scrollbarWidth: 'none' }}>
        {/* 전체 (global discovery) */}
        <button
          onClick={() => navigate('/')}
          className="flex flex-col items-center gap-1 shrink-0"
          aria-label="전체"
        >
          <div
            className={`w-11 h-11 rounded-full grid place-items-center border transition-all ${
              allActive
                ? 'bg-accent/15 border-accent ring-2 ring-accent/40'
                : 'bg-muted/40 border-border/40 opacity-60'
            }`}
          >
            <span className="text-[11px] font-semibold text-foreground">∞</span>
          </div>
          <span className={`text-[10px] leading-tight ${allActive ? 'text-foreground' : 'text-muted-foreground'}`}>
            전체
          </span>
        </button>

        {systems.map((s) => {
          const v = renderSystemVisual(s.palette);
          const active = activeSystemSlug === s.slug;
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/s/${s.slug}`)}
              className="flex flex-col items-center gap-1 shrink-0"
              aria-label={s.name}
            >
              <motion.div
                className="w-11 h-11 rounded-full"
                style={{
                  background: v.gradient,
                  boxShadow: active
                    ? `0 0 10px ${v.glow}, 0 0 20px ${v.glow}50`
                    : `0 1px 3px ${v.glow}30`,
                  outline: active ? `2px solid ${v.glow}` : '2px solid transparent',
                  opacity: active ? 1 : 0.7,
                }}
                whileTap={{ scale: 0.9 }}
              />
              <span className={`text-[10px] leading-tight max-w-[48px] truncate ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.name}
              </span>
            </button>
          );
        })}
        {onCreateSystem && (
          <button onClick={onCreateSystem} className="flex flex-col items-center gap-1 shrink-0" aria-label="새 항성계 만들기">
            <div className="w-11 h-11 rounded-full grid place-items-center border border-dashed border-border/60 text-muted-foreground">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-muted-foreground">만들기</span>
          </button>
        )}
      </div>
    </nav>
  );
}
