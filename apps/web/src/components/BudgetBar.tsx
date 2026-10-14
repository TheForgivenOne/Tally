import { priceRange } from '@tally/shared';
import { budgetWarning, useShop, type Warning } from '../basket.js';

export const jmd = new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' });

const WARNING_COPY: Record<Warning, string | null> = {
  ok: null,
  amber: 'Heads up — you are near your budget.',
  red: 'Over budget on the predicted total.',
};

/** Pinned total + budget bar. Always visible during the trip. */
export function BudgetBar() {
  const { basket, budgetMinor } = useShop();
  const now = Date.now();
  const range = priceRange(
    basket.lines.map((l) => ({
      observation: { priceMinor: l.priceMinor, source: l.source, observedAt: l.observedAt, confidence: l.confidence },
      quantity: l.quantity,
    })),
    now,
  );
  const warning = budgetWarning(budgetMinor, range.maxMinor);
  const copy = WARNING_COPY[warning];
  const pct = budgetMinor === null ? 0 : Math.min(100, Math.round((range.maxMinor / budgetMinor) * 100));

  return (
    <section aria-label="Spend against budget" className="budget-bar" data-warning={warning}>
      <div className="budget-total">
        <span className="budget-label">Predicted total</span>
        <strong className="budget-amount">
          {jmd.format(range.minMinor / 100)} – {jmd.format(range.maxMinor / 100)}
        </strong>
      </div>
      {budgetMinor !== null && (
        <div className="budget-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
          <div className="budget-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      {copy !== null && (
        <p role="alert" className={`budget-warning budget-warning-${warning}`}>
          {copy}
        </p>
      )}
      <p className="budget-note">Register total may differ.</p>
    </section>
  );
}
