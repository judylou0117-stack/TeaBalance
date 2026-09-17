import { Brand } from '@/components/layout/Brand';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';

export function SiteHeader() {
  return <header className="site-header"><div className="shell header-inner"><Brand /><LanguageSwitch /></div></header>;
}
