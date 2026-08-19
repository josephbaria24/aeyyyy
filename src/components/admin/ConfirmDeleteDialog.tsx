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
      <AlertDialogContent className="rounded-[13px] dark:border-slate-700 dark:bg-slate-900">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-slate-100">{title}</AlertDialogTitle>
          <AlertDialogDescription className="dark:text-slate-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireTyping && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              Type <span className="font-mono text-slate-900 dark:text-slate-100">{typingValue}</span> to confirm
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={cn(
                'w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm',
                'bg-white/5 text-slate-100 dark:bg-slate-950 dark:text-slate-100',
              )}
              placeholder={typingValue}
              autoFocus
              aria-label="Type confirmation text"
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
              'rounded-[9px] inline-flex items-center',
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
