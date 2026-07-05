import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';

interface LegalSection {
  title: string;
  content: string;
}

interface LegalPageProps {
  title: string;
  updated: string;
  sections: LegalSection[];
}

export function LegalPage({ title, updated, sections }: LegalPageProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-background via-background to-card/20 z-[400] overflow-y-auto pt-14 sm:pt-[64px] pb-[var(--safe-area-bottom)] animate-fade-in-up"
    >
      {/* Sticky back bar — 법적 문서에서 안정적 탈출 경로 보장 */}
      <div className="sticky top-14 sm:top-[64px] z-10 bg-background/85 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-[680px] mx-auto px-5 sm:px-8 py-2.5 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-accent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('legal.back')}
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
            법적 문서
          </span>
        </div>
      </div>

      <div className="max-w-[680px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-xs text-muted-foreground mb-8">
          {t('legal.lastUpdated')}: {updated}
        </p>

        {/* TOC (데스크톱에서 좌측 사이드바, 모바일은 본문 상단) */}
        <nav
          aria-label="목차"
          className="mb-10 p-4 rounded-2xl border border-border/40 bg-card/40"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 mb-2">
            목차
          </p>
          <ol className="space-y-1.5 text-sm">
            {sections.map((s, idx) => (
              <li key={idx} className="flex items-baseline gap-2">
                <span className="text-muted-foreground/50 tabular-nums text-xs">{String(idx + 1).padStart(2, '0')}</span>
                <a
                  href={`#section-${idx}`}
                  className="text-foreground/80 hover:text-accent transition-colors"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-6">
          {sections.map((section, idx) => (
            <section key={idx} id={`section-${idx}`} className="scroll-mt-32">
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-2 flex items-baseline gap-2">
                <span className="text-accent/60 tabular-nums text-sm">{String(idx + 1).padStart(2, '0')}</span>
                {section.title}
              </h2>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line select-text">
                {section.content}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/30 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('legal.back')}
          </Link>
          <p className="text-xs text-muted-foreground/50 mt-2">ION — {t('legal.tagline')}</p>
        </div>
      </div>
    </div>
  );
}
