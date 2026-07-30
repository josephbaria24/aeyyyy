import { redirect } from 'next/navigation';

export default function AdminGuestsRedirect() {
  redirect('/admin/rooms?tab=guests');
}
