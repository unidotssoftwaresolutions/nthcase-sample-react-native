import { WebViewScreen } from '../src/screens/WebViewScreen';
import { useUpOrShop } from '../src/ui/navigation';

export default function Route() {
  return <WebViewScreen onBack={useUpOrShop()} />;
}
