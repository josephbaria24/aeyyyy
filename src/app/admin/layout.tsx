'use client';

import { usePathname } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Receipt print view keeps its own full-page layout
  if (pathname.startsWith('/admin/receipts')) {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
