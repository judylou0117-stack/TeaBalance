'use client';

import { I18nProvider } from '@/lib/i18n';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
