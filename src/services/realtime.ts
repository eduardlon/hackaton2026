import { createClient } from '@insforge/sdk';

const baseUrl = (process.env.EXPO_PUBLIC_INSFORGE_URL ?? '').replace(/\/$/, '');
const anonKey = process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY ?? '';

export type FinancialRealtimePayload = {
  table?: string;
  operation?: string;
  userId?: string;
  recordId?: string;
  occurredAt?: string;
  meta?: {
    channel?: string;
    messageId?: string;
    senderType?: string;
    timestamp?: string;
  };
};

type FinancialRealtimeHandler = (payload: FinancialRealtimePayload) => void;

const realtimeClient = baseUrl
  ? createClient({
      baseUrl,
      anonKey: anonKey || undefined,
    })
  : null;

const channelRefCounts = new Map<string, number>();
const subscribedChannels = new Set<string>();

async function ensureSubscribed(channel: string) {
  if (!realtimeClient) return;

  await realtimeClient.realtime.connect();

  if (subscribedChannels.has(channel)) return;

  const response = await realtimeClient.realtime.subscribe(channel);
  if (!response.ok) {
    throw new Error(response.error?.message ?? `No se pudo suscribir al canal ${channel}`);
  }
  subscribedChannels.add(channel);
}

export function subscribeToFinancialRealtime(
  userId: string,
  handler: FinancialRealtimeHandler
): () => void {
  if (!realtimeClient || !userId) return () => {};

  const channel = `user:${userId}`;
  let active = true;

  const eventHandler = (payload: FinancialRealtimePayload) => {
    if (!active) return;
    handler(payload);
  };

  const currentCount = channelRefCounts.get(channel) ?? 0;
  channelRefCounts.set(channel, currentCount + 1);
  realtimeClient.realtime.on<FinancialRealtimePayload>('financial_data_changed', eventHandler);

  ensureSubscribed(channel).catch((error) => {
    if (__DEV__) {
      console.warn('[realtime] no se pudo conectar:', error instanceof Error ? error.message : error);
    }
  });

  return () => {
    active = false;
    realtimeClient.realtime.off<FinancialRealtimePayload>('financial_data_changed', eventHandler);

    const nextCount = (channelRefCounts.get(channel) ?? 1) - 1;
    if (nextCount <= 0) {
      channelRefCounts.delete(channel);
      subscribedChannels.delete(channel);
      realtimeClient.realtime.unsubscribe(channel);
      return;
    }
    channelRefCounts.set(channel, nextCount);
  };
}
