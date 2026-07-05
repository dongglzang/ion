import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NEBULA_PRESETS, renderSystemVisual } from '@/constants/stars';
import { useCreateSystem } from '@/hooks/queries/useSystems';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** 표시명 → URL 슬러그 (kebab-case). 한글은 제거되므로 사용자가 직접 채우도록 유도. */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface CreateSystemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
}

/**
 * 새 항성계 생성 모달 (open-UGC).
 * 이름/주소(slug)/설명/중심 별 색상(팔레트) 선택 → 생성 → /s/:slug 로 이동.
 */
export function CreateSystemModal({ open, onOpenChange, creatorId }: CreateSystemModalProps) {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateSystem();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [palette, setPalette] = useState<string[]>(NEBULA_PRESETS[0].palette);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setDescription('');
      setPalette(NEBULA_PRESETS[0].palette);
    }
  }, [open]);

  // slug 수동 편집이 없으면 name 에서 자동 생성
  useEffect(() => {
    if (!slugTouched) setSlug(nameToSlug(name));
  }, [name, slugTouched]);

  const slugValid = SLUG_RE.test(slug);
  const canSubmit = name.trim().length > 0 && slugValid && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await mutateAsync({
        slug,
        name: name.trim(),
        description: description.trim() || undefined,
        palette,
        creatorId,
      });
      onOpenChange(false);
      navigate(`/s/${slug}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('23505') || msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('이미 존재하는 주소입니다. 다른 이름으로 지어주세요.');
      } else {
        toast.error('생성 중 오류가 발생했습니다.');
      }
    }
  };

  const preview = renderSystemVisual(palette);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] w-[calc(100vw-2rem)] rounded-2xl sm:rounded-3xl p-0 gap-0 overflow-hidden border-border/50 shadow-glow">
        <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3 text-center">
          <DialogTitle className="text-lg sm:text-xl font-semibold">새 항성계 만들기</DialogTitle>
          <p className="text-xs text-muted-foreground/70 mt-1">나만의 우주 커뮤니티를 생성하세요</p>
        </DialogHeader>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
          {/* 중심 별 미리보기 */}
          <div className="flex justify-center py-1">
            <motion.div
              className="w-16 h-16 rounded-full"
              style={{ background: preview.gradient, boxShadow: `0 0 18px ${preview.glow}66` }}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">이름 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 심야 대화" maxLength={30} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              주소 <span className="text-foreground/60">/s/{slug || '…'}</span>
            </label>
            <Input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="kebab-case"
              className={!slugValid && slug ? 'border-destructive' : ''}
            />
            {!slugValid && slug && (
              <p className="text-[11px] text-destructive">영문 소문자·숫자·하이픈만 가능합니다.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">설명 (선택)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이 항성계는…" maxLength={80} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">중심 별 색상</label>
            <div className="grid grid-cols-5 gap-2">
              {NEBULA_PRESETS.map((p) => {
                const v = renderSystemVisual(p.palette);
                const selected = palette.join(',') === p.palette.join(',');
                return (
                  <button key={p.id} onClick={() => setPalette(p.palette)} className="flex justify-center" title={p.nameKo}>
                    <div
                      className="w-8 h-8 rounded-full transition-transform"
                      style={{
                        background: v.gradient,
                        outline: selected ? `2px solid ${v.glow}` : '2px solid transparent',
                        boxShadow: selected ? `0 0 8px ${v.glow}90` : 'none',
                        transform: selected ? 'scale(1.08)' : 'scale(1)',
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
            {isPending ? '생성 중…' : '항성계 만들기'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
