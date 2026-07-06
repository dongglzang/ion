import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { reportPost } from '@/lib/supabase';
import { useI18n } from '@/i18n';

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string | null;
  userId: string;
}

const REPORT_REASONS = [
  { value: 'spam', label: '스팸' },
  { value: 'harmful', label: '유해 콘텐츠' },
  { value: 'inappropriate', label: '부적절한 콘텐츠' },
  { value: 'other', label: '기타' },
] as const;

export function ReportModal({ open, onOpenChange, postId, userId }: ReportModalProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState<string>('');
  const [detail, setDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [armed, setArmed] = useState(false);
  const armTimerRef = useRef<number | null>(null);

  // armed 상태 + timer 리셋. setState-in-effect 회피용 wrapper.
  const cleanupArm = () => {
    setArmed(false);
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  };

  // 모달 닫힘 cleanup은 Dialog onOpenChange에서 처리 (effect 회피).
  const handleOpenChange = (next: boolean) => {
    if (!next) cleanupArm();
    onOpenChange(next);
  };

  // 사유 선택 시 armed 리셋.
  const handleReasonSelect = (value: string) => {
    setReason(value);
    cleanupArm();
  };

  const handleActualSubmit = async () => {
    if (!reason || !postId) return;
    setIsSubmitting(true);
    try {
      await reportPost(userId, postId, reason, detail || undefined);
      toast('신고되었습니다 · 모더레이션 큐에서 검토 중 (통상 24시간)', { duration: 4000 });
      onOpenChange(false);
      setReason('');
      setDetail('');
      setArmed(false);
    } catch {
      toast('신고에 실패했습니다', { duration: 2000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClick = () => {
    if (!reason) return;
    if (!armed) {
      setArmed(true);
      armTimerRef.current = window.setTimeout(() => {
        setArmed(false);
        armTimerRef.current = null;
      }, 3000);
      return;
    }
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    handleActualSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px] w-[calc(100vw-2rem)] rounded-2xl sm:rounded-3xl p-0 gap-0 overflow-hidden border-border/50 shadow-glow">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none" />
        <DialogHeader className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-3 text-center">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            신고하기
          </DialogTitle>
        </DialogHeader>
        <div className="relative px-5 sm:px-6 space-y-3">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => handleReasonSelect(r.value)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                reason === r.value
                  ? 'bg-accent/15 text-foreground border border-accent/40'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              {r.label}
            </button>
          ))}
          {reason && (
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={reason === 'other' ? '상세 내용 (필수)' : '상세 내용 (선택)'}
              className="w-full min-h-[80px] resize-none ring-1 ring-border rounded-xl p-3 text-sm bg-transparent placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-accent/30 outline-none"
            />
          )}
        </div>
        <div className="relative px-5 sm:px-6 py-4 space-y-2">
          <Button
            className={cn(
              'w-full rounded-xl transition-all',
              armed
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            )}
            onClick={handleClick}
            disabled={!reason || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : armed ? (
              t('report.confirmArmed')
            ) : (
              '신고하기'
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <p className="text-[11px] text-muted-foreground/70 text-center pt-1">
            신고 후 콘텐츠는 즉시 사라지지 않고 모더레이션 큐에서 검토됩니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
