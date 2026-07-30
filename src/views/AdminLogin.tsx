'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (!data.session) throw new Error('Login succeeded but no session was created.');

      toast.success('Signed in');
      router.push('/admin');
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      setError(message);
      toast.error('Sign-in failed', { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#dceef8] flex items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#eef7fc_0%,_#cfe8f6_45%,_#b7dcf0_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
        <div className="absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white/50 to-transparent" />

      <Link
        href="/"
        className="absolute left-6 top-6 z-20 flex items-center gap-2.5 text-[#0a1628]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.png"
          alt="Aeyyyy Traveller's Inn"
          className="h-9 w-9 rounded-full object-cover ring-1 ring-black/10"
        />
        <span className="text-sm font-semibold tracking-wide">Aeyyyy</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-[400px] rounded-[28px] border border-white/70 bg-white/55 p-8 shadow-[0_20px_60px_rgba(15,40,70,0.12)] backdrop-blur-2xl md:p-10"
      >
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt="Aeyyyy Traveller's Inn"
            className="mx-auto mb-5 h-16 w-16 rounded-full object-cover shadow-sm ring-1 ring-black/5"
          />
          <h1 className="text-2xl font-bold tracking-tight text-[#0a1628]">
            Sign in with email
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Access the Aeyyyy Traveller&apos;s Inn admin portal to manage bookings and guests.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <label className="flex items-center gap-3 rounded-2xl bg-[#eef2f6] px-4 py-3.5 transition-shadow focus-within:ring-2 focus-within:ring-[#0a1628]/15">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              className="w-full bg-transparent text-sm text-[#0a1628] placeholder:text-slate-400 outline-none"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl bg-[#eef2f6] px-4 py-3.5 transition-shadow focus-within:ring-2 focus-within:ring-[#0a1628]/15">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              className="w-full bg-transparent text-sm text-[#0a1628] placeholder:text-slate-400 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-slate-400 transition-colors hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </label>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              className="text-xs font-medium text-slate-500 transition-colors hover:text-[#0a1628]"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0a1628] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.01] hover:bg-[#12243d] disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing in...' : 'Get Started'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
