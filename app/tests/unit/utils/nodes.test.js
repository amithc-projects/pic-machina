import { describe, test, expect } from 'vitest';
import { flattenNodes, countNodes, findNodeAndParent, applyRunParams } from '../../../src/utils/nodes.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeTransform = (id) => ({ id, type: 'transform', transformId: 'color-tuning', params: { contrast: 0 } });

const makeBranch = (id, variants) => ({
  id,
  type: 'branch',
  branches: variants.map((nodes, i) => ({
    id: `branch-${id}-${i}`,
    label: String.fromCharCode(65 + i),
    nodes,
  })),
});

const makeConditional = (id, thenNodes, elseNodes) => ({
  id,
  type: 'conditional',
  condition: { field: 'IsPortrait', operator: 'eq', value: true },
  thenNodes,
  elseNodes,
});

// ── flattenNodes ──────────────────────────────────────────────────────────────

describe('flattenNodes', () => {
  test('flat list of transforms — no branch headers', () => {
    const nodes = [makeTransform('t1'), makeTransform('t2')];
    const items = flattenNodes(nodes);
    expect(items).toHaveLength(2);
    items.forEach(item => expect(item.isBranchHeader).toBe(false));
  });

  test('branch node produces headers for each branch', () => {
    const t1 = makeTransform('t1');
    const t2 = makeTransform('t2');
    const branchNode = makeBranch('b1', [[t1], [t2]]);
    const items = flattenNodes([branchNode]);
    // branch node itself + header A + t1 + header B + t2 = 5
    expect(items).toHaveLength(5);
    const headers = items.filter(i => i.isBranchHeader);
    expect(headers).toHaveLength(2);
    expect(headers[0].node.label).toBe('A');
    expect(headers[1].node.label).toBe('B');
  });

  test('conditional node produces then/else headers', () => {
    const t1 = makeTransform('t1');
    const t2 = makeTransform('t2');
    const cond = makeConditional('c1', [t1], [t2]);
    const items = flattenNodes([cond]);
    // cond + "Then" header + t1 + "Else" header + t2 = 5
    expect(items).toHaveLength(5);
    const headers = items.filter(i => i.isBranchHeader);
    expect(headers.map(h => h.node.label)).toContain('Then');
    expect(headers.map(h => h.node.label)).toContain('Else');
  });

  test('depth is tracked correctly for nested nodes', () => {
    const inner = makeTransform('inner');
    const branchNode = makeBranch('b1', [[inner]]);
    const items = flattenNodes([branchNode]);
    const innerItem = items.find(i => i.node.id === 'inner');
    expect(innerItem.depth).toBe(2);
  });

  test('empty array returns empty result', () => {
    expect(flattenNodes([])).toEqual([]);
  });

  test('null/undefined nodes returns empty result', () => {
    expect(flattenNodes(null)).toEqual([]);
    expect(flattenNodes(undefined)).toEqual([]);
  });
});

// ── countNodes ────────────────────────────────────────────────────────────────

describe('countNodes', () => {
  test('counts flat transforms', () => {
    expect(countNodes([makeTransform('t1'), makeTransform('t2')])).toBe(2);
  });

  test('counts branch node + all child transforms', () => {
    const t1 = makeTransform('t1');
    const t2 = makeTransform('t2');
    const branchNode = makeBranch('b1', [[t1], [t2]]);
    // 1 branch + 2 transforms = 3
    expect(countNodes([branchNode])).toBe(3);
  });

  test('counts conditional node + then + else children', () => {
    const cond = makeConditional('c1', [makeTransform('t1')], [makeTransform('t2')]);
    expect(countNodes([cond])).toBe(3);
  });

  test('empty array returns 0', () => {
    expect(countNodes([])).toBe(0);
  });
});

// ── findNodeAndParent ─────────────────────────────────────────────────────────

describe('findNodeAndParent', () => {
  test('finds a node at top level', () => {
    const nodes = [makeTransform('t1'), makeTransform('t2')];
    const result = findNodeAndParent(nodes, 't2');
    expect(result).not.toBeNull();
    expect(result.node.id).toBe('t2');
    expect(result.index).toBe(1);
    expect(result.parent).toBe(nodes);
  });

  test('finds a node nested inside a branch', () => {
    const deepNode = makeTransform('deep-node');
    const branchNode = makeBranch('b1', [[deepNode]]);
    const result = findNodeAndParent([branchNode], 'deep-node');
    expect(result).not.toBeNull();
    expect(result.node.id).toBe('deep-node');
  });

  test('finds a node in a conditional thenNodes', () => {
    const inner = makeTransform('then-node');
    const cond = makeConditional('c1', [inner], []);
    const result = findNodeAndParent([cond], 'then-node');
    expect(result).not.toBeNull();
    expect(result.node.id).toBe('then-node');
  });

  test('returns null for non-existent id', () => {
    const nodes = [makeTransform('t1'), makeTransform('t2')];
    expect(findNodeAndParent(nodes, 'does-not-exist')).toBeNull();
  });
});

// ── applyRunParams ────────────────────────────────────────────────────────────

describe('applyRunParams', () => {
  test('overwrites matching param keys on transform nodes', () => {
    const node = makeTransform('t1');
    node.params = { quality: 80, format: 'jpeg' };
    applyRunParams([node], { quality: 95 });
    expect(node.params.quality).toBe(95);
    expect(node.params.format).toBe('jpeg'); // unchanged
  });

  test('does not mutate non-matching keys', () => {
    const node = makeTransform('t1');
    node.params = { x: 1 };
    applyRunParams([node], { notInNode: 99 });
    expect(node.params.x).toBe(1);
    expect(node.params.notInNode).toBeUndefined();
  });

  test('no-op when runParams is empty', () => {
    const node = makeTransform('t1');
    node.params = { contrast: 0 };
    applyRunParams([node], {});
    expect(node.params.contrast).toBe(0);
  });

  test('propagates into branch children', () => {
    const inner = makeTransform('inner');
    inner.params = { quality: 80 };
    const branchNode = makeBranch('b1', [[inner]]);
    applyRunParams([branchNode], { quality: 95 });
    expect(inner.params.quality).toBe(95);
  });

  test('does not crash on conditional node without params', () => {
    const cond = makeConditional('c1', [], []);
    expect(() => applyRunParams([cond], { quality: 95 })).not.toThrow();
  });
});
