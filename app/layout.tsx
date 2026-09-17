import type { Metadata } from 'next';
import { AppProviders } from '@/components/layout/AppProviders';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tea Balance · 知体茶语',
  description: '通过自然对话了解体质倾向，获得可解释、有安全边界的日常茶饮参考。',
  openGraph: { title: 'Tea Balance · 知体茶语', description: '用一场自然对话，读懂你的体质倾向。', images: [{ url: '/og.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'Tea Balance · 知体茶语', description: '用一场自然对话，读懂你的体质倾向。', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><AppProviders>{children}</AppProviders></body></html>;
}
