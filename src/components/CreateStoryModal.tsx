import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCw,
  Hand,
  Palette,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import type { Overlay } from '@/types';
import { cn } from '@/lib/utils';
import { useSystems } from '@/hooks/queries/useSystems';
import { renderSystemVisual } from '@/constants/stars';
import { buildOverlayStyle, useContainerSize, OVERLAY_FONT_FAMILY } from '@/components/OverlayRenderer';

interface CreateStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** mediaFile 또는 bgColor 중 하나 필수. 둘 다 없으면 requireImage 가드 발동. */
  onSubmit: (opts: { mediaFile?: File; bgColor?: string; overlays: Overlay[] }) => Promise<void>;
  requestImageCrop: (file: File) => Promise<Blob>;
  defaultSystemId?: string;
}

// 첫 프리셋은 짙은 슬레이트 — 모달을 열자마자 흰 텍스트가 잘 보이는 안전한 디폴트.
// 흰/검정은 사용자가 명시적으로 골라야 도달하는 색으로 뒤쪽에 배치.
const COLOR_PRESETS = [
  '#1e293b', // slate-800
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#fbbf24', // yellow
  '#ffffff', // white
  '#000000', // black
];

const FONT_FAMILIES: { key: Overlay['family']; label: string; css: string }[] = [
  { key: 'sans', label: '고딕', css: OVERLAY_FONT_FAMILY.sans },
  { key: 'serif', label: '명조', css: OVERLAY_FONT_FAMILY.serif },
  { key: 'mono', label: '모노', css: OVERLAY_FONT_FAMILY.mono },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 배경 hex(#rrggbb) 위에 가독성 좋은 텍스트 색을 골라준다.
 * YIQ 휘도 기반 — 임계 128 이상이면 어두운 텍스트, 아니면 흰 텍스트.
 * 단순하지만 프리셋/직접 입력 모두에서 충분히 자연스러운 결과를 준다.
 * (높은 명도 위에서 검정, 낮은 명도 위에서 흰색.)
 */
function pickReadableTextColor(bgHex: string): string {
  const m = bgHex.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#111111' : '#ffffff';
}

function newOverlay(bgHex?: string): Overlay {
  return {
    id: crypto.randomUUID(),
    text: '',
    x: 0.5,
    y: 0.5,
    scale: 1,
    // 색 모드면 배경에 어울리는 텍스트 색, 이미지 모드면 흰색 + 외곽 그림자.
    color: bgHex ? pickReadableTextColor(bgHex) : '#ffffff',
    rotation: 0,
    family: 'sans',
    weight: 700,
    align: 'center',
  };
}

const HANDLE_SIZE = 22;

export function CreateStoryModal({
  open,
  onOpenChange,
  onSubmit,
  requestImageCrop,
  defaultSystemId,
}: CreateStoryModalProps) {
  const { t } = useI18n();
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string>(COLOR_PRESETS[0]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [measuredRef, canvasSize] = useContainerSize<HTMLDivElement>();

  const { data: systems = [] } = useSystems();
  const targetSystem = systems.find((s) => s.id === defaultSystemId);
  const targetVisual = targetSystem ? renderSystemVisual(targetSystem.palette) : null;

  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      setBgFile(null);
      setBgPreview(null);
      setBgColor(COLOR_PRESETS[0]);
      setOverlays([]);
      setSelectedId(null);
      setEditingId(null);
      setIsSubmitting(false);
      setIsDragOver(false);
      overlayRefs.current.clear();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  // 색 모드에서 배경이 바뀌면, 자동 색(#ffffff / #111111)인 기존 overlay만
  // 새 배경에 맞춰 재대비. 사용자가 picker 로 명시적으로 고른 색은 보존.
  // 이미지 모드(bgPreview 있음)에서는 텍스트가 흰색+그림자이므로 무시.
  useEffect(() => {
    if (bgPreview) return;
    const next = pickReadableTextColor(bgColor);
    setOverlays((prev) =>
      prev.map((o) =>
        o.color === '#ffffff' || o.color === '#111111' ? { ...o, color: next } : o
      ),
    );
  }, [bgColor, bgPreview]);

  const setCanvasRef = useCallback(
    (node: HTMLDivElement | null) => {
      canvasRef.current = node;
      measuredRef.current = node;
    },
    [measuredRef],
  );

  const setOverlayNode = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) overlayRefs.current.set(id, node);
    else overlayRefs.current.delete(id);
  }, []);

  const selected = useMemo(
    () => overlays.find((o) => o.id === selectedId) ?? null,
    [overlays, selectedId],
  );

  const patchSelected = useCallback((patch: Partial<Overlay>) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === selectedId ? { ...o, ...patch } : o)),
    );
  }, [selectedId]);

  const addText = () => {
    // 색 모드면 현재 배경색에 어울리는 텍스트 색. 이미지 모드면 bgHex 가드 발동 → 흰색.
    const o = newOverlay(bgPreview ? undefined : bgColor);
    setOverlays((prev) => [...prev, o]);
    setSelectedId(o.id);
    // 추가 직후 바로 인라인 편집 — 빈 박스에서 추가 클릭 한 번 더 안 해도 됨.
    setEditingId(o.id);
  };

  const handleImageFile = async (file: File) => {
    try {
      const blob = await requestImageCrop(file);
      const cropped = new File([blob], 'story.jpg', { type: 'image/jpeg' });
      setBgFile(cropped);
      setBgPreview(URL.createObjectURL(cropped));
    } catch {
      // crop cancelled
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) handleImageFile(file);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setOverlays((prev) => prev.filter((o) => o.id !== selectedId));
    setSelectedId(null);
  };
  // 단일 클릭 = 인라인 편집 모드 진입. 드래그(임계 4px 초과) = 위치 이동.
  // SelectionFrame 핸들은 stopPropagation 으로 이쪽으로 안 흐름.
  const startMove = (e: React.PointerEvent, id: string) => {
    // 편집 중인 박스는 drag-move 금지 — 텍스트 셀렉트가 깨진다.
    if (id === editingId) return;
    e.stopPropagation();
    setSelectedId(id);
    if (editingId && editingId !== id) setEditingId(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const overlay = overlays.find((o) => o.id === id);
    if (!overlay) return;
    const origX = overlay.x;
    const origY = overlay.y;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (!moved && (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4)) {
        moved = true;
      }
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, x: clamp(origX + dx, 0, 1), y: clamp(origY + dy, 0, 1) } : o
        ),
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved) {
        // 클릭으로 끝남 → 인라인 편집 모드.
        setEditingId(id);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // === RESIZE (SE 모서리 핸들) ===
  // 인스타처럼 SE 모서리에서 폭 비례로 scale 조정. 회전 보정 포함.
  const startResize = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const node = overlayRefs.current.get(id);
    if (!node) return;
    const startBoxW = node.offsetWidth;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const overlay = overlays.find((o) => o.id === id);
    if (!overlay) return;
    const startScale = overlay.scale;
    const startRotation = overlay.rotation;

    const onMove = (ev: PointerEvent) => {
      // 회전 보정: 화면 dx/dy 를 회전된 박스의 로컬 축으로 사영
      // offsetWidth 는 transform 영향을 받지 않으므로 회전 전 박스 폭의 단일 진실.
      const rad = (startRotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // 박스 폭 축(회전 후) 단위벡터 = (cos θ, sin θ).
      // screen Δ 를 이 축에 사영 = dx·cos + dy·sin.
      const localDx =
        (ev.clientX - startClientX) * cos + (ev.clientY - startClientY) * sin;
      const newW = Math.max(20, startBoxW + localDx);
      const ratio = newW / startBoxW;
      const newScale = clamp(startScale * ratio, 0.2, 6);
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, scale: newScale } : o)),
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // === ROTATE (상단 핸들) ===
  // 박스 중심 → 포인터 각도로 회전. 매끄러운 갱신.
  const startRotate = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const overlay = overlays.find((o) => o.id === id);
    if (!overlay) return;
    const startRotation = overlay.rotation;
    const canvasRect = canvas.getBoundingClientRect();
    const centerX = canvasRect.left + overlay.x * canvasRect.width;
    const centerY = canvasRect.top + overlay.y * canvasRect.height;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    const baseRotation = startRotation - startAngle;

    const onMove = (ev: PointerEvent) => {
      const a = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * (180 / Math.PI);
      let next = baseRotation + a;
      while (next > 180) next -= 360;
      while (next < -180) next += 360;
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, rotation: next } : o)),
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleSubmit = async () => {
    if (!bgFile && !bgColor) {
      toast(t('createStory.requireBackground'), { duration: 2000 });
      return;
    }
    const cleanOverlays = overlays
      .map((o) => ({ ...o, text: o.text.trim() }))
      .filter((o) => o.text.length > 0);
    setIsSubmitting(true);
    try {
      await onSubmit({
        mediaFile: bgFile ?? undefined,
        bgColor: bgFile ? undefined : bgColor,
        overlays: cleanOverlays,
      });
      toast(t('createStory.created'), { duration: 2000 });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create story:', error);
      toast(t('createStory.failed'), { duration: 2000 });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-full max-w-[100vw] p-0 gap-0 overflow-hidden border border-border/60',
          'rounded-t-2xl bottom-0 top-auto translate-y-0 left-0 translate-x-0',
          'max-h-[92vh]',
          'laptop:max-h-[90vh] laptop:w-[calc(100vw-2rem)] laptop:max-w-[760px]',
          'laptop:bottom-auto laptop:top-[50%] laptop:translate-y-[-50%]',
          'laptop:left-[50%] laptop:translate-x-[-50%] laptop:rounded-2xl',
          'bg-card text-card-foreground shadow-xl',
        )}
      >
        <DialogHeader className="relative flex-row items-center justify-between border-b border-border/60 px-4 py-3 laptop:px-6 laptop:py-4 space-y-0">
          <DialogTitle className="text-base laptop:text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            {t('createStory.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col laptop:flex-row laptop:min-h-[480px]">
          <div className="flex-1 flex items-center justify-center bg-muted/30 p-4 laptop:p-6">
            <div
              ref={setCanvasRef}
              className="relative aspect-square w-full max-w-[440px] rounded-2xl overflow-hidden bg-black select-none"
              onPointerDown={() => setSelectedId(null)}
            >
              {bgPreview ? (
                <>
                  <img
                    src={bgPreview}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                  {overlays.map((o) => {
                    const isSelected = o.id === selectedId;
                    return (
                      <div
                        key={o.id}
                        ref={(node) => setOverlayNode(o.id, node)}
                        onPointerDown={(e) => startMove(e, o.id)}
                        className="absolute cursor-move"
                        style={{
                          ...buildOverlayStyle(canvasSize.width, o),
                          touchAction: 'none',
                        }}
                      >
                        <div
                          className="relative inline-block"
                          style={{
                            color: o.color,
                            fontFamily: FONT_FAMILIES.find((f) => f.key === o.family)?.css,
                            fontWeight: o.weight,
                            textAlign: o.align,
                            lineHeight: 1.25,
                            maxWidth: '92%',
                            textShadow:
                              '0 1px 3px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.3)',
                            wordBreak: 'keep-all',
                          }}
                        >
                          {o.text || (
                            <span className="opacity-50">{t('createStory.textPlaceholder')}</span>
                          )}
                        </div>
                        {isSelected && (
                          <SelectionFrame
                            onResize={(e) => startResize(e, o.id)}
                            onRotate={(e) => startRotate(e, o.id)}
                            onDelete={removeSelected}
                            handleSize={HANDLE_SIZE}
                          />
                        )}
                      </div>
                    );
                  })}
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      addText();
                    }}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white hover:bg-black/70 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('createStory.addText')}
                  </button>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      'absolute inset-0 transition-colors',
                      isDragOver && 'ring-2 ring-inset ring-accent/60',
                    )}
                    style={{ background: bgColor }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) handleImageFile(file);
                    }}
                  />
                  {overlays.map((o) => {
                    const isSelected = o.id === selectedId;
                    const isEditing = o.id === editingId;
                    const textRef = (node: HTMLDivElement | null) => {
                      setOverlayNode(o.id, node);
                      // 편집 모드 진입 시: 텍스트를 DOM에 직접 주입 + caret 끝으로.
                      // React 는 이 overlay 의 children 을 다시 그리지 않으므로 caret 가 점프하지 않는다.
                      if (node && isEditing) {
                        if (node.textContent !== o.text) node.textContent = o.text;
                        if (document.activeElement !== node) {
                          node.focus();
                          const sel = window.getSelection();
                          if (sel) {
                            const range = document.createRange();
                            range.selectNodeContents(node);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                          }
                        }
                      }
                    };
                    return (
                      <div
                        key={o.id}
                        ref={textRef}
                        onPointerDown={(e) => startMove(e, o.id)}
                        className={cn(
                          'absolute max-w-[92%] rounded-md px-1 -mx-1',
                          // editing 모드에서 min 크기 고정 → placeholder↔텍스트 전환 시 휙휙 방지.
                          isEditing ? 'min-w-[120px] min-h-[36px] cursor-text' : 'cursor-move',
                          isEditing && 'outline outline-2 outline-dashed outline-accent/70',
                        )}
                        style={{
                          ...buildOverlayStyle(canvasSize.width, o),
                          touchAction: 'none',
                        }}
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        spellCheck={false}
                        onInput={(e) => {
                          const txt = e.currentTarget.textContent ?? '';
                          patchSelected({ text: txt });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingId(null);
                            (e.currentTarget as HTMLDivElement).blur();
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            // 인스타 스토어는 개행 없음. Enter = 편집 종료.
                            e.preventDefault();
                            setEditingId(null);
                            (e.currentTarget as HTMLDivElement).blur();
                          }
                        }}
                        onBlur={() => {
                          if (editingId === o.id) setEditingId(null);
                        }}
                      >
                        {/* editing 모드에서도 placeholder 를 같이 두되 opacity 0 으로 사이즈 고정. caret 만 따로. */}
                        {o.text || (
                          <span
                            className="pointer-events-none"
                            style={{ opacity: isEditing ? 0 : 0.5 }}
                          >
                            {t('createStory.textPlaceholder')}
                          </span>
                        )}
                        {isSelected && !isEditing && (
                          <SelectionFrame
                            onResize={(e) => startResize(e, o.id)}
                            onRotate={(e) => startRotate(e, o.id)}
                            onDelete={removeSelected}
                            handleSize={HANDLE_SIZE}
                          />
                        )}
                      </div>
                    );
                  })}
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      addText();
                    }}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-foreground/85 text-background px-3 py-1.5 text-xs font-medium shadow-md hover:bg-foreground transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('createStory.addText')}
                  </button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          <div className="laptop:w-[300px] laptop:border-l laptop:border-border/60 flex flex-col max-h-[44vh] laptop:max-h-none overflow-y-auto">
            {targetSystem && targetVisual && (
              <div className="px-4 pt-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/40 w-fit">
                  <div
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ background: targetVisual.gradient }}
                  />
                  <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                    {targetSystem.name}에 게시
                  </span>
                </div>
              </div>
            )}

            {selected ? (
              <SelectedOverlayPanel
                key={selected.id}
                overlay={selected}
                onPatch={patchSelected}
              />
            ) : bgPreview ? (
              <div className="px-4 py-4 flex flex-col gap-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('createStory.tip')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full gap-1.5"
                >
                  <ImageIcon className="w-4 h-4" />
                  {t('createStory.changeImage')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBgFile(null);
                    if (bgPreview) URL.revokeObjectURL(bgPreview);
                    setBgPreview(null);
                  }}
                  className="w-full gap-1.5 text-muted-foreground"
                >
                  {t('createStory.useColor')}
                </Button>
              </div>
             ) : (
              <div className="px-4 py-4 flex flex-col gap-4">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-2">
                    {t('createStory.presets')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={t('createStory.useImage')}
                      className="w-7 h-7 rounded-full border border-border/40 hover:scale-105 transition-transform flex items-center justify-center bg-muted/30"
                    >
                      <ImageIcon className="w-4 h-4 text-foreground/80" />
                    </button>
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBgColor(c)}
                        aria-label={c}
                        className={cn(
                          'w-7 h-7 rounded-full border transition-transform',
                          bgColor === c
                            ? 'border-foreground ring-2 ring-foreground/30 scale-110'
                            : 'border-border/40 hover:scale-105',
                        )}
                        style={{ background: c }}
                      />
                    ))}
                    <label
                      className={cn(
                        'w-7 h-7 rounded-full border transition-transform flex items-center justify-center cursor-pointer overflow-hidden',
                        !COLOR_PRESETS.some((c) => c.toLowerCase() === bgColor.toLowerCase())
                          ? 'border-foreground ring-2 ring-foreground/30 scale-110'
                          : 'border-border/40 hover:scale-105',
                      )}
                      style={{ background: bgColor }}
                    >
                      <input
                        ref={colorInputRef}
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label={t('createStory.customColor')}
                      />
                      <Palette className="w-3.5 h-3.5 mix-blend-difference text-white pointer-events-none" />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) setBgColor(v);
                    }}
                    placeholder="#000000"
                    maxLength={7}
                    className="mt-2 w-full h-8 px-2 rounded-md border border-border/40 bg-background text-xs font-mono"
                    aria-label={t('createStory.customColor')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 bg-card/95 backdrop-blur-sm p-3 laptop:p-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="flex items-center gap-2 laptop:gap-3">
            <Button
              variant="ghost"
              size="medium"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              {t('createStory.cancel')}
            </Button>
            <div className="ml-auto">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || (!bgFile && !bgColor)}
                className="min-w-[110px] bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('createStory.posting')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    {t('createStory.post')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 선택된 오버레이의 박스 윤곽 + 3개 핸들.
 * - dashed border: 박스 둘레
 * - 상단 중앙 동그라미: 회전 (가이드 라인 포함)
 * - SE 모서리 동그라미: 크기 조절
 * - 우상단 동그라미: 삭제
 *
 * 모든 핸들은 부모 transform(translate-50-50 rotate)을 따라 같이 회전한다 —
 * 인스타 동작과 일치.
 */
function SelectionFrame({
  onResize,
  onRotate,
  onDelete,
  handleSize,
}: {
  onResize: (e: React.PointerEvent) => void;
  onRotate: (e: React.PointerEvent) => void;
  onDelete: () => void;
  handleSize: number;
}) {
  // 모든 핸들 wrapper 는 44×44 (WCAG 권장 터치 영역), 시각 동그라미는 그 안에서 절대 중앙.
  return (
    <>
      <div
        className="pointer-events-none absolute inset-[-6px] rounded-[3px] border-2 border-dashed"
        style={{ borderColor: 'oklch(0.6 0.2 251)' }}
      />
      {/* 회전 핸들 wrapper + 시각 동그라미 */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: `-${handleSize + 14}px`, width: 44, height: 44 }}
      >
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{ top: 0, width: 1, height: handleSize, background: 'oklch(0.6 0.2 251 / 0.7)' }}
        />
        <button
          onPointerDown={onRotate}
          aria-label="rotate"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md flex items-center justify-center"
          style={{ width: handleSize, height: handleSize, background: 'oklch(0.6 0.2 251)' }}
        >
          <RotateCw className="w-3 h-3 text-white" />
        </button>
      </div>
      {/* 크기 핸들 wrapper */}
      <div
        className="absolute"
        style={{ right: `-${(44 - handleSize) / 2 - 2}px`, bottom: `-${(44 - handleSize) / 2 - 2}px`, width: 44, height: 44 }}
      >
        <button
          onPointerDown={onResize}
          aria-label="resize"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md flex items-center justify-center"
          style={{ width: handleSize, height: handleSize, background: 'oklch(0.6 0.2 251)' }}
        >
          <Hand className="w-3 h-3 text-white rotate-45" />
        </button>
      </div>
      {/* 삭제 핸들 wrapper */}
      <div
        className="absolute"
        style={{ right: `-${(44 - handleSize + 4) / 2 - 4}px`, top: `-${(44 - handleSize + 4) / 2 + 4}px`, width: 44, height: 44 }}
      >
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }}
          aria-label="delete"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md flex items-center justify-center"
          style={{ width: handleSize - 4, height: handleSize - 4, background: 'oklch(0.577 0.214 27)' }}
        >
          <Trash2 className="w-3 h-3 text-white" />
        </button>
      </div>
    </>
  );
}

function SelectedOverlayPanel({
  overlay,
  onPatch,
}: {
  overlay: Overlay;
  onPatch: (patch: Partial<Overlay>) => void;
}) {
  const { t } = useI18n();

  const alignOptions: { key: Overlay['align']; icon: typeof AlignLeft }[] = [
    { key: 'left', icon: AlignLeft },
    { key: 'center', icon: AlignCenter },
    { key: 'right', icon: AlignRight },
  ];

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('createStory.tip')}
      </p>

      {/* 색상 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('createStory.color')}
        </label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onPatch({ color: c })}
              className={
                'w-7 h-7 rounded-full border-2 transition-transform ' +
                (overlay.color.toLowerCase() === c.toLowerCase()
                  ? 'border-accent scale-110'
                  : 'border-border/60 hover:scale-105')
              }
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <label className="relative w-7 h-7 rounded-full border-2 border-border/60 cursor-pointer overflow-hidden flex items-center justify-center">
            <input
              type="color"
              value={overlay.color}
              onChange={(e) => onPatch({ color: e.target.value })}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <span
              className="w-5 h-5 rounded-full"
              style={{
                background:
                  'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
              }}
            />
          </label>
        </div>
      </div>

      {/* 폰트 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('createStory.font')}
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onPatch({ family: f.key })}
              style={{ fontFamily: f.css }}
              className={
                'rounded-lg border px-2 py-2 text-sm transition-colors ' +
                (overlay.family === f.key
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border/60 text-muted-foreground hover:bg-muted/40')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 두께 + 정렬 */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('createStory.weight')}
          </label>
          <button
            type="button"
            onClick={() => onPatch({ weight: overlay.weight === 700 ? 400 : 700 })}
            className={
              'inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-colors ' +
              (overlay.weight === 700
                ? 'border-accent bg-accent/10 text-foreground'
                : 'border-border/60 text-muted-foreground hover:bg-muted/40')
            }
          >
            <Bold className="w-4 h-4" />
            {overlay.weight === 700 ? t('createStory.bold') : t('createStory.regular')}
          </button>
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('createStory.align')}
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 p-1">
            {alignOptions.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => onPatch({ align: key })}
                className={
                  'flex items-center justify-center rounded py-1.5 transition-colors ' +
                  (overlay.align === key
                    ? 'bg-accent/15 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40')
                }
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Hand className="w-3 h-3" />
        {t('createStory.handleHint')}
      </div>
    </div>
  );
}
