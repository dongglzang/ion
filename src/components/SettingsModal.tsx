import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LegalModal } from '@/components/LegalModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  Globe,
  LogOut,
  Trash2,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Quote,
  Flag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { PlanetAvatar } from '@/components/PlanetAvatar';
import { RerollModal } from '@/components/RerollModal';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userPlanetSeed: number;
  userStatusMessage: string | null;
  statusDefaultLabel: string;
  onChangeName: (name: string) => Promise<void>;
  /** RerollModal 의 "적용하기" 가 호출. mutation 이 DB 영구화. */
  onChangePlanetSeed: (seed: number) => Promise<void>;
  onChangeStatusMessage: (message: string | null) => Promise<void>;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

const STATUS_MAX_LENGTH = 80;

export function SettingsModal({
  open,
  onOpenChange,
  userId,
  userName,
  userPlanetSeed,
  userStatusMessage,
  statusDefaultLabel,
  onChangeName,
  onChangePlanetSeed,
  onChangeStatusMessage,
  onLogout,
  onDeleteAccount,
}: SettingsModalProps) {
  const { t, locale, setLocale } = useI18n();

  const [editName, setEditName] = useState(false);
  const [editStatus, setEditStatus] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [rerollOpen, setRerollOpen] = useState(false);
  const [nameInput, setNameInput] = useState(userName || '');
  const [statusInput, setStatusInput] = useState(userStatusMessage ?? '');
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      await onChangeName(nameInput.trim());
      setEditName(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelName = () => {
    setNameInput(userName || '');
    setEditName(false);
  };

  const handleSaveStatus = async () => {
    const trimmed = statusInput.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    setSaving(true);
    try {
      await onChangeStatusMessage(next);
      setEditStatus(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelStatus = () => {
    setStatusInput(userStatusMessage ?? '');
    setEditStatus(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none" />
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-base font-semibold">{t('settings.title')}</DialogTitle>
          </DialogHeader>

          <div className="relative px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Display Name */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('settings.displayName')}
                </span>
              </div>
              {editName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    className="flex-1 h-8 text-[13px]"
                    maxLength={20}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelName(); }}
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveName} disabled={saving}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelName}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setEditName(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors text-sm text-foreground group"
                >
                  <span>{userName}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </section>

            {/* Status Message */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Quote className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('settings.statusMessage')}
                </span>
              </div>
              {editStatus ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={statusInput}
                    onChange={e => setStatusInput(e.target.value)}
                    placeholder={statusDefaultLabel}
                    className="flex-1 h-8 text-[13px]"
                    maxLength={STATUS_MAX_LENGTH}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveStatus();
                      if (e.key === 'Escape') handleCancelStatus();
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveStatus} disabled={saving}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelStatus}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setEditStatus(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors text-sm group"
                >
                  <span className={(userStatusMessage && userStatusMessage.length > 0) ? 'text-foreground' : 'text-muted-foreground italic'}>
                    {userStatusMessage && userStatusMessage.length > 0 ? userStatusMessage : statusDefaultLabel}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </section>

            {/* Planet (Reroll) */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('settings.planet')}
                </span>
              </div>
              <button
                onClick={() => setRerollOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors text-sm group"
              >
                <PlanetAvatar
                  planetSeed={userPlanetSeed}
                  fallbackUserId={userId}
                  size={24}
                  showGlow={false}
                />
                <span className="flex-1 text-left text-foreground">
                  {t('reroll.title')}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </section>

            {/* Language */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('settings.language')}
                </span>
              </div>
              <div className="relative">
                <select
                  value={locale}
                  onChange={e => setLocale(e.target.value as 'ko' | 'en')}
                  className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-muted/40 text-foreground border border-border/30 appearance-none cursor-pointer hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all duration-200"
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </section>

            <div className="h-px bg-border/50" />

            {/* Logout */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-destructive/10 hover:text-destructive text-sm"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4" />
              {t('settings.logout')}
            </Button>

            {/* Legal Links */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setLegalModal('privacy')}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors text-sm text-muted-foreground group w-full text-left"
              >
                <span>{t('settings.privacyPolicy')}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => setLegalModal('terms')}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors text-sm text-muted-foreground group w-full text-left"
              >
                <span>{t('settings.termsOfService')}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
            <div className="h-px bg-border/50" />

            <button
              onClick={() => toast(t('settings.myReportsComingSoon'))}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors text-sm text-foreground/80 group"
            >
              <span className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-muted-foreground" />
                {t('settings.myReports')}
              </span>
              <span className="text-[10px] text-muted-foreground/50">{t('settings.myReportsComingSoon')}</span>
            </button>

            <div className="h-px bg-border/50" />

            {/* Delete Account — destructive card */}
            <button
              onClick={onDeleteAccount}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 bg-destructive/5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('settings.deleteAccount')}
            </button>
          </div>
        </DialogContent>

        {legalModal && (
          <LegalModal
            open={!!legalModal}
            onOpenChange={(open) => { if (!open) setLegalModal(null); }}
            type={legalModal}
          />
        )}
      </Dialog>

      <RerollModal
        open={rerollOpen}
        onOpenChange={setRerollOpen}
        userId={userId}
        currentSeed={userPlanetSeed}
        onApplied={onChangePlanetSeed}
      />
    </>
  );
}
