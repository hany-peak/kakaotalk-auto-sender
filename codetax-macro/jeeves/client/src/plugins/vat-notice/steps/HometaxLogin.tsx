import { useSession } from '../../../core/hooks/useSession';

interface HometaxLoginProps {
  onLoggedIn: () => void;
}

export function HometaxLogin({ onLoggedIn }: HometaxLoginProps) {
  const { status, login } = useSession();

  async function handleLogin() {
    try {
      await login();
    } catch (err: any) {
      console.error('Login error:', err.message);
    }
  }

  if (status.loggedIn) {
    onLoggedIn();
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 2</span>
        <h3 className="font-bold text-sm">HomeTax Login</h3>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
          status.loggedIn ? 'bg-success/20 text-success' : 'bg-accent/20 text-accent'
        }`}>
          {status.loggedIn ? 'Session confirmed' : status.isLoggingIn ? 'Logging in...' : 'Waiting'}
        </span>
      </div>

      <div className="p-5 bg-surface2 rounded-lg text-[13.5px] leading-[1.9] text-muted">
        Login with your certificate in the Chrome window.
        <br />
        The next step will activate automatically after login.
      </div>

      {status.isLoggingIn && (
        <div className="mt-3 text-sm text-muted flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Checking session...
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={handleLogin}
          disabled={status.isLoggingIn || status.loggedIn}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
        >
          🔐 Start HomeTax Login
        </button>
      </div>
    </div>
  );
}
