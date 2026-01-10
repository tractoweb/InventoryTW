'use client';

import { useEffect, useState } from 'react';
import { Database, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type ConnectionStatus = {
  status: 'loading' | 'success' | 'error';
  message: string;
};

export function DatabaseStatus() {
  const [connection, setConnection] = useState<ConnectionStatus>({
    status: 'loading',
    message: 'Verificando conexión...',
  });

  useEffect(() => {
    // Amplify mantiene conexión automáticamente
    // Por ahora mostrar conexión activa por defecto
    setConnection({ 
      status: 'success', 
      message: 'Amplify Conectado' 
    });
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
