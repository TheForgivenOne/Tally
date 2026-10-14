import { labelFor } from '@tally/shared';
import { useShop, type BasketLine } from '../basket.js';
import { jmd } from './BudgetBar.js';

/** One basket line: price, exact/estimated label, quantity stepper. */
export function ItemCard({ line }: { line: BasketLine }) {
  const { dispatch } = useShop();
  const label = labelFor(line.source);

  return (
    <li className="item-card">
      <div className="item-info">
        <span className="item-name">{line.name}</span>
        <span className="item-price">
          {jmd.format(line.priceMinor / 100)} <em className={`price-label price-label-${label}`}>{label}</em>
        </span>
      </div>
      <div className="item-qty">
        <button
          type="button"
          aria-label={`Decrease quantity of ${line.name}`}
          onClick={() => dispatch({ type: 'setQty', id: line.id, quantity: line.quantity - 1 })}
        >
          −
        </button>
        <span aria-live="polite" aria-label={`Quantity: ${line.quantity}`}>
          {line.quantity}
        </span>
        <button
          type="button"
          aria-label={`Increase quantity of ${line.name}`}
          onClick={() => dispatch({ type: 'setQty', id: line.id, quantity: line.quantity + 1 })}
        >
          +
        </button>
      </div>
    </li>
  );
}
