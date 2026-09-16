'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2, Printer, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useBookings, useExpenses, useIncome } from '@/lib/admin/queries';
import { formatMoney, sumBy } from '@/lib/money';

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminReportsPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
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

  const filteredIncome = useMemo(
    () => income.filter((row) => row.income_date >= from && row.income_date <= to),
    [income, from, to],
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((row) => row.expense_date >= from && row.expense_date <= to),
    [expenses, from, to],
  );
  const filteredBookings = useMemo(
    () =>
      bookings.filter((row) => {
        const created = row.created_at.slice(0, 10);
        return created >= from && created <= to;
      }),
    [bookings, from, to],
  );

  const totalIncome = sumBy(filteredIncome, (i) => Number(i.amount));
  const totalExpenses = sumBy(filteredExpenses, (e) => Number(e.amount));
  const net = totalIncome - totalExpenses;

  const printReport = () => window.print();

  return (
    <>
      {error && (
        <div className="mb-4 rounded-[9px] border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-600 dark:text-red-400 print:hidden">
          {error}
        </div>
      )}

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 rounded-[11px] admin-hairline bg-white p-3 dark:bg-slate-900 print:hidden sm:mb-6 sm:gap-3 sm:p-4">
          <label className="min-w-0 text-xs">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              From
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-full min-w-0 rounded-[8px] admin-hairline bg-slate-50 px-2 text-[11px] text-slate-700 outline-none dark:bg-slate-950 dark:text-slate-200 sm:px-3 sm:text-sm"
            />
          </label>
          <label className="min-w-0 text-xs">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              To
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-full min-w-0 rounded-[8px] admin-hairline bg-slate-50 px-2 text-[11px] text-slate-700 outline-none dark:bg-slate-950 dark:text-slate-200 sm:px-3 sm:text-sm"
            />
          </label>
        <button
          type="button"
          onClick={printReport}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-[8px] bg-[#0a1628] px-3 text-xs font-semibold text-white hover:bg-[#12243d] sm:px-4 sm:text-sm"
        >
          <Printer className="mr-1.5 h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Print / Save PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {isPending ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0a1628] dark:text-slate-100" />
        </div>
      ) : (
        <div id="report-print-area" className="space-y-4 sm:space-y-6">
          <div className="overflow-hidden rounded-[13px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:p-6">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo.png"
                alt="Aeyyyy Traveller's Inn"
                className="h-10 w-10 rounded-full object-cover ring-2 ring-amber-100 sm:h-12 sm:w-12"
              />
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[#0a1628] dark:text-slate-100 sm:text-xl">
                  Aeyyyy Traveller&apos;s Inn
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 sm:text-sm">
                  Financial &amp; Booking Report
                </p>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:mt-4">
              <CalendarDays className="h-3 w-3" />
              {from} — {to}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 md:grid-cols-4">
              <div className="rounded-[10px] border border-sky-100 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/30">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">Bookings</p>
                  <CalendarDays className="h-3.5 w-3.5 text-sky-500" />
                </div>
                <p className="mt-1 text-xl font-black text-sky-950 dark:text-sky-100 sm:text-2xl">
                  {filteredBookings.length}
                </p>
              </div>
              <div className="rounded-[10px] border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Income</p>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <p className="report-money mt-1 truncate text-lg font-black text-emerald-700 sm:text-xl">
                  {formatMoney(totalIncome)}
                </p>
              </div>
              <div className="rounded-[10px] border border-rose-100 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600">Expenses</p>
                  <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                </div>
                <p className="report-money mt-1 truncate text-lg font-black text-rose-600 sm:text-xl">
                  {formatMoney(totalExpenses)}
                </p>
              </div>
              <div className="rounded-[10px] border border-violet-100 bg-violet-50 p-3 dark:border-violet-900/50 dark:bg-violet-950/30">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Net</p>
                  <Wallet className="h-3.5 w-3.5 text-violet-500" />
                </div>
                <p className="report-money mt-1 truncate text-lg font-black text-violet-800 dark:text-violet-200 sm:text-xl">
                  {formatMoney(net)}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 text-sm font-bold text-[#0a1628] dark:border-slate-800 dark:text-slate-100 sm:px-4 sm:py-3">
              <span>Bookings in range</span>
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {filteredBookings.length}
              </span>
            </div>
            <div className="max-h-[55dvh] space-y-2 overflow-y-auto p-2 md:hidden">
              {filteredBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-[9px] border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold text-slate-400">
                        {booking.booking_code}
                      </p>
                      <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                        {booking.name}
                      </p>
                    </div>
                    <p className="report-money shrink-0 text-sm font-black text-slate-900 dark:text-slate-100">
                      {formatMoney(Number(booking.amount || 0))}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold capitalize text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                      {booking.status}
                    </span>
                    <Link
                      href={`/admin/receipts/${booking.id}`}
                      prefetch
                      className="text-[10px] font-bold text-sky-600 print:hidden"
                    >
                      View receipt
                    </Link>
                  </div>
                </div>
              ))}
              {filteredBookings.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-slate-500">
                  No bookings in this date range.
                </p>
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase text-gray-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Guest</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-right print:hidden">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 dark:border-slate-800">
                      <td className="px-4 py-3">{b.booking_code}</td>
                      <td className="px-4 py-3">{b.name}</td>
                      <td className="px-4 py-3 capitalize">{b.status}</td>
                      <td className="report-money px-4 py-3 font-semibold">{formatMoney(Number(b.amount || 0))}</td>
                      <td className="px-4 py-3 text-right print:hidden">
                        <Link href={`/admin/receipts/${b.id}`} prefetch className="text-accent hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredBookings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                        No bookings in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
            <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
              <div className="border-b border-slate-200 px-3 py-2.5 text-sm font-bold text-[#0a1628] dark:border-slate-800 dark:text-slate-100 sm:px-4 sm:py-3">Income in range</div>
              <ul className="max-h-[55dvh] divide-y overflow-y-auto dark:divide-slate-800">
                {filteredIncome.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm sm:px-4 sm:py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold sm:text-sm">{row.title}</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 sm:text-xs">
                        {row.income_date} · {row.category}
                      </p>
                    </div>
                    <p className="report-money shrink-0 text-xs font-bold text-green-600 sm:text-sm">{formatMoney(Number(row.amount))}</p>
                  </li>
                ))}
                {filteredIncome.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">No income in range.</li>
                )}
              </ul>
            </div>
            <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
              <div className="border-b border-slate-200 px-3 py-2.5 text-sm font-bold text-[#0a1628] dark:border-slate-800 dark:text-slate-100 sm:px-4 sm:py-3">Expenses in range</div>
              <ul className="max-h-[55dvh] divide-y overflow-y-auto dark:divide-slate-800">
                {filteredExpenses.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm sm:px-4 sm:py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold sm:text-sm">{row.title}</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 sm:text-xs">
                        {row.expense_date} · {row.category}
                      </p>
                    </div>
                    <p className="report-money shrink-0 text-xs font-bold text-red-500 dark:text-red-400 sm:text-sm">{formatMoney(Number(row.amount))}</p>
                  </li>
                ))}
                {filteredExpenses.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">No expenses in range.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .report-money {
          font-variant-numeric: tabular-nums lining-nums;
          font-feature-settings: 'tnum' 1, 'lnum' 1;
          letter-spacing: -0.035em;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #report-print-area,
          #report-print-area * {
            visibility: visible !important;
          }
          #report-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          #report-print-area ul,
          #report-print-area > div {
            max-height: none !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </>
  );
}
