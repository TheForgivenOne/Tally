import { describe, expect, it } from 'vitest';
import { basketReducer, budgetWarning, emptyBasket, type BasketState } from './basket.js';

const LINE = {
  id: 'line-1',
  barcode: '012345678905',
  name: 'Tastee Cheese 250g',
  priceMinor: 125000,
  source: 'tag' as const,
  observedAt: '2026-10-14T12:00:00.000Z',
  confidence: 0.95,
};

describe('basketReducer', () => {
  it('adds a new line with quantity 1', () => {
    const state = basketReducer(emptyBasket(), { type: 'add', line: LINE });
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]?.quantity).toBe(1);
  });

  it('bumps quantity when the same barcode is added again', () => {
    const one = basketReducer(emptyBasket(), { type: 'add', line: LINE });
    const two = basketReducer(one, { type: 'add', line: LINE });
    expect(two.lines).toHaveLength(1);
    expect(two.lines[0]?.quantity).toBe(2);
  });

  it('adjusts quantity and drops the line at zero', () => {
    const added = basketReducer(basketReducer(emptyBasket(), { type: 'add', line: LINE }), {
      type: 'add',
      line: LINE,
    });
    const id = added.lines[0]?.id ?? '';
    const dec = basketReducer(added, { type: 'setQty', id, quantity: 1 });
    expect(dec.lines[0]?.quantity).toBe(1);
    const gone = basketReducer(dec, { type: 'setQty', id, quantity: 0 });
    expect(gone.lines).toHaveLength(0);
  });

  it('removes a line', () => {
    const added = basketReducer(emptyBasket(), { type: 'add', line: LINE });
    const id = added.lines[0]?.id ?? '';
    const removed = basketReducer(added, { type: 'remove', id });
    expect(removed.lines).toHaveLength(0);
  });

  it('undoes the last change', () => {
    const added = basketReducer(emptyBasket(), { type: 'add', line: LINE });
    const undone = basketReducer(added, { type: 'undo' });
    expect(undone.lines).toHaveLength(0);
  });

  it('undo with empty history is a no-op', () => {
    const state: BasketState = emptyBasket();
    expect(basketReducer(state, { type: 'undo' })).toEqual(state);
  });
});

describe('budgetWarning', () => {
  it('is ok below 80% of budget', () => {
    expect(budgetWarning(100000, 79000)).toBe('ok');
  });

  it('is amber at 80% up to but excluding 100%', () => {
    expect(budgetWarning(100000, 80000)).toBe('amber');
    expect(budgetWarning(100000, 99999)).toBe('amber');
  });

  it('is red at or above budget', () => {
    expect(budgetWarning(100000, 100000)).toBe('red');
    expect(budgetWarning(100000, 150000)).toBe('red');
  });

  it('is ok when no budget is set', () => {
    expect(budgetWarning(null, 999999)).toBe('ok');
  });
});
