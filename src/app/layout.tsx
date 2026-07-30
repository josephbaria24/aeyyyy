import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Marck_Script } from 'next/font/google';

import { Providers } from './providers';
import './globals.css';

const marckScript = Marck_Script({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-marck-script',
});

export const metadata: Metadata = {
  title: "Aeyyyy Traveller's Inn",
  description:
    'Discover extraordinary luxury stays in India and Costa Rica where nature, culture, and comfort come together.',
  icons: {
    icon: [{ url: '/images/logo.png', type: 'image/png' }],
    apple: [{ url: '/images/logo.png' }],
    shortcut: ['/images/logo.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Aeyyyy Admin',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${marckScript.variable}`}
      suppressHydrationWarning
    >
      <body className={`${GeistSans.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
