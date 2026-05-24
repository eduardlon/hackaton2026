import { useEffect, useRef } from 'react';

import { invalidateWalletHomeCache } from '@/services/api';
import {
  subscribeToFinancialRealtime,
  type FinancialRealtimePayload,
} from '@/services/realtime';

export function useFinancialRealtime(
  userId: string | null | undefined,
  onRefresh: (payload: FinancialRealtimePayload) => void,
  enabled = true
) {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !userId) return undefined;

    return subscribeToFinancialRealtime(userId, (payload) => {
      invalidateWalletHomeCache();
      refreshRef.current(payload);
    });
  }, [enabled, userId]);
}
