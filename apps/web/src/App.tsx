import { useEffect } from 'react';
import { ShopProvider, useShop, type Screen } from './basket.js';
import { ensureDeviceSession } from './auth.js';
import { BasketScreen, EndTrip } from './screens/Basket.js';
import { Shopping } from './screens/Shopping.js';
import { Budget, Home, StorePick } from './screens/Start.js';

function CurrentScreen({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'home':
      return <Home />;
    case 'store':
      return <StorePick />;
    case 'budget':
      return <Budget />;
    case 'shopping':
      return <Shopping />;
    case 'basket':
      return <BasketScreen />;
    case 'end':
      return <EndTrip />;
  }
}

function Shell() {
  const { screen } = useShop();
  return <CurrentScreen screen={screen} />;
}

export function App() {
  useEffect(() => {
    void ensureDeviceSession();
  }, []);
  return (
    <ShopProvider>
      <Shell />
    </ShopProvider>
  );
}
