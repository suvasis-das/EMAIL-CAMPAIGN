'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';

  const { user, login, register, isLoading } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If user is already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        await register(name.trim(), email.trim(), password);
        setSuccessMessage('Account created! Welcome to Mailqueue.');
      } else {
        await login(email.trim(), password);
        setSuccessMessage('Signed in successfully.');
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoAccount() {
    setMode('signin');
    setEmail('demo@mailqueue.app');
    setPassword('DemoPassword123!');
    setError(null);
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-6 sm:py-12">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Brand identity header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-[#fafafa] text-[#09090b] font-mono text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_8px_rgba(0,0,0,0.5)]">
            MQ
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            {mode === 'signin' ? 'Sign in to Mailqueue' : 'Create an operator account'}
          </h1>
          <p className="text-[13px] text-zinc-400">
            {mode === 'signin'
              ? 'Access campaign queues, templates, and delivery telemetry.'
              : 'Set up credentials to orchestrate campaigns and manage leads.'}
          </p>
        </div>

        {/* Auth Mode Switcher */}
        <div className="surface-inset p-1 rounded-lg flex gap-1 border border-white/[0.08]">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-[#18181b] text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-white/[0.08]'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-[#18181b] text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] border border-white/[0.08]'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Demo Account Quick-Fill Card */}
        <div className="surface-inset p-3 rounded-lg border border-white/[0.08] flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="space-y-0.5">
              <div className="text-zinc-200 font-medium">Evaluation Demo Account</div>
              <div className="text-zinc-500 font-mono text-[11px]">demo@mailqueue.app</div>
            </div>
          </div>
          <button
            type="button"
            onClick={fillDemoAccount}
            className="btn-secondary h-7 px-2.5 rounded text-[11px] font-mono cursor-pointer"
          >
            Fill Demo
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Banner */}
        {successMessage && (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form panel */}
        <form
          onSubmit={handleSubmit}
          className="surface-panel rounded-xl p-6 border border-white/[0.08] space-y-4"
        >
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-zinc-300">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Suvasis Das"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#0c0c0f] border border-white/[0.1] text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-zinc-300">
              Email Address
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@company.com"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#0c0c0f] border border-white/[0.1] text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[12px] font-medium text-zinc-300">
                Password
              </label>
              {mode === 'signup' && (
                <span className="text-[11px] font-mono text-zinc-500">
                  Min. 6 chars
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-10 pl-9 pr-10 rounded-lg bg-[#0c0c0f] border border-white/[0.1] text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full h-10 rounded-lg text-[13px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <span>{submitting ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Security architecture footer */}
        <div className="text-center text-[11px] font-mono text-zinc-500 space-y-1">
          <div>Argon2/Bcrypt Password Hash · JWT Stateless Auth</div>
          <div>
            <Link href="/" className="text-zinc-400 hover:text-zinc-200 underline">
              Return to Console Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="surface-panel rounded-lg h-48 w-full max-w-[420px] animate-pulse" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
