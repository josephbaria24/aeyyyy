'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { ArrowUpRight } from 'lucide-react';
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
import {
  buildStatsTermOptions,
  dateInPeriod,
  localDateValue,
  parseLocalDate,
  periodBounds,
  statsPeriods,
  statsTermOption,
  type StatsPeriod,
} from '@/lib/admin/stats-period';
import { formatMoney, sumBy } from '@/lib/money';

export default function AdminDashboardPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const bookingsQuery = useBookings();
  const incomeQuery = useIncome();
  const expensesQuery = useExpenses();
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('month');
  const [statsDate, setStatsDate] = useState(() => localDateValue());

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

  const statsBounds = useMemo(
    () => periodBounds(statsPeriod, statsDate),
    [statsDate, statsPeriod],
  );
  const filteredIncome = useMemo(
    () => income.filter((row) => dateInPeriod(row.income_date, statsBounds)),
    [income, statsBounds],
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((row) => dateInPeriod(row.expense_date, statsBounds)),
    [expenses, statsBounds],
  );
  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) =>
        dateInPeriod(booking.created_at || booking.check_in, statsBounds),
      ),
    [bookings, statsBounds],
  );
  const statsTermOptions = useMemo(
    () =>
      buildStatsTermOptions(statsPeriod, [
        ...income.map((row) => row.income_date),
        ...expenses.map((row) => row.expense_date),
        ...bookings.map((booking) => booking.created_at || booking.check_in),
      ]),
    [bookings, expenses, income, statsPeriod],
  );
  const selectedStatsTerm = statsTermOption(
    statsPeriod,
    parseLocalDate(statsDate),
  ).value;

  const totalIncome = sumBy(filteredIncome, (i) => Number(i.amount));
  const totalExpenses = sumBy(filteredExpenses, (e) => Number(e.amount));
  const net = totalIncome - totalExpenses;
  const pending = filteredBookings.filter((b) => b.status === 'pending').length;
  const confirmed = filteredBookings.filter((b) => b.status === 'confirmed').length;
  const guests = new Set(filteredBookings.map((b) => b.email.toLowerCase())).size;
  const confirmationRate = filteredBookings.length
    ? Math.round((confirmed / filteredBookings.length) * 100)
    : 0;

  const chartData = useMemo(() => {
    type ChartBucket = {
      key: string;
      day: string;
      income: number;
      expenses: number;
    };

    const buckets: ChartBucket[] = [];
    const addDayBucket = (date: Date, label: string) => {
      buckets.push({
        key: localDateValue(date),
        day: label,
        income: 0,
        expenses: 0,
      });
    };
    const addMonthBucket = (date: Date) => {
      buckets.push({
        key: localDateValue(new Date(date.getFullYear(), date.getMonth(), 1)).slice(0, 7),
        day: date.toLocaleDateString(undefined, { month: 'short' }),
        income: 0,
        expenses: 0,
      });
    };

    if (statsPeriod === 'all') {
      const years = new Set(
        [...filteredIncome.map((row) => row.income_date), ...filteredExpenses.map((row) => row.expense_date)]
          .map((value) => parseLocalDate(value).getFullYear()),
      );
      if (years.size === 0) years.add(new Date().getFullYear());
      for (const year of Array.from(years).sort((a, b) => a - b)) {
        buckets.push({
          key: String(year),
          day: String(year),
          income: 0,
          expenses: 0,
        });
      }
    } else if (statsPeriod === 'year') {
      const anchor = parseLocalDate(statsDate);
      for (let month = 0; month < 12; month += 1) {
        addMonthBucket(new Date(anchor.getFullYear(), month, 1));
      }
    } else if (statsPeriod === 'quarter' && statsBounds) {
      for (let month = 0; month < 3; month += 1) {
        addMonthBucket(
          new Date(statsBounds.start.getFullYear(), statsBounds.start.getMonth() + month, 1),
        );
      }
    } else if (statsPeriod === 'month' && statsBounds) {
      const cursor = new Date(statsBounds.start);
      while (cursor < statsBounds.end) {
        addDayBucket(cursor, String(cursor.getDate()));
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (statsPeriod === 'week' && statsBounds) {
      const cursor = new Date(statsBounds.start);
      while (cursor < statsBounds.end) {
        addDayBucket(
          cursor,
          cursor.toLocaleDateString(undefined, { weekday: 'short' }),
        );
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const anchor = parseLocalDate(statsDate);
      addDayBucket(
        anchor,
        anchor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      );
    }

    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const keyForDate = (value: string) => {
      const date = parseLocalDate(value);
      if (statsPeriod === 'all') return String(date.getFullYear());
      if (statsPeriod === 'year' || statsPeriod === 'quarter') {
        return localDateValue(new Date(date.getFullYear(), date.getMonth(), 1)).slice(0, 7);
      }
      return localDateValue(date);
    };

    for (const row of filteredIncome) {
      const bucket = bucketMap.get(keyForDate(row.income_date));
      if (bucket) bucket.income += Number(row.amount) || 0;
    }
    for (const row of filteredExpenses) {
      const bucket = bucketMap.get(keyForDate(row.expense_date));
      if (bucket) bucket.expenses += Number(row.amount) || 0;
    }

    return buckets;
  }, [
    filteredExpenses,
    filteredIncome,
    statsBounds,
    statsDate,
    statsPeriod,
  ]);

  const recentBookings = filteredBookings.slice(0, 6);

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
      cardBg:
        'border-orange-200/70 bg-gradient-to-br from-orange-50 to-white dark:border-orange-900/40 dark:from-orange-950/30 dark:to-slate-900',
      delta: '+ income',
      up: true,
    },
    {
      label: 'Pending Bookings',
      value: String(pending),
      icon: adminIcons.pending,
      iconBg: 'bg-sky-100 text-sky-500 dark:bg-sky-950/50 dark:text-sky-400',
      cardBg:
        'border-sky-200/70 bg-gradient-to-br from-sky-50 to-white dark:border-sky-900/40 dark:from-sky-950/30 dark:to-slate-900',
      delta: `${filteredBookings.length} total`,
      up: false,
    },
    {
      label: 'Confirmed Stays',
      value: String(confirmed),
      icon: adminIcons.confirmed,
      iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
      cardBg:
        'border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-slate-900',
      delta: '+ bookings',
      up: true,
    },
    {
      label: 'Unique Guests',
      value: String(guests),
      icon: adminIcons.guestsCard,
      iconBg: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
      cardBg:
        'border-violet-200/70 bg-gradient-to-br from-violet-50 to-white dark:border-violet-900/40 dark:from-violet-950/30 dark:to-slate-900',
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

      <div className="mb-3 rounded-[11px] bg-slate-200/70 p-2 dark:bg-slate-800">
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Filter
            </span>
            <select
              value={statsPeriod}
              onChange={(event) => setStatsPeriod(event.target.value as StatsPeriod)}
              className="h-9 w-full min-w-0 rounded-[8px] border-0 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none dark:bg-slate-950 dark:text-slate-200"
            >
              {statsPeriods.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Term
            </span>
            <select
              value={selectedStatsTerm}
              disabled={statsPeriod === 'all'}
              onChange={(event) => setStatsDate(event.target.value)}
              className="h-9 w-full min-w-0 rounded-[8px] border-0 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none disabled:opacity-60 dark:bg-slate-950 dark:text-slate-200"
            >
              {statsTermOptions.map((term) => (
                <option key={term.value} value={term.value}>
                  {term.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="relative mb-3 overflow-hidden rounded-[16px] bg-slate-950 px-4 py-4 text-white sm:mb-5 sm:px-6 sm:py-5">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_85%_10%,rgba(56,189,248,0.32),transparent_32%),radial-gradient(circle_at_55%_120%,rgba(16,185,129,0.25),transparent_42%)]"
        />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300 sm:text-xs">
              Business snapshot
            </p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {formatMoney(net)}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">Current net balance</p>
          </div>
          <div
            className="flex shrink-0 items-center gap-3 rounded-[14px] border border-white/15 bg-white/5 px-3 py-2.5 backdrop-blur-sm sm:gap-3.5 sm:px-4 sm:py-3"
            title={`${confirmed} of ${filteredBookings.length} bookings are confirmed`}
            aria-label={`${confirmationRate}% of bookings are confirmed: ${confirmed} of ${filteredBookings.length}`}
          >
            <div
              className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full sm:h-16 sm:w-16"
              style={{
                background: `conic-gradient(#38bdf8 ${confirmationRate * 3.6}deg, rgba(255,255,255,.12) 0deg)`,
              }}
            >
              <div className="grid h-[calc(100%-7px)] w-[calc(100%-7px)] place-items-center rounded-full bg-slate-950">
                <span className="text-sm font-bold sm:text-base">{confirmationRate}%</span>
              </div>
            </div>
            <div className="min-w-0 max-w-[9.5rem] sm:max-w-[12rem]">
              <p className="text-sm font-semibold leading-tight">Bookings confirmed</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-300 sm:text-xs">
                {filteredBookings.length === 0
                  ? 'No bookings in this period yet'
                  : `${confirmed} of ${filteredBookings.length} booking${
                      filteredBookings.length === 1 ? '' : 's'
                    } confirmed`}
              </p>
              {pending > 0 && (
                <p className="mt-0.5 text-[10px] text-amber-300/90 sm:text-[11px]">
                  {pending} still pending
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-5 sm:gap-3 xl:grid-cols-4">
        {kpis.map((card) => (
          <div
            key={card.label}
            className={`min-w-0 rounded-[12px] border p-3 sm:p-4 ${card.cardBg}`}
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-8 w-8 items-center justify-center rounded-[9px] sm:h-10 sm:w-10 ${card.iconBg}`}>
                <AdminIcon icon={card.icon} width={19} height={19} />
              </div>
              <span
                className={`max-w-[5rem] truncate text-[9px] font-semibold sm:text-[11px] ${
                  card.up ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                }`}
              >
                {card.delta}
              </span>
            </div>
            <p className="mt-2 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-sm">{card.label}</p>
            <p className="mt-0.5 truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-5 sm:gap-4 xl:grid-cols-3">
        <div className="rounded-[12px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:p-5 xl:col-span-2">
          <div className="mb-2 flex items-center justify-between sm:mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Revenue</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Income vs expenses for the selected term
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500 sm:text-xs">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-500" />Income</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-400" />Expense</span>
            </div>
          </div>
          <div className="h-44 w-full sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="#0ea5e9"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#0ea5e9"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? '#334155' : '#e2e8f0'}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  interval="preserveStartEnd"
                  minTickGap={18}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
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
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  fill="url(#incomeFill)"
                  dot={statsPeriod === 'day' ? { r: 4, fill: '#0ea5e9' } : false}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#fb7185"
                  strokeWidth={2}
                  fill="transparent"
                  dot={statsPeriod === 'day' ? { r: 4, fill: '#fb7185' } : false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[12px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:p-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Finance Snapshot</h2>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Current totals</p>
          <div className="mt-3 grid grid-cols-3 gap-2 xl:mt-5 xl:grid-cols-1">
            <div className="rounded-[10px] bg-emerald-50 p-3 dark:bg-emerald-900/45 xl:p-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <AdminIcon icon={adminIcons.income} width={18} height={18} />
                <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">Income</span>
              </div>
              <p className="mt-2 truncate text-sm font-bold text-emerald-700 dark:text-emerald-200 sm:text-base xl:text-xl">{formatMoney(totalIncome)}</p>
            </div>
            <div className="rounded-[10px] bg-rose-50 p-3 dark:bg-rose-950/40 xl:p-4">
              <div className="flex items-center gap-2 text-rose-600">
                <AdminIcon icon={adminIcons.expense} width={18} height={18} />
                <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">Expenses</span>
              </div>
              <p className="mt-2 truncate text-sm font-bold text-rose-600 sm:text-base xl:text-xl">{formatMoney(totalExpenses)}</p>
            </div>
            <div className="rounded-[10px] bg-sky-50 p-3 dark:bg-sky-950/30 xl:p-4">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <AdminIcon icon={adminIcons.net} width={18} height={18} />
                <span className="hidden text-xs font-semibold uppercase tracking-wide sm:inline">Net Profit</span>
              </div>
              <p className={`mt-2 truncate text-sm font-bold sm:text-base xl:text-xl ${net >= 0 ? 'text-sky-700 dark:text-sky-300' : 'text-rose-600'}`}>
                {formatMoney(net)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] admin-hairline bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 admin-hairline-b px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Recent Bookings</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Latest guest reservation activity</p>
          </div>
          <Link
            href="/admin/rooms?tab=bookings"
            prefetch
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-[8px] bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 sm:px-4 sm:py-2 sm:text-sm"
          >
            Manage <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ul className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
          {recentBookings.map((booking) => (
            <li key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {booking.name}
                  </p>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      booking.status === 'confirmed'
                        ? 'bg-emerald-500'
                        : booking.status === 'declined' || booking.status === 'cancelled'
                          ? 'bg-rose-500'
                          : booking.status === 'rescheduled'
                            ? 'bg-sky-500'
                            : 'bg-amber-500'
                    }`}
                  />
                </div>
                <p className="truncate text-[11px] text-slate-400">
                  {booking.booking_code} · {booking.destination} · {booking.check_in}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-slate-800 dark:text-slate-100">
                {formatMoney(Number(booking.amount || 0))}
              </p>
            </li>
          ))}
          {recentBookings.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">No bookings yet.</li>
          )}
        </ul>

        <div className="hidden overflow-x-auto sm:block">
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

      <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-4">
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
            className="group min-w-0 rounded-[11px] admin-hairline bg-white p-3 transition hover:-translate-y-0.5 dark:bg-slate-900 sm:p-5"
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-[8px] bg-slate-100 text-slate-900 transition group-hover:bg-sky-100 group-hover:text-sky-700 dark:bg-slate-800 dark:text-slate-100 sm:mb-3 sm:h-10 sm:w-10">
              <AdminIcon icon={item.icon} width={20} height={20} />
            </div>
            <h3 className="truncate text-xs font-bold text-slate-900 dark:text-slate-100 sm:text-base">{item.title}</h3>
            <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">{item.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
