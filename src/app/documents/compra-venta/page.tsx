import { redirect } from 'next/navigation';

import { getCurrentSession } from '@/lib/session';
import { ACCESS_LEVELS } from '@/lib/amplify-config';
import { AccessDenied } from '@/components/auth/access-denied';

import { CompraVentaClientPage } from './components/compra-venta-client';

export default async function CompraVentaPage() {
  const sessionRes = await getCurrentSession();
  if (!sessionRes.data) {
    redirect('/login?next=/documents/compra-venta');
  }

  const accessLevel = Number(sessionRes.data.accessLevel ?? 0);
  if (accessLevel < ACCESS_LEVELS.CASHIER) {
    return <AccessDenied />;
  }

  return <CompraVentaClientPage userId={Number(sessionRes.data.userId)} />;
}
