import { useState, useRef, useEffect, startTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountDialog({ open, onOpenChange, onConfirm }: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      startTransition(() => {
        setConfirmText('');
        setIsDeleting(false);
      });
    } else {
      // Focus input when dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const canDelete = confirmText === '탈퇴';

  const handleConfirm = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] w-[calc(100vw-2rem)] rounded-2xl sm:rounded-3xl p-0 gap-0 overflow-hidden border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-transparent to-transparent pointer-events-none" />
        <DialogHeader className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-3 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground">회원 탈퇴</DialogTitle>
        </DialogHeader>
        <div className="relative px-5 sm:px-6 space-y-3">
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 text-xs text-foreground/80 space-y-1.5 leading-relaxed">
            <p>탈퇴 시 다음 데이터가 <span className="text-destructive font-medium">영구적으로 삭제</span>됩니다:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>작성한 모든 게시물과 미디어</li>
              <li>좋아요, 공명, 차단 목록</li>
              <li>행성 정보, 표시 이름</li>
            </ul>
            <p className="pt-1.5 mt-1.5 border-t border-destructive/15 text-destructive font-semibold">이 작업은 되돌릴 수 없습니다.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-input" className="text-xs text-muted-foreground">
              계속하려면 <span className="font-mono font-bold text-destructive">탈퇴</span>를 입력하세요
            </label>
            <input
              ref={inputRef}
              id="confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="탈퇴"
              className="w-full px-3 py-2 ring-2 ring-destructive/30 rounded-xl text-sm bg-transparent placeholder:text-muted-foreground/40 focus:ring-destructive/50 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="relative px-5 sm:px-6 py-4 flex flex-col gap-2">
          <Button className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl" onClick={handleConfirm} disabled={!canDelete || isDeleting}>
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : '탈퇴하기'}
          </Button>
          <Button variant="ghost" className="w-full rounded-xl" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
