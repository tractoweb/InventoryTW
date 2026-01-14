'use client';

import { useEffect } from 'react';

export function PrintOnMount() {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(t);
  }, []);

  return null;
}
