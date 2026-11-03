import { FormScreen } from '../src/screens/FormScreen';
import { useUpOrShop } from '../src/ui/navigation';

export default function Route() {
  return <FormScreen onBack={useUpOrShop()} />;
}
