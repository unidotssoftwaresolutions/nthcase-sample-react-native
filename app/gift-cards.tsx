import { GiftCardsScreen } from '../src/screens/GiftCardsScreen';
import { useUpOrShop } from '../src/ui/navigation';

export default function Route() {
  return <GiftCardsScreen onBack={useUpOrShop()} />;
}
