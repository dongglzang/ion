import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { Post } from '@/types';
import { OverlayRenderer } from '@/components/OverlayRenderer';
interface MyPostDetailProps {
  post: Post | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
  isDeleting: boolean;
}

/**
 * 마이페이지 그리드 타일을 탭했을 때 열리는 확장 오버레이.
 * ExpandedCard(피드)와 동일한 비주얼 셸을 공유하지만
 * 좋아요 대신 삭제 액션을 노출한다.
 */
export function MyPostDetail({ post, onClose, onDelete, isDeleting }: MyPostDetailProps) {
  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [post, onClose]);

  const onPhoto = !!post?.media;
  const overlayBtn = 'absolute w-10 h-10 rounded-full flex items-center justify-center z-10';
  const overlayStyle: React.CSSProperties = onPhoto
    ? { backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }
    : {};
  const overlayClass = onPhoto
    ? overlayBtn
    : `${overlayBtn} text-muted-foreground hover:bg-destructive/10 hover:text-destructive`;
  const iconColor = onPhoto ? '#ffffff' : 'currentColor';

  return (
    <AnimatePresence>
      {post && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            style={{
              backgroundColor: 'oklch(0 0 0 / 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            className="relative aspect-square w-[min(90vw,82vh)] rounded-[20px] overflow-hidden"
            style={{
              backgroundColor: 'oklch(var(--surface-elevated))',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {post.media ? (
              <>
                {post.mediaType === 'video' ? (
                  <video
                    src={post.media}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    loop
                    playsInline
                    controls
                  />
                ) : (
                  <img
                    src={post.media}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                  />
                )}
                {post.overlays && post.overlays.length > 0 && (
                  <OverlayRenderer overlays={post.overlays} />
                )}
              </>
            ) : post.bgColor ? (
              <div
                className="absolute inset-0"
                style={{ background: post.bgColor }}
              >
                {post.overlays && post.overlays.length > 0 && (
                  <OverlayRenderer overlays={post.overlays} />
                )}
              </div>
            ) : post.overlays && post.overlays.length > 0 ? (
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <OverlayRenderer overlays={post.overlays} />
              </div>
            ) : null}

            {/* 닫기 — 우상단 */}
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.88 }}
              className={`${overlayClass} top-3 right-3`}
              style={overlayStyle}
              aria-label="close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke={iconColor}
                strokeWidth={2}
                strokeLinecap="round"
                viewBox="0 0 24 24"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </motion.button>

            {/* 삭제 — 우하단 */}
            <motion.button
              onClick={() => onDelete(post.id)}
              disabled={isDeleting}
              whileTap={{ scale: 0.85 }}
              className={`${overlayClass} bottom-3 right-3 disabled:opacity-50`}
              style={overlayStyle}
              aria-label="delete"
            >
              <Trash2 className="w-5 h-5" style={{ color: iconColor }} strokeWidth={2} />
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
