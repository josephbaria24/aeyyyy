'use client';

import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  confirmLabel?: string;
  /** If true, user must type `typingValue` to enable the destructive confirm button. */
  requireTyping?: boolean;
  typingValue?: string;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = 'Delete permanently?',
  description,
  confirmLabel = 'Delete',
  requireTyping = false,
  typingValue = 'DELETE',
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const handleConfirm = async () => {
    if (requireTyping && typed.trim() !== typingValue) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = !busy && (!requireTyping || typed.trim() === typingValue);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent className="z-[80] rounded-[13px] dark:border-slate-700 dark:bg-slate-900">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-slate-100">{title}</AlertDialogTitle>
          <AlertDialogDescription className="dark:text-slate-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireTyping && (
          <div className="space-y-2 rounded-[10px] border border-rose-200/80 bg-rose-50/70 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
              Type{' '}
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-100">
                {typingValue}
              </span>{' '}
              to confirm deletion
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canConfirm) {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
              className={cn(
                'w-full rounded-[9px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none',
                'placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100',
                'dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-rose-950/50',
              )}
              placeholder={`Type ${typingValue} here`}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label={`Type ${typingValue} to confirm`}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="rounded-[9px]">
            Cancel
          </AlertDialogCancel>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
            className={cn(
              buttonVariants({ variant: 'destructive' }),
              'inline-flex items-center rounded-[9px] disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
