import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { useMyPostsQuery, useCreatePost, useDeletePost } from '@/hooks/queries/useMyPosts';
import { useSystems } from '@/hooks/queries/useSystems';
import { useUpdateProfile, useUpdatePlanetSeed, useUpdateStatusMessage } from '@/hooks/queries/useProfile';
import { MyPage as MyPageComponent } from '@/components/MyPage';
import { LoginModal } from '@/components/LoginModal';
import { Button } from '@/components/ui/button';
import { PlanetAvatar } from '@/components/PlanetAvatar';
import { useImageCropper } from '@/hooks/useImageCropper';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { LogIn, ArrowLeft } from 'lucide-react';
import { deleteAccount } from '@/lib/supabase';

export function MyPageRoute() {
  const { t } = useI18n();
  const { user, logout, setPlanetSeed, setDisplayName, setStatusMessage } = useAuth();
  const userId = user?.id ?? '';
  const authorName = user?.displayName ?? '';
  const authorPlanetSeed = (user?.planetSeed ?? 0) >>> 0;
  const userStatusMessage = user?.statusMessage ?? null;

  const { data: posts = [], isLoading, isError, refetch } = useMyPostsQuery(userId);
  const { mutateAsync: createPostMutate } = useCreatePost(userId, authorName);
  const { mutate: deletePostMutate } = useDeletePost(userId);
  const { mutateAsync: updateProfileMutate } = useUpdateProfile(userId);
  const { mutateAsync: updatePlanetSeedMutate } = useUpdatePlanetSeed(userId);
  const { mutateAsync: updateStatusMutate } = useUpdateStatusMessage(userId);
  const { data: systems = [] } = useSystems();
  const defaultSystemId = systems.find((s) => s.isDefault)?.id ?? '';

  const { requestCrop, CropModal } = useImageCropper();

  const [logoutToast, setLogoutToast] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleLogout = async () => {
    await logout();
    setLogoutToast(true);
    setTimeout(() => setLogoutToast(false), 2000);
  };

  const handleChangeName = async (name: string) => {
    await updateProfileMutate(name);
    setDisplayName(name);
  };

  const handleChangePlanetSeed = async (seed: number) => {
    await updatePlanetSeedMutate(seed);
    setPlanetSeed(seed);
  };

  const handleChangeStatusMessage = async (next: string | null) => {
    try {
      await updateStatusMutate(next ?? '');
      setStatusMessage(next);
    } catch (err) {
      console.error('Failed to update status message:', err);
      toast.error(t('myPage.statusEditFailed') || 'Failed to update status');
      throw err;
    }
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteAccount(userId);
      await logout();
      toast(t('myPageRoute.accountDeleted'), { duration: 2000 });
    } catch (err) {
      console.error('Account deletion failed:', err);
      toast(t('myPageRoute.deleteFailed'), { duration: 3000 });
      setDeletingAccount(false);
    }
  };

  // 비로그인은 마이페이지 대신 로그인 유도 게이트를 보여준다.
  // 페이지 진입 자체는 허용하되, 여기서 모든 인터랙션을 로그인으로 유도한다.
  if (!user) {
    return <GuestGate />;
  }

  return (
    <>
      <MyPageComponent
        posts={posts}
        userId={userId}
        userName={authorName}
        userPlanetSeed={authorPlanetSeed}
        userStatusMessage={userStatusMessage}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
        onCreatePost={async (opts) => { await createPostMutate({ ...opts, systemId: defaultSystemId }); }}
        onDeletePost={(postId) => { deletePostMutate(postId); }}
        onChangeName={handleChangeName}
        onChangePlanetSeed={handleChangePlanetSeed}
        onChangeStatusMessage={handleChangeStatusMessage}
        requestImageCrop={requestCrop}
      />
      {CropModal}
      {logoutToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-card border border-border/50 rounded-xl text-sm text-foreground shadow-lg z-[600]">
          {t('myPageRoute.loggedOut')}
        </div>
      )}
    </>
  );
}

// 비로그인 게스트 게이트: /my 진입은 허용하되 로그인 유도 화면을 보여준다.
// 사용자는 피드로 돌아가거나 로그인을 진행할 수 있다.
function GuestGate() {
  const { t } = useI18n();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-background via-background to-card/20 z-[400] overflow-y-auto pt-14 sm:pt-[64px] pb-[var(--safe-area-bottom)] select-none">
      <div className="max-w-[600px] mx-auto px-4 sm:px-5 py-20 text-center">
        <motion.div
          className="relative inline-flex items-center justify-center mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-0 bg-accent/10 rounded-full blur-2xl" />
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-card border border-border/50 flex items-center justify-center">
            <PlanetAvatar planetSeed={0} size={64} showGlow className="opacity-40" />
          </div>
        </motion.div>
        <motion.h1
          className="text-lg sm:text-xl font-bold text-foreground"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          {t('myPage.guestTitle')}
        </motion.h1>
        <motion.p
          className="text-xs sm:text-sm text-muted-foreground/80 mt-2 whitespace-pre-line"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {t('myPage.guestDesc')}
        </motion.p>
        <motion.div
          className="mt-10 mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-3 text-center">
            {t('myPage.guestPreview')}
          </p>
          <div className="grid grid-cols-3 gap-1 max-w-[400px] mx-auto filter blur-[2px] opacity-60 pointer-events-none select-none" aria-hidden>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square rounded-md bg-muted/40 border border-border/30" />
            ))}
          </div>
        </motion.div>
        <motion.div
          className="flex flex-col items-center gap-2 mt-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <Button
            onClick={() => setLoginOpen(true)}
            className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl touch-target"
          >
            <LogIn className="w-4 h-4" />
            {t('myPage.guestLogin')}
          </Button>
          <NavLink
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('myPage.guestFeed')}
          </NavLink>
        </motion.div>
      </div>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
