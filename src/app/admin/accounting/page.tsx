'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, FileImage, Loader2, Plus, Trash2, TrendingDown, TrendingUp, Upload, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useExpenses, useIncome, useInvalidateAdmin } from '@/lib/admin/queries';
import { formatMoney, sumBy, SYSTEM_CURRENCY, SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
import { uploadToCloudinary } from '@/lib/upload';
import type { Expense, ExpenseCategory, Income, IncomeCategory } from '@/lib/types/accounting';
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
  const invalidate = useInvalidateAdmin();
  const income = incomeQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];
  const isPending =
    (incomeQuery.isPending && !incomeQuery.data) ||
    (expensesQuery.isPending && !expensesQuery.data);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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

  const totalIncome = sumBy(income, (i) => Number(i.amount));
  const totalExpenses = sumBy(expenses, (e) => Number(e.amount));
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
    <div className="min-w-0">
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

          <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-2 xl:gap-6">
            <form onSubmit={addIncome} className="rounded-[12px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:p-6">
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
                  className={fieldClass}
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

            <form onSubmit={addExpense} className="rounded-[12px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:p-6">
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
                  className={fieldClass}
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

          <div className="mb-4 rounded-[12px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:mb-6 sm:p-6">
            <div className="mb-3 flex flex-col gap-1 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
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
              <p className="text-[11px] font-semibold text-slate-400 sm:text-xs">
                {expensesWithReceipts.length} saved
                {expensesMissingReceipt.length > 0 ? ` · ${expensesMissingReceipt.length} missing` : ''}
              </p>
            </div>

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
                      {row.expense_date} · {row.title}
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
                        className="block aspect-[16/10] bg-slate-100 dark:bg-slate-800 sm:aspect-[4/3]"
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
                            {row.expense_date} · {formatMoney(Number(row.amount))}
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

          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2 xl:gap-6">
            <div className="overflow-hidden rounded-[12px] admin-hairline bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-emerald-200/60 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/20 sm:px-4 sm:py-3">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200 sm:text-base">Income Ledger</span>
              </div>

              <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                {income.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{row.title}</p>
                      <p className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                        {row.income_date} · {row.category}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600">{formatMoney(Number(row.amount))}</span>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteIncome(row)}
                        className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {income.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                    No income records yet.
                  </li>
                )}
              </ul>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-emerald-50/50 text-xs uppercase text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                    <tr>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Date</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Title</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Amount (₱)</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {income.map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3">{row.income_date}</td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                          <div className="font-medium">{row.title}</div>
                          <div className="text-xs capitalize text-gray-500 dark:text-slate-400">{row.category}</div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-emerald-600 sm:px-4 sm:py-3">
                          {formatMoney(Number(row.amount))}
                        </td>
                        <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                          <button
                            type="button"
                            onClick={() => setPendingDeleteIncome(row)}
                            className="text-gray-400 hover:text-rose-500 dark:text-slate-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {income.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                          No income records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-[12px] admin-hairline bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-rose-200/60 bg-rose-50/50 px-3 py-2.5 dark:border-rose-900/30 dark:bg-rose-950/20 sm:px-4 sm:py-3">
                <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span className="text-sm font-bold text-rose-800 dark:text-rose-200 sm:text-base">Expense Ledger</span>
              </div>

              <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                {expenses.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{row.title}</p>
                      <p className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                        {row.expense_date} · {row.category}
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
                {expenses.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                    No expense records yet.
                  </li>
                )}
              </ul>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-rose-50/50 text-xs uppercase text-rose-700 dark:bg-rose-950/20 dark:text-rose-300">
                    <tr>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Date</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Title</th>
                      <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Amount (₱)</th>
                      <th className="px-3 py-2.5 sm:px-4 sm:py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3">{row.expense_date}</td>
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
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                          No expense records yet.
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
    </div>
  );
}
