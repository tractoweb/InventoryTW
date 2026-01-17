import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppShell from '@/components/layout/app-shell';
import { ThemeProvider } from '@/components/theme-provider';
import { ProductsCatalogProvider } from '@/components/catalog/products-catalog-provider';
import { DocumentsCatalogProvider } from '@/components/catalog/documents-catalog-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'InventoryTAW',
  description: 'Sistema de gestión de inventario',
  icons: {
    icon: ['/favicon.svg', '/icon.svg'],
    apple: ['/icon.svg'],
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ProductsCatalogProvider>
            <DocumentsCatalogProvider>
              <AppShell>{children}</AppShell>
            </DocumentsCatalogProvider>
          </ProductsCatalogProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
