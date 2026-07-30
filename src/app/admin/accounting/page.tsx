'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useExpenses, useIncome, useInvalidateAdmin } from '@/lib/admin/queries';
import { formatMoney, sumBy, SYSTEM_CURRENCY, SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
import { uploadToCloudinary } from '@/lib/upload';
import type { ExpenseCategory, IncomeCategory } from '@/lib/types/accounting';
import { toast } from 'sonner';

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
      setIncomeForm(emptyIncome);
      await invalidate(['income']);
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
      setExpenseForm(emptyExpense);
      await invalidate(['expenses']);
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
    await invalidate(['income']);
    toast.success('Income deleted');
  };

  const deleteExpense = async (id: string) => {
    const supabase = createClient();
    const { error: err } = await supabase.from('expenses').delete().eq('id', id);
    if (err) {
      toast.error('Could not delete expense', { description: err.message });
      return;
    }
    await invalidate(['expenses']);
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
                          <button onClick={() => deleteIncome(row.id)} className="text-gray-400 dark:text-slate-500 hover:text-red-500">
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
                          {row.receipt_url && (
                            <a
                              href={row.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-accent"
                            >
                              View receipt
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-red-500 dark:text-red-400">{formatMoney(Number(row.amount))}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteExpense(row.id)} className="text-gray-400 dark:text-slate-500 hover:text-red-500">
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
    </>
  );
}
