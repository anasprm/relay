'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { errorMessage, consumeAuthNotice, useAuth } from '@/lib/AuthProvider';
import { api } from '@/lib/api';
import { siteScope, type SiteScope } from '@/lib/site';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UiStyleToggle } from '@/components/ui/UiStyleToggle';
import { Avatar } from '@/components/ui/Avatar';
import { Splash } from '@/components/ui/Splash';

const DEMO_ACCOUNTS = [
  { username: 'demo', password: 'demo123', name: 'Avery Quinn', accent: 'violet' as const },
  { username: 'alice', password: 'alice123', name: 'Alice Morgan', accent: 'indigo' as const },
  { username: 'bob', password: 'bob123', name: 'Bob Chen', accent: 'emerald' as const },
];

/** Demo credentials are a local-development convenience, never shown in production. */
function showDemoAccounts() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

interface AuthScreenProps {
  mode: 'login' | 'register';
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const router = useRouter();
  const { user, loading, login, register } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<SiteScope>('public');
  const [showDemo, setShowDemo] = useState(false);
  const [inviteRequired, setInviteRequired] = useState(false);

  const isRegister = mode === 'register';
  const privateSite = site === 'private';

  useEffect(() => {
    const scope = siteScope();
    setSite(scope);
    setShowDemo(showDemoAccounts());
    const notice = consumeAuthNotice();
    if (notice) setError(notice);

    if (scope === 'private') {
      api
        .get<{ privateInviteRequired: boolean }>('/api/auth/config')
        .then((config) => setInviteRequired(!!config.privateInviteRequired))
        .catch(() => setInviteRequired(false));
    }
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace('/chat');
  }, [loading, router, user]);

  if (loading || user) return <Splash label={user ? 'Opening your workspace' : 'Preparing your workspace'} />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Enter both your username and password.');
      return;
    }
    if (isRegister && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (isRegister && privateSite && inviteRequired && !inviteCode.trim()) {
      setError('Enter the family invite code.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register(cleanUsername, password, {
          inviteCode: inviteCode.trim() || undefined,
        });
      } else {
        await login(cleanUsername, password);
      }
      router.replace('/chat');
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  function useDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setUsername(account.username);
    setPassword(account.password);
    setConfirm(account.password);
    setError(null);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <UiStyleToggle compact />
          <ThemeToggle compact />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:pb-16">
        <div className="w-full max-w-[400px] rounded-xl border border-line bg-panel p-6 shadow-[0_1px_3px_rgba(11,20,26,0.08)] sm:p-8">
          <p className="text-[12px] text-muted">
            {privateSite ? 'Family workspace' : 'Public workspace'}
          </p>

          <h1 className="mt-2 text-[22px] font-semibold leading-[28px] tracking-[-0.01em] text-ink">
            {isRegister
              ? privateSite
                ? 'Create your family account'
                : 'Create your account'
              : privateSite
                ? 'Sign in to your family space'
                : 'Sign in to Relay'}
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[19px] text-muted">
            {isRegister
              ? privateSite
                ? inviteRequired
                  ? 'Choose a username and enter the invite code from the family owner.'
                  : 'Choose a username. Only this family workspace will be visible to you.'
                : 'Choose a unique username to start messaging.'
              : privateSite
                ? 'Only family accounts can sign in here.'
                : 'Enter your username and password to continue.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="mb-1.5 block text-[12px] font-medium text-muted">
                Username
              </label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Your username"
                className="h-11 w-full rounded-lg border border-transparent bg-panel-2 px-3.5 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
              />
              {isRegister && (
                <p className="mt-1.5 text-[11.5px] text-faint">
                  3–20 characters · letters, numbers, underscores
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[12px] font-medium text-muted">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder={isRegister ? 'At least 6 characters' : 'Your password'}
                  className="h-11 w-full rounded-lg border border-transparent bg-panel-2 px-3.5 pr-11 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-[12px] font-medium text-muted">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className="h-11 w-full rounded-lg border border-transparent bg-panel-2 px-3.5 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
                />
              </div>
            )}

            {isRegister && privateSite && inviteRequired && (
              <div>
                <label htmlFor="inviteCode" className="mb-1.5 block text-[12px] font-medium text-muted">
                  Family invite code
                </label>
                <input
                  id="inviteCode"
                  name="inviteCode"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Code from the family owner"
                  className="h-11 w-full rounded-lg border border-transparent bg-panel-2 px-3.5 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
                />
                <p className="mt-1.5 text-[11.5px] text-faint">
                  Accounts created here stay inside this family workspace.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] leading-[18px] text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-70',
                submitting && 'cursor-default',
              )}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {isRegister ? 'Creating account…' : 'Signing in…'}
                </>
              ) : isRegister ? (
                'Create account'
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-muted">
            {isRegister ? 'Already have an account?' : privateSite ? 'New to this workspace?' : 'New to Relay?'}{' '}
            <Link
              href={isRegister ? '/login' : '/register'}
              className="font-medium text-accent-strong hover:underline"
            >
              {isRegister ? 'Sign in' : privateSite ? 'Create a family account' : 'Create an account'}
            </Link>
          </p>

          {showDemo && !privateSite && (
            <div className="mt-6 border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-muted">
                  Demo accounts
                </p>
                <span className="text-[11.5px] text-faint">Click to fill</span>
              </div>
              <div className="mt-2 space-y-0.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => useDemo(account)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-panel-2"
                  >
                    <Avatar user={{ displayName: account.name, accent: account.accent }} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{account.name}</span>
                      <span className="block truncate text-[11.5px] text-faint">
                        {account.username} / {account.password}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 px-2 text-[11.5px] leading-[17px] text-faint">
                Local development only. Open a second browser profile to test delivery and calls.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="shrink-0 pb-5 text-center text-[11.5px] text-faint">
        Developed by Muhammed Anas.v
      </footer>
    </div>
  );
}
