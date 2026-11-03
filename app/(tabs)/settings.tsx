import { useRouter } from 'expo-router';

import { SettingsScreen } from '../../src/screens/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onOrders={() => router.push('/orders')} />;
}
