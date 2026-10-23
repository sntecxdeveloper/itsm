import type { Client, StompSubscription } from '@stomp/stompjs';

/**
 * One shared STOMP connection for the whole app. Screens subscribe to topics
 * (e.g. /topic/agents/{agentId}/commands) and get pushes the moment the
 * backend has news, instead of each one polling. The socket opens on the
 * first subscription, re-subscribes after reconnects, and closes when the
 * last subscriber leaves. Callers should keep a slow polling fallback for
 * when `isLive()` is false (socket blocked, backend without push, etc.).
 */

type Listener = (data: unknown) => void;

const listeners = new Map<string, Set<Listener>>();
const stompSubs = new Map<string, StompSubscription>();
let client: Client | null = null;
let connecting = false;
let live = false;

export const isLive = () => live;

function attach(topic: string) {
  if (!client || !live || stompSubs.has(topic)) return;
  const sub = client.subscribe(topic, (message) => {
    let data: unknown = message.body;
    try {
      data = JSON.parse(message.body);
    } catch {
      /* plain text */
    }
    listeners.get(topic)?.forEach((l) => {
      try {
        l(data);
      } catch (err) {
        console.warn('live listener failed', err);
      }
    });
  });
  stompSubs.set(topic, sub);
}

async function ensureConnected() {
  if (client || connecting) return;
  connecting = true;
  try {
    const [{ Client }, SockJSModule] = await Promise.all([import('@stomp/stompjs'), import('sockjs-client')]);
    const SockJS = SockJSModule.default;
    const wsBase = import.meta.env.VITE_WS_BASE_URL || `${window.location.protocol}//${window.location.host}`;
    const c = new Client({
      // Native websocket transport only - see useWebSocket for why.
      webSocketFactory: () => new SockJS(`${wsBase}/ws`, undefined, { transports: ['websocket'] }) as WebSocket,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        live = true;
        stompSubs.clear(); // subscriptions don't survive a reconnect
        listeners.forEach((_, topic) => attach(topic));
      },
      onDisconnect: () => {
        live = false;
      },
      onWebSocketClose: () => {
        live = false;
        stompSubs.clear();
      },
      onStompError: () => {
        live = false;
      },
    });
    client = c;
    c.activate();
  } catch (err) {
    console.warn('Live updates unavailable:', err);
  } finally {
    connecting = false;
  }
}

/** Listen to a topic; returns an unsubscribe function. */
export function subscribeTopic(topic: string, listener: Listener): () => void {
  let set = listeners.get(topic);
  if (!set) {
    set = new Set();
    listeners.set(topic, set);
  }
  set.add(listener);
  if (live) attach(topic);
  else void ensureConnected();

  return () => {
    const current = listeners.get(topic);
    current?.delete(listener);
    if (current && current.size === 0) {
      listeners.delete(topic);
      stompSubs.get(topic)?.unsubscribe();
      stompSubs.delete(topic);
    }
    if (listeners.size === 0 && client) {
      const c = client;
      client = null;
      live = false;
      stompSubs.clear();
      void c.deactivate();
    }
  };
}

export const agentCommandsTopic = (agentId: string) => `/topic/agents/${agentId}/commands`;
export const agentKbRunsTopic = (agentId: string) => `/topic/agents/${agentId}/kb-runs`;
