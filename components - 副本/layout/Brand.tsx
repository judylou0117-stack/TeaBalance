'use client';

import { useI18n } from '@/lib/i18n';
import { HardLink } from '@/components/layout/HardLink';

export function Brand() {
  const { copy } = useI18n();
  return (
    <HardLink href="/" className="brand-lockup" aria-label={`${copy.common.brand} ${copy.common.brandZh}`}>
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span><strong>{copy.common.brand}</strong><small>{copy.common.brandZh}</small></span>
    </HardLink>
  );
}
