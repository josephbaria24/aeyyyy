'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminIcon, adminIcons } from '@/components/admin/AdminIcon';
import { useBookings, useExpenses, useIncome } from '@/lib/admin/queries';
import { formatMoney, sumBy } from '@/lib/money';

export default function AdminDashboardPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const bookingsQuery = useBookings();
  const incomeQuery = useIncome();
  const expensesQuery = useExpenses();

  const bookings = bookingsQuery.data ?? [];
  const income = incomeQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];
  const isPending =
    (bookingsQuery.isPending && !bookingsQuery.data) ||
    (incomeQuery.isPending && !incomeQuery.data) ||
    (expensesQuery.isPending && !expensesQuery.data);
  const error =
    bookingsQuery.error?.message ||
    incomeQuery.error?.message ||
    expensesQuery.error?.message ||
    '';

  const totalIncome = sumBy(income, (i) => Number(i.amount));
  const totalExpenses = sumBy(expenses, (e) => Number(e.amount));
  const net = totalIncome - totalExpenses;
  const pending = bookings.filter((b) => b.status === 'pending').length;
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const guests = new Set(bookings.map((b) => b.email.toLowerCase())).size;

  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const buckets = days.map((day) => ({ day, income: 0, expenses: 0 }));
    for (const row of income) {
      const d = new Date(row.income_date);
      if (!Number.isNaN(d.getTime())) buckets[d.getDay()].income += Number(row.amount) || 0;
    }
    for (const row of expenses) {
      const d = new Date(row.expense_date);
      if (!Number.isNaN(d.getTime())) buckets[d.getDay()].expenses += Number(row.amount) || 0;
    }
    return buckets;
  }, [income, expenses]);

  const recentBookings = bookings.slice(0, 6);

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-900 dark:text-slate-100">
        <AdminIcon icon={adminIcons.loader} width={36} height={36} />
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Income',
      value: formatMoney(totalIncome),
      icon: adminIcons.revenue,
      iconBg: 'bg-orange-100 text-orange-500 dark:bg-orange-950/50 dark:text-orange-400',
      delta: '+ income',
      up: true,
    },
    {
      label: 'Pending Bookings',
      value: String(pending),
      icon: adminIcons.pending,
      iconBg: 'bg-sky-100 text-sky-500 dark:bg-sky-950/50 dark:text-sky-400',
      delta: `${bookings.length} total`,
      up: false,
    },
    {
      label: 'Confirmed Stays',
      value: String(confirmed),
      icon: adminIcons.confirmed,
      iconBg: 'bg-orange-100 text-orange-500 dark:bg-orange-950/50 dark:text-orange-400',
      delta: '+ bookings',
      up: true,
    },
    {
      label: 'Unique Guests',
      value: String(guests),
      icon: adminIcons.guestsCard,
      iconBg: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-400',
      delta: '+ guests',
      up: true,
    },
  ];

  return (
    <>
      {error && (
        <div className="mb-4 rounded-[13px] border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
          {error.toLowerCase().includes('income') || error.toLowerCase().includes('expense') ? (
            <span className="mt-1 block text-xs">
              Tip: run <code>supabase/accounting-schema.sql</code> in the Supabase SQL Editor.
            </span>
          ) : null}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => (
          <div
            key={card.label}
            className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-5"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-[13px] ${card.iconBg}`}>
                <AdminIcon icon={card.icon} width={22} height={22} />
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  card.up ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                }`}
              >
                {card.delta}
              </span>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Revenue</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Income vs expenses by weekday</p>
            </div>
            <span className="rounded-full bg-slate-50 dark:bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Overview
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isDark ? '#f8fafc' : '#0f172a'}
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor={isDark ? '#f8fafc' : '#0f172a'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? '#334155' : '#e2e8f0'}
                  vertical={false}
                />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: 9,
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    background: isDark ? '#0f172a' : '#ffffff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    boxShadow: 'none',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke={isDark ? '#f8fafc' : '#0f172a'}
                  strokeWidth={2.5}
                  fill="url(#incomeFill)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Finance Snapshot</h2>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Current totals</p>
          <div className="mt-6 space-y-4">
            <div className="rounded-[13px] bg-emerald-50 p-4 dark:bg-emerald-900/45">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <AdminIcon icon={adminIcons.income} width={18} height={18} />
                <span className="text-xs font-semibold uppercase tracking-wide">Income</span>
              </div>
              <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-200">{formatMoney(totalIncome)}</p>
            </div>
            <div className="rounded-[13px] bg-rose-50 dark:bg-rose-950/40 p-4">
              <div className="flex items-center gap-2 text-rose-600">
                <AdminIcon icon={adminIcons.expense} width={18} height={18} />
                <span className="text-xs font-semibold uppercase tracking-wide">Expenses</span>
              </div>
              <p className="mt-2 text-xl font-bold text-rose-600">{formatMoney(totalExpenses)}</p>
            </div>
            <div className="rounded-[13px] bg-slate-50 dark:bg-slate-800/60 p-4">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <AdminIcon icon={adminIcons.net} width={18} height={18} />
                <span className="text-xs font-semibold uppercase tracking-wide">Net Profit</span>
              </div>
              <p className={`mt-2 text-xl font-bold ${net >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600'}`}>
                {formatMoney(net)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-3 admin-hairline-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Recent Bookings</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Latest guest reservation activity</p>
          </div>
          <Link
            href="/admin/rooms?tab=bookings"
            prefetch
            className="inline-flex items-center justify-center rounded-[9px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            + Manage bookings
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Booking</th>
                <th className="px-5 py-3 font-semibold">Guest</th>
                <th className="px-5 py-3 font-semibold">Destination</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((booking) => (
                <tr key={booking.id} className="border-t border-slate-50 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{booking.booking_code}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{booking.check_in}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{booking.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{booking.email}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{booking.destination}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-100">
                    {formatMoney(Number(booking.amount || 0))}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        booking.status === 'confirmed'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : booking.status === 'declined' || booking.status === 'cancelled'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                            : booking.status === 'rescheduled'
                              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          booking.status === 'confirmed'
                            ? 'bg-emerald-500'
                            : booking.status === 'declined' || booking.status === 'cancelled'
                              ? 'bg-rose-500'
                              : booking.status === 'rescheduled'
                                ? 'bg-sky-500'
                                : 'bg-amber-500'
                        }`}
                      />
                      {booking.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            href: '/admin/rooms?tab=bookings',
            title: 'Manage Bookings',
            desc: 'Confirm, cancel, and update booking amounts.',
            icon: adminIcons.bookings,
          },
          {
            href: '/admin/accounting',
            title: 'Accounting',
            desc: 'Track income, expenses, and net results.',
            icon: adminIcons.accounting,
          },
          {
            href: '/admin/reports',
            title: 'Reports & Receipts',
            desc: 'Generate printable reports and guest receipts.',
            icon: adminIcons.reports,
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-5 transition hover:-translate-y-0.5"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[9px] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              <AdminIcon icon={item.icon} width={20} height={20} />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
