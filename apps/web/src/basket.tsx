import { createContext, use, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import type { PriceSource } from '@tally/shared';

export type Screen = 'home' | 'store' | 'budget' | 'shopping' | 'basket' | 'end';

export interface BasketLine {
  id: string;
  barcode: string;
  name: string;
  priceMinor: number;
  source: PriceSource;
  observedAt: string;
  confidence: number;
  quantity: number;
}

export type BasketAction =
  | { type: 'add'; line: Omit<BasketLine, 'id' | 'quantity'> }
  | { type: 'setQty'; id: string; quantity: number }
  | { type: 'remove'; id: string }
  | { type: 'undo' }
  | { type: 'clear' };

export interface BasketState {
  lines: BasketLine[];
  history: BasketLine[][];
}

export function emptyBasket(): BasketState {
  return { lines: [], history: [] };
}

function pushHistory(state: BasketState): BasketLine[][] {
  return [...state.history.slice(-19), state.lines];
}

export function basketReducer(state: BasketState, action: BasketAction): BasketState {
  switch (action.type) {
    case 'add': {
      const existing = state.lines.find((l) => l.barcode === action.line.barcode);
      if (existing) {
        return {
          lines: state.lines.map((l) => (l.barcode === action.line.barcode ? { ...l, quantity: l.quantity + 1 } : l)),
          history: pushHistory(state),
        };
      }
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `line-${Date.now()}`;
      return { lines: [...state.lines, { ...action.line, id, quantity: 1 }], history: pushHistory(state) };
    }
    case 'setQty': {
      if (action.quantity <= 0) {
        return { lines: state.lines.filter((l) => l.id !== action.id), history: pushHistory(state) };
      }
      return {
        lines: state.lines.map((l) => (l.id === action.id ? { ...l, quantity: action.quantity } : l)),
        history: pushHistory(state),
      };
    }
    case 'remove':
      return { lines: state.lines.filter((l) => l.id !== action.id), history: pushHistory(state) };
    case 'undo': {
      const previous = state.history[state.history.length - 1];
      if (previous === undefined) return state;
      return { lines: previous, history: state.history.slice(0, -1) };
    }
    case 'clear':
      return { lines: [], history: pushHistory(state) };
  }
}

export type Warning = 'ok' | 'amber' | 'red';

/** Amber at ≥80% of budget, red at or over. Null budget means no warning. */
export function budgetWarning(budgetMinor: number | null, predictedMaxMinor: number): Warning {
  if (budgetMinor === null) return 'ok';
  if (predictedMaxMinor >= budgetMinor) return 'red';
  if (predictedMaxMinor >= budgetMinor * 0.8) return 'amber';
  return 'ok';
}

interface ShopState {
  screen: Screen;
  storeId: string | null;
  budgetMinor: number | null;
  basket: BasketState;
  go: (screen: Screen) => void;
  setStore: (storeId: string | null) => void;
  setBudget: (budgetMinor: number | null) => void;
  dispatch: Dispatch<BasketAction>;
}

const ShopContext = createContext<ShopState | null>(null);

const STORAGE_KEY = 'tally-shop-v1';

interface Persisted {
  storeId: string | null;
  budgetMinor: number | null;
  lines: BasketLine[];
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeId: null, budgetMinor: null, lines: [] };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      storeId: typeof parsed.storeId === 'string' ? parsed.storeId : null,
      budgetMinor: typeof parsed.budgetMinor === 'number' ? parsed.budgetMinor : null,
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
    };
  } catch {
    return { storeId: null, budgetMinor: null, lines: [] };
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [initial] = useState<Persisted>(loadPersisted);
  const [screen, setScreen] = useReducer((_s: Screen, next: Screen) => next, 'home' as Screen);
  const [storeId, setStoreId] = useReducer((_s: string | null, next: string | null) => next, initial.storeId);
  const [budgetMinor, setBudgetMinor] = useReducer(
    (_s: number | null, next: number | null) => next,
    initial.budgetMinor,
  );
  const [basket, dispatch] = useReducer(basketReducer, undefined, () => ({ lines: initial.lines, history: [] }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ storeId, budgetMinor, lines: basket.lines }));
    } catch {
      // Private mode etc. — trip continues in memory.
    }
  }, [storeId, budgetMinor, basket.lines]);

  const value: ShopState = useMemo(
    () => ({
      screen,
      storeId,
      budgetMinor,
      basket,
      go: setScreen,
      setStore: setStoreId,
      setBudget: setBudgetMinor,
      dispatch,
    }),
    [screen, storeId, budgetMinor, basket],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopState {
  const shop = use(ShopContext);
  if (!shop) throw new Error('useShop must be used inside ShopProvider');
  return shop;
}
