import { useShop } from '../basket.js';
import { Mascot } from '../components/Mascot.js';

export function Home() {
  const { go } = useShop();
  return (
    <main className="screen screen-home">
      <Mascot />
      <h1>Tally</h1>
      <p className="lede">Point at a price. Know your total before the register does.</p>
      <button type="button" className="primary" onClick={() => go('store')}>
        Start shopping
      </button>
      <p className="reassure">Works offline · No account · Your prices stay anonymous</p>
    </main>
  );
}

const STORES = [
  { id: 'store-demo-1', name: 'Hi-Lo (demo store)' },
  { id: 'store-demo-2', name: 'MegaMart (demo store)' },
];

export function StorePick() {
  const { go, setStore } = useShop();
  return (
    <main className="screen">
      <h1>Which store?</h1>
      <p className="lede">Prices are per store. We remember the store, never your location.</p>
      <ul className="store-list">
        {STORES.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="store-card"
              onClick={() => {
                setStore(s.id);
                go('budget');
              }}
            >
              <span className="store-badge" aria-hidden="true">
                {s.name.charAt(0)}
              </span>
              <span className="store-text">
                <strong>{s.name}</strong>
                <small>Prices here, updated by shoppers</small>
              </span>
              <span className="store-go" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function Budget() {
  const { go, setBudget } = useShop();
  return (
    <main className="screen">
      <h1>Trip budget</h1>
      <p className="lede">Rough number is fine. We warn at 80%, and again at the line.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const raw = Number(data.get('budget'));
          setBudget(Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) : null);
          go('shopping');
        }}
      >
        <label htmlFor="budget">Budget in JMD (leave empty for none)</label>
        <input id="budget" name="budget" type="number" inputMode="decimal" min="0" step="0.01" placeholder="e.g. 15000" />
        <div className="chip-row" role="group" aria-label="Quick budget amounts">
          {[5000, 10000, 15000, 20000].map((amount) => (
            <button
              key={amount}
              type="button"
              className="chip"
              onClick={(e) => {
                const form = (e.target as HTMLElement).closest('form');
                const field = form?.querySelector<HTMLInputElement>('#budget');
                if (field) field.value = String(amount);
              }}
            >
              {amount.toLocaleString('en-JM')}
            </button>
          ))}
        </div>
        <button type="submit" className="primary">
          Start trip
        </button>
      </form>
    </main>
  );
}
