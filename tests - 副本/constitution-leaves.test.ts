import assert from 'node:assert/strict';
import test from 'node:test';
import { allConstitutionLeaves, constitutionLeafFor } from '../lib/constitution-leaves.ts';
import constitutions from '../data/constitutions.json' with { type: 'json' };
import { leafShapes } from '../data/leaf-shapes.ts';

void test('A–I 九种体质均有唯一颜色和叶片视觉', () => {
  const codes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
  const leaves = allConstitutionLeaves();
  assert.deepEqual(leaves.map((leaf) => leaf.code), codes);
  assert.equal(new Set(leaves.map((leaf) => leaf.color)).size, 9);
  for (const code of codes) {
    const leaf = constitutionLeafFor(code);
    assert.equal(leaf.code, code);
    assert.match(leaf.color, /^#[0-9A-F]{6}$/i);
    assert.ok(leaf.variant >= 0 && leaf.variant <= 2);
    assert.equal(leaf.color, constitutions[codes.indexOf(code)].color);
    assert.equal(leafShapes[leaf.variant], leafShapes[codes.indexOf(code) % leafShapes.length]);
  }
});
