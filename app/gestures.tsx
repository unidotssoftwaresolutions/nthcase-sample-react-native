import { GesturesScreen } from '../src/screens/GesturesScreen';
import { useUpOrShop } from '../src/ui/navigation';

export default function Route() {
  return <GesturesScreen onBack={useUpOrShop()} />;
}
