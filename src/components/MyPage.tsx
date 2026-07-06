import { useState } from 'react';
import { CreateStoryModal } from '@/components/CreateStoryModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Image, Settings, Calendar, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { PlanetAvatar } from '@/components/PlanetAvatar';
import { RerollModal } from '@/components/RerollModal';
import { SettingsModal } from '@/components/SettingsModal';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { CalendarModal } from '@/components/CalendarModal';
import { MyPostDetail } from '@/components/MyPostDetail';
import { OverlayRenderer } from '@/components/OverlayRenderer';
import { useI18n } from '@/i18n';
import type { Post, Overlay } from '@/types';

interface MyPageProps {
  posts: Post[];
  userName: string;
  userId: string;
  /** 결정적 uint32 시드. */
  userPlanetSeed: number;
  /** Null = user hasn't set one yet → fallback to default slogan. */
  userStatusMessage: string | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onCreatePost: (opts: { mediaFile?: File; bgColor?: string; overlays?: Overlay[] }) => Promise<void>;
  onDeletePost: (postId: string) => void;
  onChangeName: (name: string) => Promise<void>;
  /** RerollModal 의 "적용하기" 가 호출. mutation 이 DB 영구화 + 캐시 갱신. */
  onChangePlanetSeed: (seed: number) => Promise<void>;
  onChangeStatusMessage: (message: string | null) => Promise<void>;
  requestImageCrop: (file: File) => Promise<Blob>;
}

const STATUS_MAX_LENGTH = 80;

export function MyPage({
  posts,
  userName,
  userId,
  userPlanetSeed,
  userStatusMessage,
  isLoading,
  isError,
  onRetry,
  onLogout,
  onDeleteAccount,
  onCreatePost,
  onDeletePost,
  onChangeName,
  onChangePlanetSeed,
  onChangeStatusMessage,
  requestImageCrop,
}: MyPageProps) {
  const { t } = useI18n();
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [rerollOpen, setRerollOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleDelete = async (postId: string) => {
    setDeletingPostId(postId);
    onDeletePost(postId);
    toast(t('myPage.deleted'), { duration: 2000 });
    setDeletingPostId(null);
  };

  const handleDeleteAccount = async () => {
    setSettingsOpen(false);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-background via-background to-card/20 z-[400] overflow-y-auto pt-14 sm:pt-[64px] pb-[var(--safe-area-bottom)] select-none">
        <div className="max-w-[600px] mx-auto px-4 sm:px-5 py-20 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-background via-background to-card/20 z-[400] overflow-y-auto pt-14 sm:pt-[64px] pb-[var(--safe-area-bottom)] select-none">
        <div className="max-w-[600px] mx-auto px-4 sm:px-5 py-20 text-center">
          <p className="text-muted-foreground mb-4">{t('myPage.failed')}</p>
          <button onClick={onRetry} className="px-4 py-2 bg-accent text-accent-foreground rounded-xl">
            {t('myPage.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-background via-background to-card/20 z-[400] overflow-y-auto pt-14 sm:pt-[64px] pb-[var(--safe-area-bottom)] select-none">
      <div className="max-w-[600px] mx-auto px-4 sm:px-5 pb-10">
        {/* Profile Header */}
        <div className="relative py-6 sm:py-8">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
          </div>
          <motion.div
            className="relative flex items-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button onClick={() => setRerollOpen(true)} className="group shrink-0">
              <PlanetAvatar planetSeed={userPlanetSeed} fallbackUserId={userId} size={64} showGlow className="transition-transform group-hover:scale-105" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{userName}</h1>
              <StatusMessageEditor
                value={userStatusMessage}
                fallback={t('myPage.statusDefault')}
                maxLength={STATUS_MAX_LENGTH}
                onSave={onChangeStatusMessage}
                editHint={t('myPage.statusEditHint')}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCalendarOpen(true)}
              aria-label={t('calendar.title')}
              className="hover:text-foreground hover:shadow-[0_0_12px_oklch(var(--accent)/0.5)]"
            >
              <Calendar className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('myPage.settings')}
              className="hover:text-foreground hover:shadow-[0_0_12px_oklch(var(--accent)/0.5)]"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{t('myPage.myPosts')}</h2>
          <Button variant="outline" size="sm" onClick={() => setCreatePostOpen(true)}
            className="gap-1.5 border-accent/30 hover:bg-accent/10">
            <Plus className="w-4 h-4" /><span>{t('myPage.new')}</span>
          </Button>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <motion.div className="text-center py-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Image className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground mb-4">{t('myPage.noPosts')}</p>
            <Button onClick={() => setCreatePostOpen(true)} variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Plus className="w-4 h-4 mr-2" />{t('myPage.createFirstPost')}
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
            {posts.map((post, idx) => (
              <motion.button
                key={post.id}
                type="button"
                onClick={() => setSelectedPost(post)}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.25 }}
                whileTap={{ scale: 0.96 }}
                aria-label={t('myPage.myPosts')}
                className="group relative aspect-square overflow-hidden bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {post.media ? (
                  post.mediaType === 'video' ? (
                    <>
                      <video
                        src={post.media}
                        className="absolute inset-0 w-full h-full object-cover"
                        preload="metadata"
                        playsInline
                        muted
                      />
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-foreground/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                        <svg className="w-2.5 h-2.5 text-background ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </>
                  ) : (
                    <img
                      src={post.media}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      draggable={false}
                    />
                  )
                ) : post.bgColor ? (
                  <div
                    className="absolute inset-0"
                    style={{ background: post.bgColor }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-2.5 bg-card">
                    {post.overlays && post.overlays.length > 0 && (
                      <OverlayRenderer overlays={post.overlays} />
                    )}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <CreateStoryModal
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        onSubmit={onCreatePost}
        requestImageCrop={requestImageCrop}
      />
      <RerollModal
        open={rerollOpen}
        onOpenChange={setRerollOpen}
        userId={userId}
        currentSeed={userPlanetSeed}
        onApplied={onChangePlanetSeed}
      />
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        userId={userId}
        userName={userName}
        userPlanetSeed={userPlanetSeed}
        userStatusMessage={userStatusMessage}
        statusDefaultLabel={t('myPage.statusDefault')}
        onChangeName={onChangeName}
        onChangePlanetSeed={onChangePlanetSeed}
        onChangeStatusMessage={onChangeStatusMessage}
        onLogout={onLogout}
        onDeleteAccount={handleDeleteAccount}
      />
      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async () => {
          await onDeleteAccount();
          setDeleteDialogOpen(false);
        }}
      />
      <CalendarModal open={calendarOpen} onOpenChange={setCalendarOpen} />
      <MyPostDetail
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedPost(null);
        }}
        isDeleting={deletingPostId !== null}
      />
    </div>
  );
}

/* ─── Status Message (inline editor) ───
 * Tap the slogan → enter edit mode. Enter or blur saves, Esc cancels.
 * Empty / cleared value falls back to `fallback` (the default slogan)
 * in both display and storage — DB column gets set to NULL.
 */
function StatusMessageEditor({
  value,
  fallback,
  maxLength,
  editHint,
  onSave,
}: {
  value: string | null;
  fallback: string;
  maxLength: number;
  editHint: string;
  onSave: (next: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  const display = value && value.length > 0 ? value : fallback;
  const isCustom = !!value && value.length > 0;

  const beginEdit = () => {
    setDraft(value ?? '');
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    const next = trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // 부모가 toast/에러를 띄우므로 여기서는 입력 모드 유지.
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (!saving) save(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void save(); }
            else if (e.key === 'Escape') cancel();
          }}
          disabled={saving}
          maxLength={maxLength}
          autoFocus
          aria-label={editHint}
          className="h-7 text-sm"
        />
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={beginEdit}
      aria-label={editHint}
      className="block mt-0.5 text-left text-xs sm:text-sm text-muted-foreground hover:text-foreground/80 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
    >
      {display}
      {isCustom ? null : <span className="ml-1 text-[10px] text-muted-foreground/60">· {editHint}</span>}
    </button>
  );
}
