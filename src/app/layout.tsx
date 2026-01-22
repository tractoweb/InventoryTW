import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppShell from '@/components/layout/app-shell';
import { ThemeProvider } from '@/components/theme-provider';
import { ProductsCatalogProvider } from '@/components/catalog/products-catalog-provider';
import { DocumentsCatalogProvider } from '@/components/catalog/documents-catalog-provider';
import { RealtimeAuditToasts } from '@/components/realtime/realtime-audit-toasts';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'InventoryTAW',
  description: 'Sistema de gestión de inventario',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased min-h-svh w-full overflow-x-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ProductsCatalogProvider>
            <DocumentsCatalogProvider>
              <AppShell>{children}</AppShell>
            </DocumentsCatalogProvider>
          </ProductsCatalogProvider>
          <RealtimeAuditToasts />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
