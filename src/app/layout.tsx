import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppShell from '@/components/layout/app-shell';
import ConfigureAmplifyClientSide from '@/components/layout/configure-amplify';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'InventoryEdge',
  description: 'Sistema de gestión de inventario',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased`}>
        <ConfigureAmplifyClientSide />
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
