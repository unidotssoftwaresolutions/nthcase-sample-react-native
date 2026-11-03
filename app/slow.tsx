import { SlowScreen } from '../src/screens/SlowScreen';
import { useUpOrShop } from '../src/ui/navigation';

export default function Route() {
  return <SlowScreen onBack={useUpOrShop()} />;
}
