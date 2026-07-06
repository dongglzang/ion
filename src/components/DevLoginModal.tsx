import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Bug, Loader2, Search } from 'lucide-react';

interface DevLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: (email: string, password: string) => Promise<void>;
}

/** Hardcoded test accounts (testuser1 ~ testuser50, all password: test1234!)
 *  각 계정의 표시용 시드는 인덱스 기반. 실제 planet_seed 는 가입 시점에
 *  handle_new_user 트리거가 userId 해시로 박음.
 */
const TEST_ACCOUNTS = Array.from({ length: 10 }, (_, i) => ({
  email: `testuser${i + 1}@ion.test`,
  display_name: `testuser${i + 1}`,
  /** 표시용 시드 (목업). 실제 행성은 DB 의 planet_seed. */
  previewSeed: ((i + 1) * 1234567) >>> 0,
}));

export function DevLoginModal({ open, onOpenChange, onLogin }: DevLoginModalProps) {
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? TEST_ACCOUNTS.filter(a =>
        a.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : TEST_ACCOUNTS;

  const handleLogin = async (email: string) => {
    setLoggingIn(email);
    try {
      await onLogin(email, 'test1234!');
      onOpenChange(false);
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : '로그인 실패', { duration: 2000 });
    } finally {
      setLoggingIn(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] w-[calc(100vw-2rem)] rounded-2xl sm:rounded-3xl p-0 gap-0 overflow-hidden border-border/50 shadow-glow">
        <DialogHeader className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-green-500" />
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground">
              Dev Mode
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-1">
            테스트 계정을 선택하여 로그인 (비밀번호: <code className="text-green-500/80">test1234!</code>)
          </p>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
            <input
              type="text"
              placeholder="계정 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border/30 rounded-lg focus:outline-none focus:border-green-500/40 text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
        </DialogHeader>
        <ScrollArea className="relative max-h-[320px] sm:max-h-[360px] px-3 sm:px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((account) => {
              return (
                <motion.button
                  key={account.email}
                  whileTap={{ scale: 0.96 }}
                  disabled={loggingIn === account.email}
                  onClick={() => handleLogin(account.email)}
                  className={`
                    relative flex flex-col items-center gap-1.5 p-3 rounded-xl
                    border border-border/30 bg-card/50 hover:bg-card/80
                    transition-all duration-200 cursor-pointer
                    ${loggingIn === account.email ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  {loggingIn === account.email && (
                    <Loader2 className="w-4 h-4 animate-spin text-green-500 absolute top-2 right-2" />
                  )}
                  <span className="text-[10px] font-mono text-muted-foreground/60">
                    #{account.previewSeed.toString(16).slice(0, 4)}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate w-full text-center">
                    {account.display_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 truncate w-full text-center font-mono">
                    {account.email}
                  </span>
                </motion.button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground/50 py-8">
              일치하는 계정이 없습니다
            </p>
          )}
        </ScrollArea>
        <div className="relative px-5 sm:px-6 pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
