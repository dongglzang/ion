import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { LogIn, User, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/AuthProvider';

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const { login } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsPending(true);
    try {
      await login();
      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '로그인에 실패했습니다';
      setErrorMsg(msg);
      toast(msg, { duration: 2000 });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] w-[calc(100vw-2rem)] rounded-2xl sm:rounded-3xl p-0 gap-0 overflow-hidden border-border/50 shadow-glow">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none" />
        <DialogHeader className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 text-center">
          <div className="mx-auto mb-3 sm:mb-4 w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-lg">
            <User className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-lg sm:text-xl font-semibold text-foreground">환영합니다</DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">
            Google 계정으로 로그인하여 피드를 작성하세요
          </p>
        </DialogHeader>
        <div className="relative px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="space-y-3">
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/60 text-center">
              Google 계정 공개 범위: 이메일 + 표시 이름
            </p>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-xl touch-target"
                onClick={handleGoogleLogin}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4 mr-2" />
                )}
                Google 로그인
              </Button>
            </motion.div>
            <Button
              variant="ghost"
              className="w-full rounded-xl touch-target"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Esc로 닫기
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
