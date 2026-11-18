import { LobbyScreen } from '../src/screens/LobbyScreen';
import { useUpOrShop } from '../src/ui/navigation';

export default function Route() {
  return <LobbyScreen onBack={useUpOrShop()} />;
}
