import type {Metadata, Viewport} from 'next';
import './globals.css'; // Global styles
import { BottomNav } from '@/components/BottomNav';
import { Player } from '@/components/Player';
import { AddToPlaylistModal } from '@/components/AddToPlaylistModal';
import { PWARegister } from '@/components/PWARegister';
import { BackgroundProvider } from '@/components/BackgroundProvider';
import { PWAInstallButton } from '@/components/PWAInstallButton';

export const metadata: Metadata = {
  title: 'Music App',
  description: 'Platform streaming musik modern',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Music App',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="text-white antialiased pb-24 min-h-screen" suppressHydrationWarning>
        <BackgroundProvider />
        <PWARegister />
        {children}
        <Player />
        <PWAInstallButton />
        <BottomNav />
        <AddToPlaylistModal />
      </body>
    </html>
  );
}
