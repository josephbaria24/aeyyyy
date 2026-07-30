export type IncomeCategory = 'booking' | 'food' | 'tour' | 'other';
export type ExpenseCategory =
  | 'operations'
  | 'utilities'
  | 'payroll'
  | 'supplies'
  | 'maintenance'
  | 'marketing'
  | 'other';

export type Income = {
  id: string;
  title: string;
  category: IncomeCategory;
  amount: number;
  currency: string;
  income_date: string;
  booking_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expense_date: string;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
