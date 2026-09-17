import { constitutionLeafFor } from '@/lib/constitution-leaves';
import { leafShapes, leafVein } from '@/data/leaf-shapes';
import type { ConstitutionCode } from '@/lib/rules/types';
import type { CSSProperties } from 'react';

export function ConstitutionLeaf({ code, name, label }: { code: ConstitutionCode; name: string; label: string }) {
  const visual = constitutionLeafFor(code);
  const style = {
    '--result-leaf-color': visual.color,
    '--result-leaf-wash': visual.wash,
    '--result-leaf-rotation': `${visual.rotation}deg`,
  } as CSSProperties;

  return (
    <figure className="result-constitution-leaf" style={style} aria-label={`${label}：${name}`}>
      <span className="result-leaf-wash" aria-hidden="true" />
      <svg viewBox="0 0 46 52" aria-hidden="true">
        <path className="result-leaf-body" d={leafShapes[visual.variant]} />
        <path className="result-leaf-vein" d={leafVein} />
      </svg>
      <figcaption><span>{label}</span><strong>{name}</strong><i>{code}</i></figcaption>
    </figure>
  );
}
