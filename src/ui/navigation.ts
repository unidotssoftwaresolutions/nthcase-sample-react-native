import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Back: up the stack, or to the Shop when there is nothing below (as after a cold deep link). */
export function useUpOrShop(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
}
