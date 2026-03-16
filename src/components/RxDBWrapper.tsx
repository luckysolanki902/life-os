'use client';

import { type ReactNode } from 'react';
import { RxDBProvider } from '@/lib/rxdb/provider';

export default function RxDBWrapper({ children }: { children: ReactNode }) {
  return <RxDBProvider>{children}</RxDBProvider>;
}
