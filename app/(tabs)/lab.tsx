import { useRouter } from 'expo-router';

import { LabScreen } from '../../src/screens/LabScreen';

export default function LabRoute() {
  const router = useRouter();
  return <LabScreen onOpen={(route) => router.push(route)} />;
}
