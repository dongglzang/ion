import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 사용자 친화적 fallback 영역 이름 (예: "피드", "월드"). 디버깅 + UX. */
  scope?: string;
  /** fallback 대신 통상 UI를 그대로 두고 에러만 콘솔에 남길지. dev용. */
  silent?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * React class component error boundary.
 *
 * - Lazy route의 mount 단계 에러 + 자식 component의 render 에러를 잡는다.
 * - 이벤트 핸들러 / 비동기 / SSR 에러는 잡지 못한다 (React docs 참고).
 * - Layout의 <Outlet/>을 감싸서, 어떤 자식 라우트에서 깨져도 fallback UI를
 *   보여주고 나머지(헤더 등)는 정상 동작.
 * - 에러는 콘솔 + future telemetry hook에 기록.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO: production telemetry (Sentry/PostHog/etc.) — 현재는 콘솔만.
    console.error('[ErrorBoundary]', this.props.scope ?? 'unknown', error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.silent) {
      // dev/probe 용: 자리는 차지하되 시각적 fallback은 안 그림.
      return null;
    }

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center min-h-[40vh]"
      >
        <div className="text-2xl font-semibold text-foreground">
          {this.props.scope ? `${this.props.scope}을(를) 불러오지 못했어요` : '화면을 불러오지 못했어요'}
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          일시적인 오류가 발생했어요. 잠시 후 다시 시도하거나 페이지를 새로고침해 주세요.
        </p>
        {import.meta.env.DEV && (
          <details className="mt-2 max-w-lg text-left text-xs text-muted-foreground/70 font-mono">
            <summary className="cursor-pointer">에러 상세 (dev only)</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}\n{error.stack}</pre>
          </details>
        )}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-95"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted/50 active:scale-95"
          >
            페이지 새로고침
          </button>
        </div>
      </div>
    );
  }
}
