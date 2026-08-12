'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, FileImage, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useExpenses, useIncome, useInvalidateAdmin } from '@/lib/admin/queries';
import { formatMoney, sumBy, SYSTEM_CURRENCY, SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
import { uploadToCloudinary } from '@/lib/upload';
import type { Expense, ExpenseCategory, Income, IncomeCategory } from '@/lib/types/accounting';
import { toast } from 'sonner';
import { logActivity } from '@/lib/admin/activity-log';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
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
    <>
      {displayError && (
        <div className="mb-4 rounded-[9px] border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {displayError}
        </div>
      )}

      {isPending ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0a1628] dark:text-slate-100" />
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-6">
              <p className="text-sm text-gray-500 dark:text-slate-400">Income</p>
              <p className="mt-2 text-2xl font-bold text-green-600">{formatMoney(totalIncome)}</p>
            </div>
            <div className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-6">
              <p className="text-sm text-gray-500 dark:text-slate-400">Expenses</p>
              <p className="mt-2 text-2xl font-bold text-red-500 dark:text-red-400">{formatMoney(totalExpenses)}</p>
            </div>
            <div className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-6">
              <p className="text-sm text-gray-500 dark:text-slate-400">Net</p>
              <p className={`mt-2 text-2xl font-bold ${net >= 0 ? 'text-[#0a1628] dark:text-slate-100' : 'text-red-500 dark:text-red-400'}`}>
                {formatMoney(net)}
              </p>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <form onSubmit={addIncome} className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-6">
              <h2 className="mb-4 text-lg font-bold text-[#0a1628] dark:text-slate-100">Add Income</h2>
              <div className="space-y-3">
                <input
                  required
                  placeholder="Title"
                  value={incomeForm.title}
                  onChange={(e) => setIncomeForm({ ...incomeForm, title: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={incomeForm.category}
                    onChange={(e) =>
                      setIncomeForm({ ...incomeForm, category: e.target.value as IncomeCategory })
                    }
                    className="rounded-[9px] admin-hairline px-3 py-2.5 text-sm"
                  >
                    {incomeCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
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
                      className="w-full rounded-[9px] admin-hairline py-2.5 pl-8 pr-3 text-sm"
                    />
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={incomeForm.income_date}
                  onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm"
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={incomeForm.notes}
                  onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm"
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center rounded-[9px] bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Income
                </button>
              </div>
            </form>

            <form onSubmit={addExpense} className="rounded-[13px] admin-hairline bg-white dark:bg-slate-900 p-6">
              <h2 className="mb-4 text-lg font-bold text-[#0a1628] dark:text-slate-100">Add Expense</h2>
              <div className="space-y-3">
                <input
                  required
                  placeholder="Title"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={expenseForm.category}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        category: e.target.value as ExpenseCategory,
                      })
                    }
                    className="rounded-[9px] admin-hairline px-3 py-2.5 text-sm"
                  >
                    {expenseCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
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
                      className="w-full rounded-[9px] admin-hairline py-2.5 pl-8 pr-3 text-sm"
                    />
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm"
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm"
                  rows={2}
                />
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-slate-400">Receipt image (Cloudinary)</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => void onReceiptSelected(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
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
                  className="inline-flex items-center rounded-[9px] bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Expense
                </button>
              </div>
            </form>
          </div>

          <div className="mb-8 rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0a1628] dark:text-slate-100">Receipts</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Upload and attach receipt images or PDFs to expense records.
                </p>
              </div>
              <p className="text-xs font-semibold text-slate-400">
                {expensesWithReceipts.length} saved
                {expensesMissingReceipt.length > 0
                  ? ` · ${expensesMissingReceipt.length} missing`
                  : ''}
              </p>
            </div>

            <div className="mb-5 grid gap-3 rounded-[11px] bg-slate-50 p-4 dark:bg-slate-800/50 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Attach to expense
                <select
                  value={receiptExpenseId}
                  onChange={(e) => setReceiptExpenseId(e.target.value)}
                  className="mt-1.5 w-full rounded-[9px] admin-hairline bg-white px-3 py-2.5 text-sm dark:bg-slate-950"
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
                  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900',
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
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {expensesWithReceipts.map((row) => {
                  const isPdf = /\.pdf($|\?)/i.test(row.receipt_url || '');
                  return (
                    <li
                      key={row.id}
                      className="overflow-hidden rounded-[11px] admin-hairline bg-slate-50 dark:bg-slate-800/40"
                    >
                      <a
                        href={row.receipt_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="block aspect-[4/3] bg-slate-100 dark:bg-slate-800"
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
                      <div className="space-y-2 p-3">
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {row.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.expense_date} · {formatMoney(Number(row.amount))}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={row.receipt_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-[7px] admin-hairline bg-white px-2.5 py-1.5 text-[11px] font-semibold dark:bg-slate-900"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open
                          </a>
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-[7px] admin-hairline bg-white px-2.5 py-1.5 text-[11px] font-semibold dark:bg-slate-900">
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
                            className="inline-flex items-center gap-1 rounded-[7px] bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-950/40"
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

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 font-bold dark:border-slate-800 text-[#0a1628] dark:text-slate-100">Income Ledger</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase text-gray-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Title</th>
                      <th className="px-4 py-3 text-left">Amount (₱)</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {income.map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="px-4 py-3">{row.income_date}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{row.title}</div>
                          <div className="text-xs capitalize text-gray-500 dark:text-slate-400">{row.category}</div>
                        </td>
                        <td className="px-4 py-3 text-green-600">{formatMoney(Number(row.amount))}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setPendingDeleteIncome(row)}
                            className="text-gray-400 dark:text-slate-500 hover:text-red-500"
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

            <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 font-bold dark:border-slate-800 text-[#0a1628] dark:text-slate-100">Expense Ledger</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase text-gray-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Title</th>
                      <th className="px-4 py-3 text-left">Amount (₱)</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="px-4 py-3">{row.expense_date}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{row.title}</div>
                          <div className="text-xs capitalize text-gray-500 dark:text-slate-400">{row.category}</div>
                          {row.receipt_url ? (
                            <a
                              href={row.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-accent"
                            >
                              View receipt
                            </a>
                          ) : (
                            <label className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-slate-500 hover:text-accent">
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
                        <td className="px-4 py-3 text-red-500 dark:text-red-400">{formatMoney(Number(row.amount))}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setPendingDeleteExpense(row)}
                            className="text-gray-400 dark:text-slate-500 hover:text-red-500"
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
    </>
  );
}
