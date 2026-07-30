'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Printer } from 'lucide-react';
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

      <div className="mb-6 flex flex-col gap-3 rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-4 print:hidden sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="text-sm">
            <span className="mb-1 block text-gray-500 dark:text-slate-400">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-[9px] admin-hairline px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-500 dark:text-slate-400">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-[9px] admin-hairline px-3 py-2"
            />
          </label>
        </div>
        <button
          onClick={printReport}
          className="inline-flex items-center justify-center rounded-[9px] bg-[#0a1628] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#12243d]"
        >
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      {isPending ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0a1628] dark:text-slate-100" />
        </div>
      ) : (
        <div id="report-print-area" className="space-y-6">
          <div className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo.png"
                alt="Aeyyyy Traveller's Inn"
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <h2 className="text-xl font-bold text-[#0a1628] dark:text-slate-100">
                  Aeyyyy Traveller&apos;s Inn
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Financial & Booking Report · {from} to {to}
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Bookings</p>
                <p className="text-2xl font-bold">{filteredBookings.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Income</p>
                <p className="text-2xl font-bold text-green-600">{formatMoney(totalIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Expenses</p>
                <p className="text-2xl font-bold text-red-500 dark:text-red-400">{formatMoney(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Net</p>
                <p className="text-2xl font-bold">{formatMoney(net)}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 font-bold dark:border-slate-800 text-[#0a1628] dark:text-slate-100">Bookings in range</div>
            <div className="overflow-x-auto">
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
                      <td className="px-4 py-3">{formatMoney(Number(b.amount || 0))}</td>
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

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 font-bold dark:border-slate-800 text-[#0a1628] dark:text-slate-100">Income in range</div>
              <ul className="divide-y dark:divide-slate-800">
                {filteredIncome.map((row) => (
                  <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {row.income_date} · {row.category}
                      </p>
                    </div>
                    <p className="font-semibold text-green-600">{formatMoney(Number(row.amount))}</p>
                  </li>
                ))}
                {filteredIncome.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">No income in range.</li>
                )}
              </ul>
            </div>
            <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 font-bold dark:border-slate-800 text-[#0a1628] dark:text-slate-100">Expenses in range</div>
              <ul className="divide-y dark:divide-slate-800">
                {filteredExpenses.map((row) => (
                  <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {row.expense_date} · {row.category}
                      </p>
                    </div>
                    <p className="font-semibold text-red-500 dark:text-red-400">{formatMoney(Number(row.amount))}</p>
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
        }
      `}</style>
    </>
  );
}
