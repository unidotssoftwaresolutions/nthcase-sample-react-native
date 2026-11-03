import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getState } from '../data/store';

export type LoadStatus = 'loading' | 'failed' | 'ready';

/** How long a slow load takes: inside the spec's 2–5 s, the same on every framework. */
export const SLOW_LOAD_MS = 3000;

/**
 * The local stand-in for a network load (there is no network). It runs each time its screen opens: a tab screen
 * stays mounted, so a new [visit] starts a new load. It waits [SLOW_LOAD_MS] when [alwaysSlow] or Settings › Slow
 * loading is on, and fails the first attempt of a visit when Settings › Fail the first load is on; Try again then
 * succeeds. With both off it is ready at once, so normal runs never see a spinner.
 */
export function useLoad(alwaysSlow = false, visit = 0): { status: LoadStatus; retry: () => void } {
  const [attempt, setAttempt] = useState({ visit, n: 0 });
  const current = attempt.visit === visit ? attempt.n : 0;
  const [status, setStatus] = useState<LoadStatus>(() => firstStatus(alwaysSlow, 0));

  useEffect(() => {
    const start = firstStatus(alwaysSlow, current);
    setStatus(start);
    if (start !== 'loading') return;
    const fail = getState().failFirstLoad && current === 0;
    const timer = setTimeout(() => setStatus(fail ? 'failed' : 'ready'), SLOW_LOAD_MS);
    return () => clearTimeout(timer);
  }, [alwaysSlow, visit, current]);

  return { status, retry: () => setAttempt({ visit, n: current + 1 }) };
}

function firstStatus(alwaysSlow: boolean, attempt: number): LoadStatus {
  const { slowLoading, failFirstLoad } = getState();
  if (alwaysSlow || slowLoading) return 'loading';
  return failFirstLoad && attempt === 0 ? 'failed' : 'ready';
}

/** Counts the times this screen has come into view: 1 on the first, 2 on the next, and so on. */
export function useVisit(): number {
  const [visit, setVisit] = useState(0);
  const seen = useRef(0);
  useFocusEffect(
    useCallback(() => {
      seen.current += 1;
      setVisit(seen.current);
    }, []),
  );
  return visit;
}
