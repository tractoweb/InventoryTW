'use client';

import { useEffect, useState } from 'react';
import { checkDbConnection } from '@/actions/check-db-connection';
import { Badge } from '@/components/ui/badge';
import { Database, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type ConnectionStatus = {
  status: 'loading' | 'success' | 'error';
  message: string;
};

export function DatabaseStatus() {
  const [connection, setConnection] = useState<ConnectionStatus>({
    status: 'loading',
    message: 'Checking connection...',
  });

  useEffect(() => {
    async function checkConnection() {
      const result = await checkDbConnection();
      if (result.status === 'success') {
        setConnection({ status: 'success', message: 'Database Connected' });
      } else {
        setConnection({ status: 'error', message: result.message });
      }
    }
    checkConnection();
  }, []);

  if (connection.status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
        <Database className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground" title={connection.message}>
        {connection.status === 'success' ? (
            <Wifi className="h-4 w-4 text-green-500" />
        ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
        )}
      <span className="truncate">{connection.message}</span>
    </div>
  );
}
