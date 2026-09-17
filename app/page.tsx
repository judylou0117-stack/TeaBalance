'use client';

import { TeaWheel } from '@/components/home/TeaWheel';
import { HistorySection, HomeFooter, InnovationSection, WorkflowSection } from '@/components/home/HomeSections';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { HardLink } from '@/components/layout/HardLink';
import { useI18n } from '@/lib/i18n';
import { ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const { copy } = useI18n();
  return (
    <main className="page-fade overflow-hidden">
      <SiteHeader />
      <section className="hero-section">
        <div className="paper-grain" aria-hidden="true" />
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles /><span>{copy.home.eyebrow}</span></div>
            <p className="hero-brand">{copy.common.brand}</p><h1>{copy.common.brandZh}</h1>
            <p className="hero-tagline">{copy.common.tagline}</p><p className="hero-description">{copy.home.description}</p>
            <div className="hero-actions"><HardLink className="button button-primary" href="/safety">{copy.home.start}<ArrowRight /></HardLink><HardLink className="button button-secondary" href="/result?demo=1">{copy.home.example}</HardLink></div>
            <div className="medical-note"><ShieldCheck aria-hidden="true" /><span><strong>{copy.common.nonDiagnostic}</strong>{copy.home.notice}</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <Image className="hero-landscape" src="/art/ink-landscape.svg" alt="" width={1200} height={760} priority />
            <span className="hero-sun" />
            <span className="hero-vertical-mark">TEA · BALANCE</span>
            <Image className="hero-cup" src="/art/celadon-cup.svg" alt="" width={420} height={330} priority />
            <i className="falling-leaf leaf-one" /><i className="falling-leaf leaf-two" /><i className="falling-leaf leaf-three" />
          </div>
        </div>
      </section>
      <section className="trust-strip" aria-label="Trust indicators"><div className="shell trust-grid">{copy.home.trust.map((item) => <div key={item}><Check aria-hidden="true" />{item}</div>)}</div></section>
      <InnovationSection />
      <section className="content-section wheel-section"><div className="shell wheel-layout">
        <div className="section-heading wheel-heading"><p>{copy.home.wheelEyebrow}</p><h2>{copy.home.wheelTitle}</h2><span>{copy.home.wheelDescription}</span><em>九质 · 一盏 · 不自选体质</em></div>
        <div className="hero-wheel-card"><TeaWheel /></div>
      </div></section>
      <WorkflowSection />
      <HistorySection />
      <HomeFooter />
    </main>
  );
}
