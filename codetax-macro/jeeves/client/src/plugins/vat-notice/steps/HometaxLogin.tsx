import { useEffect, useCallback } from 'react';
import { useSession } from '../../../core/hooks/useSession';
import { useSSE } from '../../../core/hooks/useSSE';
import type { SSEEvent } from '../../../core/types';

interface HometaxLoginProps {
  onLoggedIn: () => void;
}

export function HometaxLogin({ onLoggedIn }: HometaxLoginProps) {
  const { status, login, setStatus } = useSession();

  // SSE로 로그인 상태 수신
  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'status') {
      if (event.message === 'logged-in') {
        setStatus({ loggedIn: true, isLoggingIn: false });
      } else if (event.message === 'logging-in') {
        setStatus({ isLoggingIn: true });
      } else if (event.message === 'idle') {
        setStatus({ loggedIn: false, isLoggingIn: false });
      }
    }
  }, [setStatus]);

  useSSE(handleEvent);

  // 로그인 완료 시 다음 스텝으로
  useEffect(() => {
    if (status.loggedIn) {
      onLoggedIn();
    }
  }, [status.loggedIn, onLoggedIn]);

  async function handleLogin() {
    try {
      await login();
    } catch (err: any) {
      console.error('Login error:', err.message);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 2</span>
        <h3 className="font-bold text-sm">홈택스 로그인</h3>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
          status.loggedIn ? 'bg-success/20 text-success' : 'bg-accent/20 text-accent'
        }`}>
          {status.loggedIn ? '✅ 세션 확인됨' : status.isLoggingIn ? '로그인 중...' : '대기 중'}
        </span>
      </div>

      <div className="p-5 bg-surface2 rounded-lg text-[13.5px] leading-[1.9] text-muted">
        열린 Chrome 창에서 공동인증서로 로그인해 주세요.
        <br />
        로그인이 완료되면 자동으로 다음 단계가 활성화됩니다.
      </div>

      {status.isLoggingIn && (
        <div className="mt-3 text-sm text-muted flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          세션 확인 중...
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={handleLogin}
          disabled={status.isLoggingIn || status.loggedIn}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
        >
          🔐 홈택스 로그인 시작
        </button>
      </div>
    </div>
  );
}
