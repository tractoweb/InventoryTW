'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { updateUserUiPreferencesAction } from '@/actions/update-user-ui-preferences';
import { useUiPreferences } from '@/components/ui-preferences/ui-preferences-provider';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const { preferences, setPreferences } = useUiPreferences();
  const [mounted, setMounted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const currentPreferenceTheme = preferences?.theme;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={saving}
      onClick={async () => {
        const nextTheme = isDark ? 'light' : 'dark';
        const prevTheme = currentPreferenceTheme ?? (isDark ? 'dark' : 'light');

        // Optimistic UI.
        setTheme(nextTheme);
        setPreferences({ ...preferences, theme: nextTheme });

        setSaving(true);
        try {
          const res = await updateUserUiPreferencesAction({ ...preferences, theme: nextTheme });
          if (!res?.success) throw new Error(res?.error || 'No se pudo guardar el tema');
        } catch (e) {
          // Rollback.
          setTheme(prevTheme);
          setPreferences({ ...preferences, theme: prevTheme });
          toast({
            title: 'No se pudo cambiar el tema',
            description: e instanceof Error ? e.message : 'Error desconocido',
            variant: 'destructive',
          });
        } finally {
          setSaving(false);
        }
      }}
      aria-label="Cambiar tema"
      title="Cambiar tema"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
