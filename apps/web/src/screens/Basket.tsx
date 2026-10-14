import { useShop } from '../basket.js';
import { BudgetBar } from '../components/BudgetBar.js';
import { ItemCard } from '../components/ItemCard.js';

export function BasketScreen() {
  const { basket, dispatch, go } = useShop();
  return (
    <main className="screen">
      <h1>Basket</h1>
      <BudgetBar />
      {basket.lines.length === 0 ? (
        <p role="status" className="empty-basket">
          Basket is empty. Capture a price to start tracking your trip.
        </p>
      ) : (
        <>
          <ul className="basket-list">
            {basket.lines.map((line) => (
              <ItemCard key={line.id} line={line} />
            ))}
          </ul>
          <div className="basket-actions">
            <button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={basket.history.length === 0}>
              Undo
            </button>
            <button type="button" className="primary" onClick={() => go('end')}>
              End trip
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={() => go('shopping')}>
        Back to shopping
      </button>
    </main>
  );
}

export function EndTrip() {
  const { basket, dispatch, go, setBudget, setStore } = useShop();
  return (
    <main className="screen">
      <h1>Trip summary</h1>
      <BudgetBar />
      <p className="lede">
        {basket.lines.length} line{basket.lines.length === 1 ? '' : 's'} tracked. Receipt scanning lands in a later
        step — compare against your receipt at the register today.
      </p>
      <div className="basket-actions">
        <button
          type="button"
          className="primary"
          onClick={() => {
            dispatch({ type: 'clear' });
            setBudget(null);
            setStore(null);
            go('home');
          }}
        >
          Start new trip
        </button>
      </div>
    </main>
  );
}
