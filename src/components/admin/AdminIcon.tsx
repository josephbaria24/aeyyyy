'use client';

import { Icon } from '@iconify/react';

type AdminIconProps = {
  icon: string;
  className?: string;
  width?: number | string;
  height?: number | string;
};

/** Iconify icons — browse sets at https://icon-sets.iconify.design/ */
export function AdminIcon({ icon, className, width = 20, height = 20 }: AdminIconProps) {
  return <Icon icon={icon} width={width} height={height} className={className} />;
}

export const adminIcons = {
  dashboard: 'solar:widget-5-bold-duotone',
  bookings: 'solar:clipboard-list-bold-duotone',
  calendar: 'solar:calendar-bold-duotone',
  guests: 'solar:users-group-rounded-bold-duotone',
  accounting: 'solar:wallet-money-bold-duotone',
  rooms: 'solar:bed-bold-duotone',
  content: 'solar:document-text-bold-duotone',
  reports: 'solar:chart-bold-duotone',
  logout: 'solar:logout-2-bold-duotone',
  menu: 'solar:hamburger-menu-linear',
  close: 'solar:close-circle-bold-duotone',
  search: 'solar:magnifer-linear',
  bell: 'solar:bell-bold-duotone',
  sun: 'solar:sun-bold-duotone',
  moon: 'solar:moon-bold-duotone',
  revenue: 'solar:dollar-bold-duotone',
  pending: 'solar:clock-circle-bold-duotone',
  confirmed: 'solar:check-circle-bold-duotone',
  guestsCard: 'solar:user-bold-duotone',
  income: 'solar:graph-up-bold-duotone',
  expense: 'solar:graph-down-bold-duotone',
  net: 'solar:chart-2-bold-duotone',
  loader: 'svg-spinners:ring-resize',
  roomName: 'solar:home-smile-bold-duotone',
  category: 'solar:tag-bold-duotone',
  price: 'solar:dollar-minimalistic-bold-duotone',
  capacity: 'solar:users-group-two-rounded-bold-duotone',
  sort: 'solar:sort-from-top-to-bottom-bold-duotone',
  description: 'solar:document-text-bold-duotone',
  amenities: 'solar:checklist-minimalistic-bold-duotone',
  photo: 'solar:gallery-bold-duotone',
  visible: 'solar:eye-bold-duotone',
  chevronRight: 'solar:alt-arrow-right-linear',
  events: 'solar:calendar-mark-bold-duotone',
  areas: 'solar:layers-bold-duotone',
  activity: 'solar:history-bold-duotone',
} as const;
