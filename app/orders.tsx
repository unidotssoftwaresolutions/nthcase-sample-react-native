import { useRouter } from 'expo-router';

import { OrdersScreen } from '../src/screens/OrdersScreen';
import { useUpOrShop } from '../src/ui/navigation';

export default function OrdersRoute() {
  const router = useRouter();
  return <OrdersScreen onBack={useUpOrShop()} onShop={() => router.dismissTo('/')} />;
}
