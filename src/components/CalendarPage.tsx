import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pencil, Trash2, CalendarDays, AlignLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreatePostModal } from '@/components/CreatePostModal';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { useImageCropper } from '@/hooks/useImageCropper';
import { cn } from '@/lib/utils';
import type { Post } from '@/types';

interface CalendarPageProps {
  posts: Post[];
  view: 'month' | 'detail' | 'expanded';
  onViewChange: (view: 'month' | 'detail' | 'expanded') => void;
  onDeletePost: (postId: string) => void;
  onUpdatePost: (postId: string, opts: { content: string; mediaFile?: File }) => Promise<void>;
  onWritePost: () => void;
  onPostClick: (post: Post) => void;
  currentUserId: string;
}

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateTime(dateStr: string, isKorean: boolean): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? (isKorean ? '오전' : 'AM') : (isKorean ? '오후' : 'PM');
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const datePart = isKorean
    ? `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS_KO[d.getDay()]}`
    : `${MONTHS_EN[d.getMonth()]} ${d.getDate()} ${WEEKDAYS_EN[d.getDay()]}`;
  return `${datePart} ${ampm} ${hour12}:${m}`;
}

export function CalendarPage({ posts, view, onViewChange, onDeletePost, onUpdatePost, onWritePost, onPostClick, currentUserId }: CalendarPageProps) {
  const { t, locale } = useI18n();
  const { requestCrop, CropModal } = useImageCropper();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const isKorean = locale === 'ko';
  const DAYS = isKorean ? DAYS_KO : DAYS_EN;
  const MONTHS = isKorean ? MONTHS_KO : MONTHS_EN;
  const WEEKDAYS = isKorean ? WEEKDAYS_KO : WEEKDAYS_EN;

  const isOnCurrentMonth =
    currentYear === today.getFullYear() && currentMonth === today.getMonth();

  const postsByDate = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (!post.createdAt) continue;
      const dateKey = getDateKey(new Date(post.createdAt));
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, post]);
    }
    return map;
  }, [posts]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [currentYear, currentMonth]);

  // Always render 6 rows so the grid is visually stable across months.
  // Pad with nulls to a multiple of 7 (already true) and to 42 cells total.
  const paddedCalendarDays = useMemo(() => {
    const out = [...calendarDays];
    while (out.length < 42) out.push(null);
    return out;
  }, [calendarDays]);

  const selectedDatePosts = useMemo(() => {
    if (!selectedDate) return [];
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    return posts
      .filter(post => {
        if (!post.createdAt) return false;
        const d = new Date(post.createdAt);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      })
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }, [selectedDate, posts]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handlePrevDay = () => {
    setSelectedDate(prev => {
      if (!prev) return null;
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      if (!prev) return null;
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const handleDateClick = (day: number) => {
    setSelectedDate(new Date(currentYear, currentMonth, day));
    onViewChange('detail');
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    onPostClick(post);
  };

  const handleDelete = (postId: string) => {
    onDeletePost(postId);
    toast(t('myPage.deleted'), { duration: 2000 });
    onViewChange('detail');
    setSelectedPost(null);
  };

  const handleEditSubmit = async (postId: string, opts: { content: string; mediaFile?: File }) => {
    await onUpdatePost(postId, opts);
    setEditModalOpen(false);
    setSelectedPost(null);
    onViewChange('detail');
  };

  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const getPostsForCell = (day: number): Post[] =>
    postsByDate.get(getDateKey(new Date(currentYear, currentMonth, day))) || [];

  const renderMonthView = () => (
    <div className="flex h-full flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentYear}-${currentMonth}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex flex-1 flex-col"
        >
          {/* ── Header ── */}
          <div className="mb-4 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </Button>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
              <h2 className="font-display text-[16px] font-semibold tracking-tight text-foreground whitespace-nowrap">
                {isKorean
                  ? `${currentYear}년 ${MONTHS[currentMonth]}`
                  : `${MONTHS[currentMonth]} ${currentYear}`}
              </h2>
              {!isOnCurrentMonth && (
                <button
                  onClick={goToToday}
                  className="shrink-0 rounded-full bg-accent/12 px-2.5 py-0.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
                  aria-label={t('calendar.today')}
                >
                  {t('calendar.today')}
                </button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </Button>
          </div>

          {/* ── Day-of-week labels ── */}
          <div className="mb-2 grid grid-cols-7">
            {DAYS.map((day, idx) => (
              <div
                key={day}
                className={cn(
                  'py-1.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em]',
                  idx === 0
                    ? 'text-rose-500/80 dark:text-rose-400/80'
                    : idx === 6
                      ? 'text-sky-500/80 dark:text-sky-400/80'
                      : 'text-muted-foreground',
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* ── Calendar grid (6 stable rows) ── */}
          <div className="grid grid-cols-7 gap-1.5 min-h-0 flex-1" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
            {paddedCalendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} aria-hidden className="rounded-xl" />;
              }

              const dayPosts = getPostsForCell(day);
              const postCount = dayPosts.length;
              const firstPost = dayPosts[0];
              const isTodayCell = isToday(day);
              const hasMedia = !!firstPost?.media;

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={cn(
                    'group relative flex flex-col h-full overflow-hidden rounded-xl border border-border/40 bg-card/40 text-left transition-all duration-200',
                    'hover:border-accent/40 hover:bg-card hover:shadow-sm',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    isTodayCell &&
                      'border-accent bg-accent/[0.08] shadow-[0_0_0_1px_oklch(var(--accent)/0.45)]',
                  )}
                >
                  {/* Day number chip — top-left, always visible */}
                  <span
                    className={cn(
                      'relative z-10 m-1.5 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums leading-none',
                      hasMedia
                        ? 'bg-background/90 text-foreground backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
                        : isTodayCell
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground/80 group-hover:text-foreground',
                    )}
                  >
                    {day}
                    {postCount > 0 && (
                      <span className={cn(
                        'absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-bold leading-none min-w-[14px] h-[14px] px-1',
                        postCount > 1
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted-foreground/70 text-background'
                      )}>
                        {postCount > 1 ? `+${postCount - 1}` : ''}
                      </span>
                    )}
                  </span>

                  {/* Post thumbnail or media */}
                  {postCount > 0 && (
                    <div className="relative flex-1 w-full mt-1 overflow-hidden rounded-lg">
                      {firstPost.mediaType === 'video' ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <video
                            src={firstPost.media}
                            className="w-full h-full object-cover rounded-lg"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                            <svg className="w-4 h-4 dark:text-gray-100 text-black drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      ) : firstPost.media ? (
                        <>
                          <img
                            src={firstPost.media}
                            alt=""
                            className="w-full h-full object-cover rounded-lg"
                            draggable={false}
                          />
                          {postCount > 1 && (
                            <div className="absolute bottom-1 right-1 dark:text-gray-100 text-black text-[10px] font-medium px-1">
                              +{postCount - 1}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="w-full h-full flex items-center justify-center rounded-lg px-1">
                            <span className="text-[11px] dark:text-gray-100 text-black leading-relaxed line-clamp-2 text-center truncate">
                              {firstPost.content.slice(0, 8)}{firstPost.content.length > 8 ? '…' : ''}
                            </span>
                          </div>
                          {postCount > 1 && (
                            <div className="absolute bottom-1 right-1 dark:text-gray-100 text-black text-[11px] font-medium px-1">
                              +{postCount - 1}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  const renderDetailView = () => {
    if (!selectedDate) return null;

    const weekdayName = WEEKDAYS[selectedDate.getDay()];
    const dateLabel = isKorean
      ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 ${weekdayName}`
      : `${weekdayName}, ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`;

    return (
      <div className="flex h-full flex-col">
        {/* Header: ◀ 날짜 ▶ */}
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevDay}
            aria-label="Previous day"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Button>

          <div className="flex flex-1 items-center justify-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <span className="font-display text-[16px] font-semibold tracking-tight text-foreground">
              {dateLabel}
            </span>
            {selectedDatePosts.length > 0 && (
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {selectedDatePosts.length}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextDay}
            aria-label="Next day"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </Button>
        </div>

        {selectedDatePosts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40">
              <CalendarDays className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">{t('calendar.noPostsThisDate')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onWritePost}
              className="gap-1.5 border-accent/30 hover:bg-accent/10 text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              {isKorean ? '글쓰기' : 'Write a post'}
            </Button>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {selectedDatePosts.map((post, idx) => (
              <motion.button
                key={post.id}
                onClick={() => handlePostClick(post)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-card p-2.5 text-left transition-all duration-200 hover:border-accent/40 hover:bg-card/80 hover:shadow-sm"
              >
                {post.media ? (
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {post.mediaType === 'video' ? (
                      <video
                        src={post.media}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={post.media}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <AlignLeft className="h-5 w-5 text-muted-foreground/50" strokeWidth={1.5} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-foreground/90">
                    {post.content || (isKorean ? '미디어' : 'Media')}
                  </p>
                  {post.createdAt && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatTime(post.createdAt)}
                    </span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExpandedView = () => {
    if (!selectedPost) return null;

    return (
      <div className="flex h-full flex-col">
        {/* Header: ◀ 날짜 ▶ */}
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevDay}
            aria-label="Previous day"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Button>

          <div className="flex flex-1 items-center justify-center gap-2">
            <span className="font-display text-[16px] font-semibold tracking-tight text-foreground">
              {selectedDate
                ? isKorean
                  ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 ${WEEKDAYS[selectedDate.getDay()]}`
                  : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${currentYear}`
                : ''}
            </span>
            {selectedPost?.authorId === currentUserId && selectedPost?.createdAt && (
              <span className="text-xs text-muted-foreground">
                {formatDateTime(selectedPost.createdAt, isKorean)}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextDay}
            aria-label="Next day"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 justify-center overflow-y-auto">
          <div className="w-full max-w-[400px]">
            {selectedPost.media && (
              <div className="mb-3 overflow-hidden rounded-xl bg-muted">
                {selectedPost.mediaType === 'video' ? (
                  <video
                    src={selectedPost.media}
                    className="aspect-[4/5] w-full object-cover"
                    controls
                    playsInline
                  />
                ) : (
                  <img
                    src={selectedPost.media}
                    alt=""
                    className="aspect-[4/5] w-full object-cover"
                    draggable={false}
                  />
                )}
              </div>
            )}
            {selectedPost.content && (
              <p className="whitespace-pre-wrap text-[15px] leading-[1.6] text-foreground/90">
                {selectedPost.content}
              </p>
            )}

            {/* Action buttons */}
            {selectedPost?.authorId === currentUserId && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(true)}
                  className="gap-1.5 flex-1 border-accent/30 hover:bg-accent/10"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isKorean ? '수정' : 'Edit'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(selectedPost.id)}
                  className="gap-1.5 flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isKorean ? '삭제' : 'Delete'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <CreatePostModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onSubmit={async () => {}}
          requestImageCrop={requestCrop}
          editPost={selectedPost}
          onEdit={handleEditSubmit}
        />
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-[640px] flex-col px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex-1 min-h-0 overflow-hidden">
          {view === 'month' && renderMonthView()}
          {view === 'detail' && renderDetailView()}
          {view === 'expanded' && renderExpandedView()}
        </div>
      </div>
      {CropModal}
    </div>
  );
}
