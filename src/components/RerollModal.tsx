import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlanetAvatar } from '@/components/PlanetAvatar';
import { seedToHex, generateRandomSeed } from '@/constants/proceduralPlanets';
import { useUpdatePlanetSeed } from '@/hooks/queries/useProfile';
import { toast } from 'sonner';
import { Dices, Sparkles } from 'lucide-react';

interface RerollModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** 현재 시드. 모달 열릴 때 1회 자동 굴려서 비교 표시. */
  currentSeed: number;
  /** 적용 성공 시 호출 (AuthProvider context 갱신). */
  onApplied?: (newSeed: number) => void;
}

/**
 * 행성 뽑기 모달.
 *
 * 흐름:
 *   - 모달 열림 → 자동 1회 굴림 (previewSeed 초기화).
 *   - "다시 뽑기" → 클라이언트 사이드 새 시드 생성 (DB 미저장).
 *   - "적용하기" → useUpdatePlanetSeed mutation 으로 DB 영구화
 *     (낙관적 업데이트 + 실패 시 롤백 + settle 후 refetch).
 *   - 닫기(X) → 폐기. previewSeed 는 저장되지 않음.
 *
 * 결정성:
 *   generateRandomSeed() 는 crypto.getRandomValues(uint32). 결정적이지 않음
 *   (의도적 — 매번 새 행성). previewSeed 가 DB 에 박히면 다음 렌더부터
 *   그 시드 = 같은 행성 (across-viewers 결정성).
 */
export function RerollModal({
  open,
  onOpenChange,
  userId,
  currentSeed,
  onApplied,
}: RerollModalProps) {
  const { t } = useI18n();
  const { mutateAsync: applySeed, isPending } = useUpdatePlanetSeed(userId);
  const [previewSeed, setPreviewSeed] = useState<number>(() => generateRandomSeed());
  // 모달이 닫혔다 다시 열릴 때마다 1회 자동 굴림
  const lastOpenRef = useRef(false);

  useEffect(() => {
    if (open && !lastOpenRef.current) {
      setPreviewSeed(generateRandomSeed());
    }
    lastOpenRef.current = open;
  }, [open]);

  const handleReroll = useCallback(() => {
    setPreviewSeed(generateRandomSeed());
  }, []);

  const handleApply = useCallback(async () => {
    try {
      await applySeed(previewSeed);
      onApplied?.(previewSeed);
      onOpenChange(false);
    } catch (err) {
      // mutation 의 onError 가 이미 캐시 롤백. 사용자에게만 알림.
      toast.error(t('reroll.applyFailed'));
      console.error('[RerollModal] apply failed', err);
    }
  }, [applySeed, previewSeed, onApplied, onOpenChange, t]);

  const changed = previewSeed !== currentSeed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] w-[calc(100vw-2rem)] rounded-2xl sm:rounded-3xl p-0 gap-0 overflow-hidden border-border/50 shadow-glow">
        <DialogHeader className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 text-center">
          <DialogTitle className="text-lg sm:text-xl font-semibold text-foreground">
            {t('reroll.title')}
          </DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">
            {t('reroll.subtitle')}
          </p>
        </DialogHeader>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex flex-col items-center gap-4">
          {/* 큰 행성 프리뷰 */}
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
            <PlanetAvatar
              planetSeed={previewSeed}
              fallbackUserId={userId}
              size={128}
              showGlow
              className="sm:!w-40 sm:!h-40"
            />
          </div>

          {/* 시드 표시 (디버깅 + 사용자 안심용) */}
          <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider">
            #{seedToHex(previewSeed)}
          </div>

          {/* 이전/새 비교 */}
          <div className="w-full flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <PlanetAvatar
                planetSeed={currentSeed}
                fallbackUserId={userId}
                size={36}
                showGlow={false}
              />
              <span className="text-[10px] text-muted-foreground/70">{t('reroll.current')}</span>
            </div>
            <span className="text-muted-foreground/40 text-base">→</span>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <PlanetAvatar
                planetSeed={previewSeed}
                fallbackUserId={userId}
                size={36}
                showGlow={false}
              />
              <span className="text-[10px] text-muted-foreground/70">{t('reroll.new')}</span>
            </div>
          </div>

          {/* 액션 */}
          <div className="w-full flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleReroll}
              disabled={isPending}
              className="flex-1 rounded-xl"
            >
              <Dices className="w-4 h-4 mr-1.5" />
              {t('reroll.reroll')}
            </Button>
            <Button
              onClick={handleApply}
              disabled={isPending || !changed}
              className="flex-1 rounded-xl"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {isPending ? t('reroll.applying') : t('reroll.apply')}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/50 text-center">
            {t('reroll.appliedHint')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
