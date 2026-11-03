import { useRouter } from 'expo-router';

import { CartScreen } from '../../src/screens/CartScreen';

export default function CartRoute() {
  const router = useRouter();
  return <CartScreen onBrowse={() => router.navigate('/')} onViewOrders={() => router.push('/orders')} />;
}
