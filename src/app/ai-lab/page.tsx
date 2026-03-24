import { redirect } from 'next/navigation';

import { getCurrentSession } from '@/lib/session';
import { ACCESS_LEVELS } from '@/lib/amplify-config';
import { AccessDenied } from '@/components/auth/access-denied';

import { AILabClient } from './ui/ai-lab-client';

export default async function AILabPage() {
  const s = await getCurrentSession();
  if (!s.data) redirect('/login?next=%2Fai-lab');

  if (Number(s.data.accessLevel) < ACCESS_LEVELS.CASHIER) {
    return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  }

  const currentUserName =
    `${s.data.firstName ?? ''} ${s.data.lastName ?? ''}`.trim() ||
    s.data.email ||
    `Usuario #${s.data.userId}`;

  return <AILabClient currentUserName={currentUserName} accessLevel={Number(s.data.accessLevel ?? 0)} />;
}
