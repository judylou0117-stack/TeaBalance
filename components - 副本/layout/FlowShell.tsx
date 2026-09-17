import { Brand } from '@/components/layout/Brand';
import { FlowProgress } from '@/components/layout/FlowProgress';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';

type Step = 'safety' | 'chat' | 'analyzing' | 'result';

export function FlowShell({ step, children, wide = false }: { step: Step; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flow-page page-fade">
      <header className="flow-header">
        <div className="shell flow-header-row"><Brand /><LanguageSwitch /></div>
        <div className="shell"><FlowProgress current={step} /></div>
      </header>
      <div className={`shell flow-content ${wide ? 'flow-wide' : ''}`}>{children}</div>
    </main>
  );
}
