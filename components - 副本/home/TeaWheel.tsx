'use client';

import constitutions from '@/data/constitutions.json';
import { leafShapes, leafVein } from '@/data/leaf-shapes';
import { useI18n } from '@/lib/i18n';
import { localizedText } from '@/types/constitution';
import { useState, type CSSProperties } from 'react';

function LeafGlyph({ index }: { index: number }) {
  return <svg className="leaf-shape" viewBox="0 0 46 52" aria-hidden="true"><path d={leafShapes[index % leafShapes.length]} /><path className="leaf-vein" d={leafVein} /></svg>;
}

export function TeaWheel() {
  const { copy, language } = useI18n();
  const [active, setActive] = useState(0);
  const current = constitutions[active];

  return (
    <div className="tea-wheel-wrap">
      <div className="tea-wheel" aria-label={copy.home.wheelTitle}>
        <div className="wheel-rings" aria-hidden="true" />
        <div className="tea-cup" aria-hidden="true"><div className="tea-surface"><i /><i /><i /></div><span>{copy.home.wheelCenter}</span></div>
        {constitutions.map((constitution, index) => {
          const angle = (360 / constitutions.length) * index - 90;
          const style = { '--angle': `${angle}deg`, '--leaf-color': constitution.color, '--delay': `${index * -0.32}s` } as CSSProperties;
          return (
            <button type="button" key={constitution.id} className={`wheel-leaf ${active === index ? 'is-active' : ''}`} style={style}
              onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}
              aria-pressed={active === index} aria-label={`${localizedText(constitution.name, language)}：${localizedText(constitution.short, language)}`}>
              <LeafGlyph index={index} /><span className="leaf-name">{localizedText(constitution.name, language)}</span>
            </button>
          );
        })}
      </div>
      <div className="wheel-note" aria-live="polite"><span>{String(active + 1).padStart(2, '0')} / 09</span><div><strong>{localizedText(current.name, language)}</strong><p>{localizedText(current.short, language)}</p></div></div>
      <p className="wheel-hint">{copy.home.wheelHint}</p>
    </div>
  );
}
