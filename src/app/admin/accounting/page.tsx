'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, FileImage, Loader2, Plus, Search, Trash2, TrendingDown, TrendingUp, Upload, Wallet, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useExpenses, useIncome, useInvalidateAdmin, useBookings, useEventBookings } from '@/lib/admin/queries';
import { formatMoney, sumBy, SYSTEM_CURRENCY, SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
import { uploadToCloudinary } from '@/lib/upload';
import type { Expense, ExpenseCategory, Income, IncomeCategory } from '@/lib/types/accounting';
import {
  INCOME_SOURCE_BADGE,
  INCOME_SOURCE_LABEL,
  formatGuestCount,
  inferIncomeSource,
  resolveIncomeGuests,
  type IncomeSource,
} from '@/lib/accounting/income-source';
import { toast } from 'sonner';
import { logActivity } from '@/lib/admin/activity-log';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { fieldClass, fileInputClass, labelClass } from '@/components/admin/content/field';
import { cn } from '@/lib/utils';

const incomeCategories: IncomeCategory[] = ['booking', 'food', 'tour', 'other'];
const expenseCategories: ExpenseCategory[] = [
  'operations',
  'utilities',
  'payroll',
  'supplies',
  'maintenance',
  'marketing',
  'other',
];

type IncomeSourceFilter = 'all' | IncomeSource;

const incomeSourceFilters: { value: IncomeSourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'room', label: 'Room' },
  { value: 'event', label: 'Event' },
  { value: 'pool', label: 'Pool' },
  { value: 'other', label: 'Other' },
];

type StatsPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

const statsPeriods: { value: StatsPeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function periodBounds(period: StatsPeriod, anchorValue: string) {
  if (period === 'all') return null;

  const anchor = parseLocalDate(anchorValue);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();

  if (period === 'day') {
    return {
      start: new Date(year, month, day),
      end: new Date(year, month, day + 1),
    };
  }
  if (period === 'week') {
    const mondayOffset = (anchor.getDay() + 6) % 7;
    return {
      start: new Date(year, month, day - mondayOffset),
      end: new Date(year, month, day - mondayOffset + 7),
    };
  }
  if (period === 'month') {
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 1),
    };
  }
  if (period === 'quarter') {
    const quarterMonth = Math.floor(month / 3) * 3;
    return {
      start: new Date(year, quarterMonth, 1),
      end: new Date(year, quarterMonth + 3, 1),
    };
  }
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
  };
}

function statsPeriodLabel(period: StatsPeriod, anchorValue: string) {
  if (period === 'all') return 'All-time totals';
  const anchor = parseLocalDate(anchorValue);
  const bounds = periodBounds(period, anchorValue);

  if (period === 'day') {
    return anchor.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (period === 'week' && bounds) {
    const end = new Date(bounds.end);
    end.setDate(end.getDate() - 1);
    return `${bounds.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (period === 'month') {
    return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  if (period === 'quarter') {
    return `Q${Math.floor(anchor.getMonth() / 3) + 1} ${anchor.getFullYear()}`;
  }
  return String(anchor.getFullYear());
}

function statsTermOption(period: StatsPeriod, date: Date) {
  const anchor = localDateValue(date);
  if (period === 'day') {
    return { value: anchor, label: statsPeriodLabel(period, anchor) };
  }
  if (period === 'week') {
    const bounds = periodBounds(period, anchor);
    return {
      value: bounds ? localDateValue(bounds.start) : anchor,
      label: statsPeriodLabel(period, anchor),
    };
  }
  if (period === 'month') {
    const value = localDateValue(new Date(date.getFullYear(), date.getMonth(), 1));
    return { value, label: statsPeriodLabel(period, value) };
  }
  if (period === 'quarter') {
    const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
    const value = localDateValue(new Date(date.getFullYear(), quarterMonth, 1));
    return { value, label: statsPeriodLabel(period, value) };
  }
  if (period === 'year') {
    const value = localDateValue(new Date(date.getFullYear(), 0, 1));
    return { value, label: statsPeriodLabel(period, value) };
  }
  return { value: 'all', label: 'All time' };
}

function dateInPeriod(value: string, bounds: ReturnType<typeof periodBounds>) {
  if (!bounds) return true;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date >= bounds.start && date < bounds.end;
}

/** Display dates as "Sep. 10, 2026". */
function formatLedgerDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return value;
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${month}. ${date.getDate()}, ${date.getFullYear()}`;
}

function formatLedgerNotes(notes: string | null | undefined) {
  if (!notes) return '';
  return notes.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (match) => formatLedgerDate(match));
}

const emptyIncome = {
  title: '',
  category: 'booking' as IncomeCategory,
  amount: '',
  income_date: new Date().toISOString().slice(0, 10),
  notes: '',
};

const emptyExpense = {
  title: '',
  category: 'operations' as ExpenseCategory,
  amount: '',
  expense_date: new Date().toISOString().slice(0, 10),
  notes: '',
  receipt_url: '',
};

export default function AdminAccountingPage() {
  const incomeQuery = useIncome();
  const expensesQuery = useExpenses();
  const { data: roomBookings = [] } = useBookings();
  const { data: eventBookings = [] } = useEventBookings();
  const invalidate = useInvalidateAdmin();
  const income = incomeQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  const roomById = useMemo(
    () => new Map(roomBookings.map((b) => [b.id, b])),
    [roomBookings],
  );
  const roomByCode = useMemo(
    () => new Map(roomBookings.map((b) => [b.booking_code.toUpperCase(), b])),
    [roomBookings],
  );
  const eventByCode = useMemo(
    () => new Map(eventBookings.map((b) => [b.booking_code.toUpperCase(), b])),
    [eventBookings],
  );
  const isPending =
    (incomeQuery.isPending && !incomeQuery.data) ||
    (expensesQuery.isPending && !expensesQuery.data);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('month');
  const [statsDate, setStatsDate] = useState(() => localDateValue());
  const [entryType, setEntryType] = useState<'income' | 'expense'>('income');
  const [ledgerType, setLedgerType] = useState<'income' | 'expense'>('income');
  const [incomeSearch, setIncomeSearch] = useState('');
  const [incomeSourceFilter, setIncomeSourceFilter] = useState<IncomeSourceFilter>('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState(emptyIncome);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [pendingDeleteIncome, setPendingDeleteIncome] = useState<Income | null>(null);
  const [pendingDeleteExpense, setPendingDeleteExpense] = useState<Expense | null>(null);
  const [receiptExpenseId, setReceiptExpenseId] = useState('');
  const [attachingId, setAttachingId] = useState<string | null>(null);

  const expensesWithReceipts = useMemo(
    () => expenses.filter((e) => Boolean(e.receipt_url)),
    [expenses],
  );
  const expensesMissingReceipt = useMemo(
    () => expenses.filter((e) => !e.receipt_url),
    [expenses],
  );
  const filteredIncome = useMemo(() => {
    const term = incomeSearch.trim().toLowerCase();
    return income.filter((row) => {
      const source = inferIncomeSource(row);
      if (incomeSourceFilter !== 'all' && source !== incomeSourceFilter) return false;
      if (!term) return true;
      return [
        row.title,
        row.category,
        row.income_date,
        row.notes,
        row.amount,
        INCOME_SOURCE_LABEL[source],
        formatGuestCount(resolveIncomeGuests(row, roomById, roomByCode, eventByCode)),
      ].some((value) => String(value ?? '').toLowerCase().includes(term));
    });
  }, [income, incomeSearch, incomeSourceFilter, roomById, roomByCode, eventByCode]);

  const incomeSourceCounts = useMemo(() => {
    const counts: Record<IncomeSourceFilter, number> = {
      all: income.length,
      room: 0,
      event: 0,
      pool: 0,
      other: 0,
    };
    for (const row of income) {
      counts[inferIncomeSource(row)] += 1;
    }
    return counts;
  }, [income]);
  const filteredExpenses = useMemo(() => {
    const term = expenseSearch.trim().toLowerCase();
    if (!term) return expenses;
    return expenses.filter((row) =>
      [row.title, row.category, row.expense_date, row.notes, row.amount].some((value) =>
        String(value ?? '').toLowerCase().includes(term),
      ),
    );
  }, [expenseSearch, expenses]);

  const addIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('income').insert({
        title: incomeForm.title,
        category: incomeForm.category,
        amount: Number(incomeForm.amount),
        currency: SYSTEM_CURRENCY,
        income_date: incomeForm.income_date,
        notes: incomeForm.notes || null,
      });
      if (insertError) throw insertError;
      await logActivity({
        action: 'created',
        entity: 'income',
        summary: `Added income “${incomeForm.title}” (${incomeForm.category})`,
        details: { amount: Number(incomeForm.amount) },
      });
      setIncomeForm(emptyIncome);
      await invalidate(['income', 'activity']);
      toast.success('Income added');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add income';
      setError(message);
      toast.error('Could not add income', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('expenses').insert({
        title: expenseForm.title,
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        currency: SYSTEM_CURRENCY,
        expense_date: expenseForm.expense_date,
        notes: expenseForm.notes || null,
        receipt_url: expenseForm.receipt_url || null,
      });
      if (insertError) throw insertError;
      await logActivity({
        action: 'created',
        entity: 'expense',
        summary: `Added expense “${expenseForm.title}” (${expenseForm.category})`,
        details: { amount: Number(expenseForm.amount) },
      });
      setExpenseForm(emptyExpense);
      await invalidate(['expenses', 'activity']);
      toast.success('Expense added');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add expense';
      setError(message);
      toast.error('Could not add expense', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const deleteIncome = async (id: string) => {
    const supabase = createClient();
    const { error: err } = await supabase.from('income').delete().eq('id', id);
    if (err) {
      toast.error('Could not delete income', { description: err.message });
      return;
    }
    await logActivity({
      action: 'deleted',
      entity: 'income',
      entityId: id,
      summary: 'Deleted an income record',
    });
    await invalidate(['income', 'activity']);
    toast.success('Income deleted');
  };

  const deleteExpense = async (id: string) => {
    const supabase = createClient();
    const { error: err } = await supabase.from('expenses').delete().eq('id', id);
    if (err) {
      toast.error('Could not delete expense', { description: err.message });
      return;
    }
    await logActivity({
      action: 'deleted',
      entity: 'expense',
      entityId: id,
      summary: 'Deleted an expense record',
    });
    await invalidate(['expenses', 'activity']);
    toast.success('Expense deleted');
  };

  const onReceiptSelected = async (file: File | null) => {
    if (!file) return;
    setUploadingReceipt(true);
    setError('');
    try {
      const uploaded = await uploadToCloudinary(file, 'aeyyyy/receipts');
      setExpenseForm((prev) => ({ ...prev, receipt_url: uploaded.secure_url }));
      toast.success('Receipt uploaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Receipt upload failed';
      setError(message);
      toast.error('Receipt upload failed', { description: message });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const attachReceiptToExpense = async (expenseId: string, file: File | null) => {
    if (!file || !expenseId) {
      toast.error('Choose an expense, then pick a receipt file');
      return;
    }
    setAttachingId(expenseId);
    setError('');
    try {
      const uploaded = await uploadToCloudinary(file, 'aeyyyy/receipts');
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_url: uploaded.secure_url })
        .eq('id', expenseId);
      if (updateError) throw updateError;
      const expense = expenses.find((e) => e.id === expenseId);
      await logActivity({
        action: 'updated',
        entity: 'expense',
        entityId: expenseId,
        summary: `Attached receipt to expense “${expense?.title ?? expenseId}”`,
      });
      await invalidate(['expenses', 'activity']);
      toast.success('Receipt attached', {
        description: expense?.title,
      });
      setReceiptExpenseId('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not attach receipt';
      setError(message);
      toast.error('Could not attach receipt', { description: message });
    } finally {
      setAttachingId(null);
    }
  };

  const removeReceipt = async (expense: Expense) => {
    setAttachingId(expense.id);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_url: null })
        .eq('id', expense.id);
      if (updateError) throw updateError;
      await logActivity({
        action: 'updated',
        entity: 'expense',
        entityId: expense.id,
        summary: `Removed receipt from expense “${expense.title}”`,
      });
      await invalidate(['expenses', 'activity']);
      toast.success('Receipt removed');
    } catch (err) {
      toast.error('Could not remove receipt', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setAttachingId(null);
    }
  };

  const statsBounds = useMemo(
    () => periodBounds(statsPeriod, statsDate),
    [statsDate, statsPeriod],
  );
  const statsIncome = useMemo(
    () => income.filter((row) => dateInPeriod(row.income_date, statsBounds)),
    [income, statsBounds],
  );
  const statsExpenses = useMemo(
    () => expenses.filter((row) => dateInPeriod(row.expense_date, statsBounds)),
    [expenses, statsBounds],
  );
  const statsTermOptions = useMemo(() => {
    if (statsPeriod === 'all') return [{ value: 'all', label: 'All time' }];

    const dates = [
      new Date(),
      ...income.map((row) => parseLocalDate(row.income_date)),
      ...expenses.map((row) => parseLocalDate(row.expense_date)),
    ];
    const unique = new Map<string, string>();
    for (const date of dates) {
      const option = statsTermOption(statsPeriod, date);
      unique.set(option.value, option.label);
    }

    return Array.from(unique, ([value, label]) => ({ value, label })).sort((a, b) =>
      b.value.localeCompare(a.value),
    );
  }, [expenses, income, statsPeriod]);
  const selectedStatsTerm = statsTermOption(statsPeriod, parseLocalDate(statsDate)).value;
  const totalIncome = sumBy(statsIncome, (i) => Number(i.amount));
  const totalExpenses = sumBy(statsExpenses, (e) => Number(e.amount));
  const net = totalIncome - totalExpenses;
  const displayError =
    error ||
    (incomeQuery.error
      ? `${incomeQuery.error.message} — run supabase/accounting-schema.sql if tables are missing.`
      : '') ||
    (expensesQuery.error
      ? `${expensesQuery.error.message} — run supabase/accounting-schema.sql if tables are missing.`
      : '');

  return (
    <div className="accounting-page min-w-0">
      {displayError && (
        <div className="mb-3 rounded-[9px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 sm:mb-4 sm:px-4 sm:py-3">
          {displayError}
        </div>
      )}

      {isPending ? (
        <div className="flex h-48 items-center justify-center sm:h-64">
          <Loader2 className="h-7 w-7 animate-spin text-[#0a1628] dark:text-slate-100 sm:h-8 sm:w-8" />
        </div>
      ) : (
        <>
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

          <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-4">
            <div className="rounded-[12px] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-3 dark:border-emerald-900/40 dark:from-emerald-950/50 dark:to-slate-900 sm:p-5">
              <div className="mb-1 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 sm:h-4 sm:w-4" />
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 sm:text-xs">
                  Income
                </p>
              </div>
              <p className="truncate text-sm font-bold text-emerald-700 dark:text-emerald-300 sm:text-2xl">
                {formatMoney(totalIncome)}
              </p>
            </div>
            <div className="rounded-[12px] border border-rose-200/80 bg-gradient-to-br from-rose-50 to-white p-3 dark:border-rose-900/40 dark:from-rose-950/50 dark:to-slate-900 sm:p-5">
              <div className="mb-1 flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400 sm:h-4 sm:w-4" />
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300 sm:text-xs">
                  Expenses
                </p>
              </div>
              <p className="truncate text-sm font-bold text-rose-600 dark:text-rose-400 sm:text-2xl">
                {formatMoney(totalExpenses)}
              </p>
            </div>
            <div
              className={cn(
                'rounded-[12px] border p-3 sm:p-5',
                net >= 0
                  ? 'border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-900/40 dark:from-indigo-950/50 dark:to-slate-900'
                  : 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-white dark:border-rose-900/40 dark:from-rose-950/50 dark:to-slate-900',
              )}
            >
              <div className="mb-1 flex items-center gap-1">
                <Wallet
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4',
                    net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400',
                  )}
                />
                <p
                  className={cn(
                    'truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs',
                    net >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-700 dark:text-rose-300',
                  )}
                >
                  Net
                </p>
              </div>
              <p
                className={cn(
                  'truncate text-sm font-bold sm:text-2xl',
                  net >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-400',
                )}
              >
                {formatMoney(net)}
              </p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-1 rounded-[11px] bg-slate-200/70 p-1 dark:bg-slate-800 xl:hidden">
            <button
              type="button"
              onClick={() => setEntryType('income')}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-[8px] px-3 py-2 text-xs font-bold transition',
                entryType === 'income'
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300'
                  : 'text-slate-500 dark:text-slate-400',
              )}
            >
              <TrendingUp className="h-4 w-4" />
              Add income
            </button>
            <button
              type="button"
              onClick={() => setEntryType('expense')}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-[8px] px-3 py-2 text-xs font-bold transition',
                entryType === 'expense'
                  ? 'bg-white text-rose-700 shadow-sm dark:bg-slate-900 dark:text-rose-300'
                  : 'text-slate-500 dark:text-slate-400',
              )}
            >
              <TrendingDown className="h-4 w-4" />
              Add expense
            </button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-2 xl:gap-6">
            <form
              onSubmit={addIncome}
              className={cn(
                'rounded-[12px] border border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50/40 p-4 dark:border-emerald-900/40 dark:from-slate-900 dark:to-emerald-950/20 sm:p-5',
                entryType !== 'income' && 'hidden xl:block',
              )}
            >
              <div className="mb-3 flex items-center gap-2 sm:mb-4">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h2 className="text-base font-bold text-[#0a1628] dark:text-slate-100 sm:text-lg">Add Income</h2>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <input
                  required
                  placeholder="Title"
                  value={incomeForm.title}
                  onChange={(e) => setIncomeForm({ ...incomeForm, title: e.target.value })}
                  className={fieldClass}
                />
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <select
                    value={incomeForm.category}
                    onChange={(e) =>
                      setIncomeForm({ ...incomeForm, category: e.target.value as IncomeCategory })
                    }
                    className={fieldClass}
                  >
                    {incomeCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="relative min-w-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      {SYSTEM_CURRENCY_SYMBOL}
                    </span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={incomeForm.amount}
                      onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                      className={`${fieldClass} pl-8`}
                    />
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={incomeForm.income_date}
                  onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })}
                  className={fieldClass}
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={incomeForm.notes}
                  onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
                  className={`${fieldClass} h-10 resize-none sm:h-auto`}
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center rounded-[9px] bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:py-2.5"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Income
                </button>
              </div>
            </form>

            <form
              onSubmit={addExpense}
              className={cn(
                'rounded-[12px] border border-rose-200/70 bg-gradient-to-br from-white to-rose-50/40 p-4 dark:border-rose-900/40 dark:from-slate-900 dark:to-rose-950/20 sm:p-5',
                entryType !== 'expense' && 'hidden xl:block',
              )}
            >
              <div className="mb-3 flex items-center gap-2 sm:mb-4">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  <TrendingDown className="h-4 w-4" />
                </span>
                <h2 className="text-base font-bold text-[#0a1628] dark:text-slate-100 sm:text-lg">Add Expense</h2>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <input
                  required
                  placeholder="Title"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className={fieldClass}
                />
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <select
                    value={expenseForm.category}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        category: e.target.value as ExpenseCategory,
                      })
                    }
                    className={fieldClass}
                  >
                    {expenseCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="relative min-w-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      {SYSTEM_CURRENCY_SYMBOL}
                    </span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className={`${fieldClass} pl-8`}
                    />
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  className={fieldClass}
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className={`${fieldClass} h-10 resize-none sm:h-auto`}
                  rows={2}
                />
                <div>
                  <label className={labelClass}>Receipt image (Cloudinary)</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => void onReceiptSelected(e.target.files?.[0] ?? null)}
                    className={fileInputClass}
                  />
                  {uploadingReceipt && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Uploading...</p>}
                  {expenseForm.receipt_url && (
                    <a
                      href={expenseForm.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-xs text-accent"
                    >
                      Receipt attached
                    </a>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={saving || uploadingReceipt}
                  className="inline-flex w-full items-center justify-center rounded-[9px] bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 sm:w-auto sm:py-2.5"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Expense
                </button>
              </div>
            </form>
          </div>

          <div className="mb-4 overflow-hidden rounded-[12px] border border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-orange-50/50 shadow-sm shadow-amber-100/60 dark:border-amber-900/50 dark:from-amber-950/25 dark:to-orange-950/10 dark:shadow-none sm:mb-6">
            <button
              type="button"
              onClick={() => setReceiptsOpen((open) => !open)}
              aria-expanded={receiptsOpen}
              aria-controls="accounting-receipts-content"
              className="flex w-full cursor-pointer items-center justify-between gap-3 bg-gradient-to-r from-amber-100/80 via-orange-50/80 to-amber-50/70 p-4 text-left hover:from-amber-100 hover:to-orange-100/70 dark:from-amber-950/45 dark:via-orange-950/20 dark:to-amber-950/20 dark:hover:from-amber-950/60 sm:p-5"
            >
              <div className="flex items-start gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  <FileImage className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#0a1628] dark:text-slate-100 sm:text-lg">Receipts</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 sm:text-sm">
                    Upload and attach receipt images or PDFs to expense records.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className="hidden text-[11px] font-semibold text-slate-400 xs:block sm:text-xs">
                  {expensesWithReceipts.length} saved
                  {expensesMissingReceipt.length > 0 ? ` · ${expensesMissingReceipt.length} missing` : ''}
                </p>
                <span
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-full bg-amber-50 text-sm font-bold text-amber-700 transition-transform duration-300 dark:bg-amber-950/40 dark:text-amber-300',
                    receiptsOpen && 'rotate-180',
                  )}
                >
                  ↓
                </span>
              </div>
            </button>

            <div
              id="accounting-receipts-content"
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                receiptsOpen
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'pointer-events-none grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="max-h-[65vh] overflow-y-auto overscroll-contain border-t border-amber-200/70 bg-white/65 px-4 pb-4 pt-3 dark:border-amber-900/40 dark:bg-slate-900/65 sm:px-5 sm:pb-5">
              <div className="mb-4 grid gap-2 rounded-[10px] border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-900/30 dark:bg-amber-950/20 sm:mb-5 sm:gap-3 sm:p-4 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block min-w-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Attach to expense
                <select
                  value={receiptExpenseId}
                  onChange={(e) => setReceiptExpenseId(e.target.value)}
                  className={`${fieldClass} mt-1.5 bg-white dark:bg-slate-950`}
                >
                  <option value="">Select an expense…</option>
                  {expenses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatLedgerDate(row.expense_date)} · {row.title}
                      {row.receipt_url ? ' (has receipt)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className={cn(
                  'inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 sm:w-auto sm:py-2.5',
                  (!receiptExpenseId || attachingId) && 'pointer-events-none opacity-50',
                )}
              >
                {attachingId === receiptExpenseId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload receipt
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  disabled={!receiptExpenseId || Boolean(attachingId)}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = '';
                    void attachReceiptToExpense(receiptExpenseId, file);
                  }}
                />
              </label>
              </div>

              {expenses.length === 0 ? (
                <p className="rounded-[9px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                  Add an expense first, then upload its receipt here.
                </p>
              ) : expensesWithReceipts.length === 0 ? (
                <p className="rounded-[9px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                  No receipts yet. Select an expense above and upload a file.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                  {expensesWithReceipts.map((row) => {
                    const isPdf = /\.pdf($|\?)/i.test(row.receipt_url || '');
                    return (
                      <li
                        key={row.id}
                        className="overflow-hidden rounded-[10px] border border-amber-200/50 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10"
                      >
                      <a
                        href={row.receipt_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-32 bg-slate-100 dark:bg-slate-800 sm:aspect-[4/3] sm:h-auto"
                      >
                        {isPdf ? (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                            <FileImage className="h-8 w-8" />
                            <span className="text-xs font-semibold">PDF receipt</span>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.receipt_url!}
                            alt={`Receipt for ${row.title}`}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </a>
                      <div className="space-y-2 p-2.5 sm:p-3">
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {row.title}
                          </p>
                          <p className="text-[11px] text-slate-500 sm:text-xs">
                            {formatLedgerDate(row.expense_date)} · {formatMoney(Number(row.amount))}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          <a
                            href={row.receipt_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-[7px] border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold dark:border-slate-700 dark:bg-slate-900 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open
                          </a>
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-[7px] border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold dark:border-slate-700 dark:bg-slate-900 sm:px-2.5 sm:py-1.5 sm:text-[11px]">
                            {attachingId === row.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            Replace
                            <input
                              type="file"
                              accept="image/*,.pdf,application/pdf"
                              className="hidden"
                              disabled={Boolean(attachingId)}
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                e.target.value = '';
                                void attachReceiptToExpense(row.id, file);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={attachingId === row.id}
                            onClick={() => void removeReceipt(row)}
                            className="inline-flex items-center gap-1 rounded-[7px] bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:bg-rose-950/40 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      </li>
                    );
                  })}
                </ul>
                )}
              </div>
            </div>
          </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1 rounded-[11px] bg-slate-200/70 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setLedgerType('income')}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] text-xs font-bold transition',
                  ledgerType === 'income'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400',
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Income
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {income.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLedgerType('expense')}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] text-xs font-bold transition',
                  ledgerType === 'expense'
                    ? 'bg-white text-rose-700 shadow-sm dark:bg-slate-900 dark:text-rose-300'
                    : 'text-slate-500 dark:text-slate-400',
                )}
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Expenses
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  {expenses.length}
                </span>
              </button>
            </div>

            <div
              className={cn(
                'overflow-hidden rounded-[12px] admin-hairline bg-white dark:bg-slate-900',
                ledgerType !== 'income' ? 'hidden' : 'accounting-panel-in',
              )}
            >
              <div className="flex items-center gap-2 border-b border-emerald-200/60 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/20 sm:px-4 sm:py-3">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200 sm:text-base">Income Ledger</span>
              </div>
              <label className="relative block border-b border-slate-100 p-2 dark:border-slate-800">
                <span className="sr-only">Search income ledger</span>
                <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={incomeSearch}
                  onChange={(event) => setIncomeSearch(event.target.value)}
                  placeholder="Search title, source, date or amount…"
                  className="h-8 w-full rounded-[8px] border-0 bg-slate-100 pl-8 pr-8 text-xs text-slate-700 outline-none focus:bg-white dark:bg-slate-950 dark:text-slate-200"
                />
                {incomeSearch && (
                  <button
                    type="button"
                    onClick={() => setIncomeSearch('')}
                    aria-label="Clear income search"
                    className="absolute right-4 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>

              <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-2 py-2 dark:border-slate-800 sm:px-3">
                {incomeSourceFilters.map((item) => {
                  const count = incomeSourceCounts[item.value];
                  const active = incomeSourceFilter === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setIncomeSourceFilter(item.value)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition',
                        active
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                      )}
                    >
                      {item.label}
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none',
                          active
                            ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                            : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <ul className="max-h-[55dvh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800 md:hidden">
                {filteredIncome.map((row) => {
                  const source = inferIncomeSource(row);
                  const guests = formatGuestCount(
                    resolveIncomeGuests(row, roomById, roomByCode, eventByCode),
                  );
                  return (
                    <li key={row.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
                              INCOME_SOURCE_BADGE[source],
                            )}
                          >
                            {INCOME_SOURCE_LABEL[source]}
                          </span>
                          {guests && (
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                              {guests}
                            </span>
                          )}
                          <span className="text-[10px] capitalize text-slate-400">{row.category}</span>
                        </div>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {row.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatLedgerDate(row.income_date)}
                          {row.notes ? ` · ${formatLedgerNotes(row.notes)}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600">
                          {formatMoney(Number(row.amount))}
                        </span>
                        <button
                          type="button"
                          aria-label="Delete income"
                          onClick={() => setPendingDeleteIncome(row)}
                          className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
                {filteredIncome.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                    {incomeSearch || incomeSourceFilter !== 'all'
                      ? 'No matching income records.'
                      : 'No income records yet.'}
                  </li>
                )}
              </ul>

              <div className="hidden max-h-[60dvh] overflow-auto md:block">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 z-[1] bg-emerald-50 text-xs uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <tr>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Date</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Source</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Guests</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Title</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Amount (₱)</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIncome.map((row) => {
                      const source = inferIncomeSource(row);
                      const guests = formatGuestCount(
                        resolveIncomeGuests(row, roomById, roomByCode, eventByCode),
                      );
                      return (
                        <tr key={row.id} className="border-b border-gray-50 dark:border-slate-800">
                          <td className="px-3 py-2.5 sm:px-4 sm:py-3">{formatLedgerDate(row.income_date)}</td>
                          <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
                                INCOME_SOURCE_BADGE[source],
                              )}
                            >
                              {INCOME_SOURCE_LABEL[source]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 sm:px-4 sm:py-3">
                            {guests ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                            <div className="font-medium">{row.title}</div>
                            <div className="text-xs capitalize text-gray-500 dark:text-slate-400">
                              {row.category}
                              {row.notes ? ` · ${formatLedgerNotes(row.notes)}` : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-emerald-600 sm:px-4 sm:py-3">
                            {formatMoney(Number(row.amount))}
                          </td>
                          <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                            <button
                              type="button"
                              onClick={() => setPendingDeleteIncome(row)}
                              aria-label="Delete income"
                              className="text-gray-400 hover:text-rose-500 dark:text-slate-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredIncome.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                          {incomeSearch || incomeSourceFilter !== 'all'
                            ? 'No matching income records.'
                            : 'No income records yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              className={cn(
                'overflow-hidden rounded-[12px] admin-hairline bg-white dark:bg-slate-900',
                ledgerType !== 'expense' ? 'hidden' : 'accounting-panel-in',
              )}
            >
              <div className="flex items-center gap-2 border-b border-rose-200/60 bg-rose-50/50 px-3 py-2.5 dark:border-rose-900/30 dark:bg-rose-950/20 sm:px-4 sm:py-3">
                <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span className="text-sm font-bold text-rose-800 dark:text-rose-200 sm:text-base">Expense Ledger</span>
              </div>
              <label className="relative block border-b border-slate-100 p-2 dark:border-slate-800">
                <span className="sr-only">Search expense ledger</span>
                <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={expenseSearch}
                  onChange={(event) => setExpenseSearch(event.target.value)}
                  placeholder="Search title, category, date or amount…"
                  className="h-8 w-full rounded-[8px] border-0 bg-slate-100 pl-8 pr-8 text-xs text-slate-700 outline-none focus:bg-white dark:bg-slate-950 dark:text-slate-200"
                />
                {expenseSearch && (
                  <button
                    type="button"
                    onClick={() => setExpenseSearch('')}
                    aria-label="Clear expense search"
                    className="absolute right-4 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>

              <ul className="max-h-[55dvh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800 md:hidden">
                {filteredExpenses.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{row.title}</p>
                      <p className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                        {formatLedgerDate(row.expense_date)} · {row.category}
                      </p>
                      {row.receipt_url ? (
                        <a
                          href={row.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-amber-600 dark:text-amber-400"
                        >
                          View receipt
                        </a>
                      ) : (
                        <label className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-amber-600">
                          {attachingId === row.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          Upload receipt
                          <input
                            type="file"
                            accept="image/*,.pdf,application/pdf"
                            className="hidden"
                            disabled={Boolean(attachingId)}
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              e.target.value = '';
                              void attachReceiptToExpense(row.id, file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                        {formatMoney(Number(row.amount))}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteExpense(row)}
                        className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {filteredExpenses.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                    {expenseSearch ? 'No matching expense records.' : 'No expense records yet.'}
                  </li>
                )}
              </ul>

              <div className="hidden max-h-[60dvh] overflow-auto md:block">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="sticky top-0 z-[1] bg-rose-50 text-xs uppercase text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    <tr>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Date</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Title</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Amount (₱)</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3">{formatLedgerDate(row.expense_date)}</td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                          <div className="font-medium">{row.title}</div>
                          <div className="text-xs capitalize text-gray-500 dark:text-slate-400">{row.category}</div>
                          {row.receipt_url ? (
                            <a
                              href={row.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-amber-600 dark:text-amber-400"
                            >
                              View receipt
                            </a>
                          ) : (
                            <label className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-slate-500 hover:text-amber-600">
                              {attachingId === row.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Upload className="h-3 w-3" />
                              )}
                              Upload receipt
                              <input
                                type="file"
                                accept="image/*,.pdf,application/pdf"
                                className="hidden"
                                disabled={Boolean(attachingId)}
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  e.target.value = '';
                                  void attachReceiptToExpense(row.id, file);
                                }}
                              />
                            </label>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-rose-600 dark:text-rose-400 sm:px-4 sm:py-3">
                          {formatMoney(Number(row.amount))}
                        </td>
                        <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                          <button
                            type="button"
                            onClick={() => setPendingDeleteExpense(row)}
                            className="text-gray-400 hover:text-rose-500 dark:text-slate-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                          {expenseSearch ? 'No matching expense records.' : 'No expense records yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDeleteDialog
        open={pendingDeleteIncome != null}
        onOpenChange={(open) => !open && setPendingDeleteIncome(null)}
        title="Delete this income?"
        requireTyping
        typingValue="DELETE"
        description={
          pendingDeleteIncome
            ? `“${pendingDeleteIncome.title}” (${formatMoney(Number(pendingDeleteIncome.amount))}) will be permanently deleted.`
            : ''
        }
        confirmLabel="Delete income"
        onConfirm={async () => {
          if (pendingDeleteIncome) await deleteIncome(pendingDeleteIncome.id);
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteExpense != null}
        onOpenChange={(open) => !open && setPendingDeleteExpense(null)}
        title="Delete this expense?"
        requireTyping
        typingValue="DELETE"
        description={
          pendingDeleteExpense
            ? `“${pendingDeleteExpense.title}” (${formatMoney(Number(pendingDeleteExpense.amount))}) will be permanently deleted.`
            : ''
        }
        confirmLabel="Delete expense"
        onConfirm={async () => {
          if (pendingDeleteExpense) await deleteExpense(pendingDeleteExpense.id);
        }}
      />

      <style jsx global>{`
        @keyframes accounting-rise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes accounting-panel {
          from {
            opacity: 0;
            transform: translateX(8px) scale(0.995);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .accounting-page > div,
        .accounting-page > details {
          animation: accounting-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .accounting-page > :nth-child(2) {
          animation-delay: 45ms;
        }

        .accounting-page > :nth-child(3) {
          animation-delay: 90ms;
        }

        .accounting-page > :nth-child(4) {
          animation-delay: 135ms;
        }

        .accounting-panel-in {
          animation: accounting-panel 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .accounting-page button,
        .accounting-page a,
        .accounting-page input,
        .accounting-page select,
        .accounting-page textarea,
        .accounting-page summary {
          transition:
            color 180ms ease,
            background-color 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease,
            opacity 180ms ease,
            transform 180ms ease;
        }

        .accounting-page button:active {
          transform: scale(0.97);
        }

        .accounting-page input:focus,
        .accounting-page select:focus,
        .accounting-page textarea:focus {
          box-shadow: 0 0 0 3px rgb(15 23 42 / 8%);
        }

        @media (prefers-reduced-motion: reduce) {
          .accounting-page *,
          .accounting-page > div,
          .accounting-page > details,
          .accounting-panel-in {
            animation: none !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
