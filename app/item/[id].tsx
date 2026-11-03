import { useLocalSearchParams, useRouter } from 'expo-router';

import { ItemScreen } from '../../src/screens/ItemScreen';
import { useUpOrShop } from '../../src/ui/navigation';

export default function ItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const back = useUpOrShop();
  return <ItemScreen key={id} rawId={id ?? ''} onBack={back} onViewCart={() => router.dismissTo('/cart')} />;
}
