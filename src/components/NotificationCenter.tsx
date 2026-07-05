import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck } from 'lucide-react';
import { useUnseenResonancesQuery, useMarkResonanceSeen, useMarkAllResonancesSeen } from '@/hooks/queries/useResonances';
import { useI18n } from '@/i18n';

interface NotificationCenterProps {
  userId: string;
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const { t, locale } = useI18n();
  const { data: resonances = [] } = useUnseenResonancesQuery(userId);
  const { mutate: markSeen } = useMarkResonanceSeen(userId);
  const { mutate: markAllSeen } = useMarkAllResonancesSeen(userId);
  const [isOpen, setIsOpen] = useState(false);

  const unseenCount = resonances.length;

  const handleDismiss = (resonanceId: string) => {
    markSeen(resonanceId);
  };

  const handleMarkAllRead = () => {
    markAllSeen();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-11 h-11 flex items-center justify-center hover:bg-accent/10 transition-colors touch-target rounded-md"
        aria-label={t('notification.title')}
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unseenCount > 0 && (
          <motion.span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center px-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {unseenCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[599]"
              onClick={() => setIsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="fixed top-14 sm:top-[60px] right-2 sm:right-4 z-[600] w-[calc(100vw-1rem)] max-w-[320px] bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none" />
              <div className="relative px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-foreground">{t('notification.title')}</span>
                </div>
                <div className="flex items-center gap-1">
                  {unseenCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="px-2 py-1 text-[10px] font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      {t('notification.markAllRead')}
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-muted">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="relative max-h-[60vh] overflow-y-auto">
                {resonances.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('notification.empty')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{t('notification.emptyHint')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {resonances.map((r: { id: string; user_a: string; user_b: string; post_a: string; post_b: string; seen: boolean; created_at: string }) => (
                      <div key={r.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Bell className="w-4 h-4 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{t('notification.resonance')}</p>
                          <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">{t('notification.resonanceDescription')}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1">
                            {new Date(r.created_at).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDismiss(r.id)}
                          className="p-1 rounded-full hover:bg-muted shrink-0"
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
