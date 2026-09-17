'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';

type HardLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode };

/**
 * Uses a full page navigation while the Vinext client router is unavailable.
 * This keeps every stage of the assessment usable in the deployed prototype.
 */
export function HardLink({ children, ...props }: HardLinkProps) {
  /* oxlint-disable-next-line next(no-html-link-for-pages) */
  return <a {...props}>{children}</a>;
}
