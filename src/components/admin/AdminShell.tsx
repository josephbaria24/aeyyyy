'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { prefetchAdminRoute, useBookings, useEventBookings } from '@/lib/admin/queries';
import { adminRoomsHref, parseRoomsHubTab, type RoomsHubTab } from '@/lib/admin/rooms-hub';
import { adminEventsHref, parseEventsHubTab, type EventsHubTab } from '@/lib/admin/events-hub';
import { cn } from '@/lib/utils';
import { AdminIcon, adminIcons } from '@/components/admin/AdminIcon';
import { AdminNotifications } from '@/components/admin/AdminNotifications';
import { AdminDataSync } from '@/components/admin/AdminDataSync';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

type NavLeaf = {
  href: string;
  label: string;
  short: string;
  icon: string;
};

type NavGroup = {
  id: 'rooms' | 'events';
  label: string;
  short: string;
  icon: string;
  href: string;
  children: { tab: string; label: string; href: string; icon: string }[];
};

const topNav: (NavLeaf | NavGroup)[] = [
  { href: '/admin', label: 'Dashboard', short: 'Home', icon: adminIcons.dashboard },
  {
    id: 'rooms',
    label: 'Rooms',
    short: 'Rooms',
    icon: adminIcons.rooms,
    href: '/admin/rooms',
    children: [
      {
        tab: 'bookings',
        label: 'Bookings',
        href: adminRoomsHref('bookings'),
        icon: adminIcons.bookings,
      },
      {
        tab: 'status',
        label: 'Status',
        href: adminRoomsHref('status'),
        icon: adminIcons.pending,
      },
      {
        tab: 'calendar',
        label: 'Calendar',
        href: adminRoomsHref('calendar'),
        icon: adminIcons.calendar,
      },
      { tab: 'rooms', label: 'Rooms', href: adminRoomsHref('rooms'), icon: adminIcons.rooms },
      { tab: 'guests', label: 'Guests', href: adminRoomsHref('guests'), icon: adminIcons.guests },
    ],
  },
  { href: '/admin/content', label: 'Content', short: 'Site', icon: adminIcons.content },
  {
    id: 'events',
    label: 'Events',
    short: 'Events',
    icon: adminIcons.events,
    href: '/admin/event-bookings',
    children: [
      {
        tab: 'bookings',
        label: 'Bookings',
        href: adminEventsHref('bookings'),
        icon: adminIcons.bookings,
      },
      {
        tab: 'status',
        label: 'Status',
        href: adminEventsHref('status'),
        icon: adminIcons.pending,
      },
      {
        tab: 'calendar',
        label: 'Calendar',
        href: adminEventsHref('calendar'),
        icon: adminIcons.calendar,
      },
      { tab: 'areas', label: 'Areas', href: adminEventsHref('areas'), icon: adminIcons.areas },
    ],
  },
  { href: '/admin/accounting', label: 'Accounting', short: 'Ledger', icon: adminIcons.accounting },
  { href: '/admin/reports', label: 'Reports', short: 'Reports', icon: adminIcons.reports },
  { href: '/admin/activity', label: 'Activity log', short: 'Log', icon: adminIcons.activity },
];

const mobileNavHrefs = new Set(['/admin', '/admin/rooms', '/admin/content', '/admin/accounting']);

function isRoomsHubPath(pathname: string) {
  return (
    pathname.startsWith('/admin/rooms') ||
    pathname.startsWith('/admin/bookings') ||
    pathname.startsWith('/admin/guests')
  );
}

function isEventsHubPath(pathname: string) {
  return pathname.startsWith('/admin/event-bookings');
}

function titleFromPath(
  pathname: string,
  roomsTab: RoomsHubTab | null,
  eventsTab: EventsHubTab | null,
) {
  if (isRoomsHubPath(pathname)) {
    if (roomsTab === 'bookings') return 'Bookings';
    if (roomsTab === 'guests') return 'Guests';
    if (roomsTab === 'status') return 'Room status';
    if (roomsTab === 'calendar') return 'Booking calendar';
    return 'Rooms';
  }
  if (isEventsHubPath(pathname)) {
    if (eventsTab === 'status') return 'Area availability';
    if (eventsTab === 'calendar') return 'Event calendar';
    if (eventsTab === 'areas') return 'Event areas';
    return 'Event bookings';
  }
  if (pathname.startsWith('/admin/content')) return 'Content';
  if (pathname.startsWith('/admin/accounting')) return 'Accounting';
  if (pathname.startsWith('/admin/reports')) return 'Reports';
  if (pathname.startsWith('/admin/activity')) return 'Activity log';
  return 'Dashboard';
}

function isLeafActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

function BrandLink({
  compact,
  onPrefetch,
}: {
  compact?: boolean;
  onPrefetch: (href: string) => void;
}) {
  return (
    <Link
      href="/admin"
      prefetch
      onMouseEnter={() => onPrefetch('/admin')}
      className={cn('flex min-w-0 items-center', compact ? 'gap-2' : 'gap-3')}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.png"
        alt="Aeyyyy Traveller's Inn"
        className={cn(
          'shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700',
          compact ? 'h-9 w-9' : 'h-10 w-10',
        )}
      />
      <div className="min-w-0">
        <p
          className={cn(
            'truncate font-bold tracking-tight text-slate-900 dark:text-slate-100',
            compact ? 'text-sm' : 'text-[15px]',
          )}
        >
          Aeyyyy
        </p>
        {!compact && (
          <p className="text-[11px] font-medium text-slate-400">Traveller&apos;s Inn</p>
        )}
      </div>
    </Link>
  );
}

function SidebarMenu({
  pathname,
  roomsTab,
  eventsTab,
  pendingBookings,
  pendingEventBookings,
  onLogout,
  onPrefetch,
}: {
  pathname: string;
  roomsTab: RoomsHubTab;
  eventsTab: EventsHubTab;
  pendingBookings: number;
  pendingEventBookings: number;
  onLogout: () => void;
  onPrefetch: (href: string) => void;
}) {
  const onRoomsPath = isRoomsHubPath(pathname);
  const onEventsPath = isEventsHubPath(pathname);
  const [roomsExpanded, setRoomsExpanded] = useState(onRoomsPath);
  const [eventsExpanded, setEventsExpanded] = useState(onEventsPath);

  useEffect(() => {
    if (onRoomsPath) setRoomsExpanded(true);
  }, [onRoomsPath]);

  useEffect(() => {
    if (onEventsPath) setEventsExpanded(true);
  }, [onEventsPath]);

  return (
    <>
      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        <ul className="space-y-1">
          {topNav.map((item) => {
            if ('children' in item) {
              const isRooms = item.id === 'rooms';
              const groupActive = isRooms ? onRoomsPath : onEventsPath;
              const expanded = isRooms ? roomsExpanded : eventsExpanded;
              const setExpanded = isRooms ? setRoomsExpanded : setEventsExpanded;
              const pendingCount = isRooms ? pendingBookings : pendingEventBookings;
              return (
                <li key={item.id}>
                  <div
                    className={cn(
                      'flex items-center rounded-[9px] transition-colors duration-200',
                      groupActive
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
                    )}
                  >
                    <Link
                      href={item.href}
                      prefetch
                      onMouseEnter={() => onPrefetch(item.href)}
                      onFocus={() => onPrefetch(item.href)}
                      onClick={() => setExpanded(true)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-[13.5px] font-medium"
                    >
                      <AdminIcon
                        icon={item.icon}
                        width={20}
                        height={20}
                        className={cn(
                          'transition-colors duration-200',
                          groupActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {pendingCount > 0 && (
                        <span
                          className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                          aria-label={`${pendingCount} pending ${isRooms ? 'room' : 'event'} booking${pendingCount === 1 ? '' : 's'}`}
                        >
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      )}
                    </Link>
                    <button
                      type="button"
                      aria-label={expanded ? `Collapse ${item.label} menu` : `Expand ${item.label} menu`}
                      aria-expanded={expanded}
                      onClick={() => setExpanded((v) => !v)}
                      className="mr-1.5 rounded-[7px] p-1.5 text-slate-400 transition-colors duration-200 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                      <motion.span
                        className="inline-flex"
                        animate={{ rotate: expanded ? 90 : 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                      >
                        <AdminIcon icon={adminIcons.chevronRight} width={16} height={16} />
                      </motion.span>
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.ul
                        key={`${item.id}-submenu`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-1 space-y-0.5 overflow-hidden border-l border-slate-200 py-1 pl-3 ml-4 dark:border-slate-700"
                      >
                        {item.children.map((child, index) => {
                          const childActive = isRooms
                            ? onRoomsPath && roomsTab === child.tab
                            : onEventsPath && eventsTab === child.tab;
                          return (
                            <motion.li
                              key={child.tab}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -6 }}
                              transition={{
                                duration: 0.18,
                                delay: index * 0.04,
                                ease: 'easeOut',
                              }}
                            >
                              <Link
                                href={child.href}
                                prefetch
                                onMouseEnter={() => onPrefetch(item.href)}
                                onFocus={() => onPrefetch(item.href)}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[12.5px] font-medium transition-colors duration-200',
                                  childActive
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
                                )}
                              >
                                <AdminIcon
                                  icon={child.icon}
                                  width={16}
                                  height={16}
                                  className={cn(
                                    'transition-colors duration-200',
                                    childActive
                                      ? 'text-white dark:text-slate-900'
                                      : 'text-slate-400',
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate">{child.label}</span>
                                {child.tab === 'bookings' && pendingCount > 0 && (
                                  <span
                                    className={cn(
                                      'inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                                      childActive
                                        ? 'bg-amber-400 text-amber-950 dark:bg-amber-500'
                                        : 'bg-amber-500 text-white',
                                    )}
                                    aria-label={`${pendingCount} pending booking${pendingCount === 1 ? '' : 's'}`}
                                  >
                                    {pendingCount > 99 ? '99+' : pendingCount}
                                  </span>
                                )}
                              </Link>
                            </motion.li>
                          );
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </li>
              );
            }

            const active = isLeafActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  onMouseEnter={() => onPrefetch(item.href)}
                  onFocus={() => onPrefetch(item.href)}
                  className={cn(
                    'flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                    active
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
                  )}
                >
                  <AdminIcon
                    icon={item.icon}
                    width={20}
                    height={20}
                    className={cn(active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400')}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
        >
          <AdminIcon icon={adminIcons.logout} width={20} height={20} />
          Log out
        </button>
      </div>
    </>
  );
}

function BottomNav({
  pathname,
  onPrefetch,
}: {
  pathname: string;
  onPrefetch: (href: string) => void;
}) {
  const items: NavLeaf[] = topNav.flatMap((item) => {
    if ('children' in item) {
      if (!mobileNavHrefs.has(item.href)) return [];
      return [
        {
          href: item.href,
          label: item.label,
          short: item.short,
          icon: item.icon,
        },
      ];
    }
    if (!mobileNavHrefs.has(item.href)) return [];
    return [item];
  });

  return (
    <nav
      className="admin-bottom-nav fixed inset-x-0 bottom-0 z-40 lg:hidden"
      aria-label="Primary"
    >
      <div className="admin-hairline-t mx-auto flex max-w-3xl items-stretch justify-around bg-white dark:bg-slate-900">
        {items.map((item) => {
          const active =
            item.href === '/admin/rooms'
              ? isRoomsHubPath(pathname)
              : isLeafActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onMouseEnter={() => onPrefetch(item.href)}
              onFocus={() => onPrefetch(item.href)}
              onTouchStart={() => onPrefetch(item.href)}
              className={cn(
                'admin-bottom-nav-item relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-2 text-center transition-colors',
                active
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-slate-900 dark:bg-white"
                />
              )}
              <AdminIcon icon={item.icon} width={22} height={22} />
              <span className="max-w-full truncate text-[10px] font-semibold leading-tight tracking-tight sm:text-[11px]">
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <AdminIcon icon={isDark ? adminIcons.sun : adminIcons.moon} width={20} height={20} />
    </button>
  );
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [userEmail, setUserEmail] = useState('');
  const [search, setSearch] = useState('');
  const { data: bookings = [] } = useBookings();
  const { data: eventBookings = [] } = useEventBookings();
  const pendingBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'pending').length,
    [bookings],
  );
  const pendingEventBookings = useMemo(
    () => eventBookings.filter((booking) => booking.status === 'pending').length,
    [eventBookings],
  );

  const roomsTab = useMemo(() => {
    if (!isRoomsHubPath(pathname)) return 'rooms' as RoomsHubTab;
    if (pathname.startsWith('/admin/bookings')) return 'bookings' as RoomsHubTab;
    if (pathname.startsWith('/admin/guests')) return 'guests' as RoomsHubTab;
    return parseRoomsHubTab(searchParams.get('tab'));
  }, [pathname, searchParams]);

  const eventsTab = useMemo(() => {
    if (!isEventsHubPath(pathname)) return 'bookings' as EventsHubTab;
    return parseEventsHubTab(searchParams.get('tab'));
  }, [pathname, searchParams]);

  const title = useMemo(
    () => titleFromPath(pathname, roomsTab, eventsTab),
    [pathname, roomsTab, eventsTab],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setUserEmail(user?.email ?? '');
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    queryClient.clear();
    toast.info('Signed out');
    router.push('/admin-login');
    router.refresh();
  };

  const onPrefetch = (href: string) => {
    prefetchAdminRoute(queryClient, href);
  };

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'AD';

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#F5F7FB] dark:bg-slate-950 supports-[height:100dvh]:h-[100dvh]">
      <AdminDataSync />
      <header className="fixed inset-x-0 top-0 z-40 admin-hairline-b bg-white dark:bg-slate-900 [padding-top:env(safe-area-inset-top,0px)]">
        <div className="flex h-14 sm:h-16">
          <div className="hidden h-full w-[260px] shrink-0 items-center px-6 lg:flex">
            <BrandLink onPrefetch={onPrefetch} />
          </div>

          <div className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
            <div className="min-w-0 lg:hidden">
              <BrandLink compact onPrefetch={onPrefetch} />
            </div>

            <div className="relative hidden min-w-0 flex-1 md:block lg:max-w-md">
              <AdminIcon
                icon={adminIcons.search}
                width={18}
                height={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full rounded-full border-0 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:bg-slate-100 focus:ring-2 focus:ring-slate-900/20 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-800 dark:focus:ring-white/20"
              />
            </div>

            <div className="ml-auto flex items-center gap-0.5 sm:gap-2">
              <AdminNotifications />
              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-1 flex items-center gap-2 rounded-full bg-slate-50 py-1 pl-1 pr-1.5 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900/30 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus-visible:ring-white/30 sm:pr-3"
                    aria-label="Account menu"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-[11px] font-bold text-white dark:from-white dark:to-slate-200 dark:text-slate-900">
                      {initials}
                    </span>
                    <div className="hidden min-w-0 sm:block">
                      <p className="max-w-[7rem] truncate text-left text-xs font-semibold text-slate-800 dark:text-slate-100 xl:max-w-[10rem]">
                        {title}
                      </p>
                      <p className="max-w-[7rem] truncate text-left text-[11px] text-slate-400 xl:max-w-[10rem]">
                        {userEmail || 'Admin'}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-[13px] dark:border-slate-700 dark:bg-slate-900"
                >
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {userEmail || 'Admin'}
                    </p>
                    <p className="text-xs text-slate-400">Signed in</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void handleLogout()}
                    className="cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-700 dark:text-rose-400 dark:focus:bg-rose-950/40"
                  >
                    <AdminIcon icon={adminIcons.logout} width={16} height={16} className="mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 hidden w-[260px] flex-col admin-hairline-r bg-white dark:bg-slate-900 lg:flex">
        <SidebarMenu
          pathname={pathname}
          roomsTab={roomsTab}
          eventsTab={eventsTab}
          pendingBookings={pendingBookings}
          pendingEventBookings={pendingEventBookings}
          onLogout={handleLogout}
          onPrefetch={onPrefetch}
        />
      </aside>

      <BottomNav pathname={pathname} onPrefetch={onPrefetch} />

      <div className="flex h-full flex-col pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:pt-[calc(4rem+env(safe-area-inset-top,0px))] lg:pl-[260px]">
        <main className="admin-main-scroll flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-8 lg:pb-8 [-webkit-overflow-scrolling:touch]">
          <div className="mb-5 sm:mb-6">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Welcome back to Aeyyyy admin console
            </p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-[#F5F7FB] dark:bg-slate-950" />}>
      <AdminShellInner>{children}</AdminShellInner>
    </Suspense>
  );
}
