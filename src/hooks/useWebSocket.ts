import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  topic?: string;
  topics?: string[];
  onMessage: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: unknown | null;
  unsubscribe: () => void;
}

export function useWebSocket({
  topic: singleTopic,
  topics,
  onMessage,
  onConnect,
  onDisconnect,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  // Support both topic (string) and topics (string[]) - subscribe to all of
  // them, not just the first. topicsKey is a stable primitive for the effect
  // dependency array so an inline array literal passed as `topics` doesn't
  // force a reconnect on every render.
  const topicList = singleTopic ? [singleTopic] : topics ?? [];
  const topicsKey = topicList.join(',');
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const clientRef = useRef<{ deactivate: () => void } | null>(null);

  const disconnect = useCallback(() => {
    try {
      clientRef.current?.deactivate();
    } catch {
      // ignore
    }
    clientRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled || topicList.length === 0) return;

    let cancelled = false;

    // Dynamically import SockJS + STOMP only when needed
    const connect = async () => {
      try {
        const [{ Client }, SockJSModule] = await Promise.all([
          import('@stomp/stompjs'),
          import('sockjs-client'),
        ]);

        if (cancelled) return;

        const SockJS = SockJSModule.default;
        // Same-origin-via-proxy by default (correct behind a real reverse
        // proxy in front of the backend, and in vite's dev server where the
        // proxy handles SockJS's nested sub-paths correctly). Override with
        // VITE_WS_BASE_URL (e.g. "http://192.168.31.51:8080") for a
        // colocated deployment served via `vite preview`, whose proxy does
        // NOT correctly forward SockJS's fallback-transport sub-paths
        // (/ws/<n>/<id>/websocket, /jsonp, etc.) - see DECISIONS.md.
        const wsBase = import.meta.env.VITE_WS_BASE_URL || `${window.location.protocol}//${window.location.host}`;
        const wsUrl = `${wsBase}/ws`;

        const client = new Client({
          // Restrict to the native websocket transport only. SockJS's default
          // behavior tries multiple fallback transports in order (websocket,
          // xhr-streaming, xhr-polling, jsonp-polling, ...) - the HTTP-polling
          // ones make plain GET/POST requests to sub-paths like
          // /ws/<n>/<id>/jsonp that a simple path-prefix reverse proxy (vite
          // preview's proxy, or any single-target proxy) doesn't handle the
          // same way as the initial WebSocket upgrade, and they fall through
          // to the SPA's own index.html instead of reaching the backend -
          // causing "Uncaught SyntaxError: Unexpected token '<'" when SockJS
          // tries to execute that HTML response as JavaScript. The plain
          // websocket transport (already proxied correctly via `ws: true`)
          // is sufficient here and skips this whole class of problem.
          webSocketFactory: () => new SockJS(wsUrl, undefined, { transports: ['websocket'] }) as WebSocket,
          reconnectDelay: 5000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          onConnect: () => {
            if (cancelled) return;
            setIsConnected(true);
            onConnect?.();

            topicList.forEach((t) => {
              client.subscribe(t, (message) => {
                try {
                  const data = JSON.parse(message.body);
                  setLastMessage(data);
                  onMessageRef.current(data);
                } catch {
                  onMessageRef.current(message.body);
                }
              });
            });
          },
          onDisconnect: () => {
            if (cancelled) return;
            setIsConnected(false);
            onDisconnect?.();
          },
          onStompError: (frame) => {
            console.warn('STOMP error:', frame.headers['message']);
            setIsConnected(false);
          },
          onWebSocketError: () => {
            // Silently handle — WebSocket might not be available
            setIsConnected(false);
          },
        });

        client.activate();
        clientRef.current = client;
      } catch (err) {
        // WebSocket not available — silently skip
        console.warn('WebSocket connection skipped:', err);
      }
    };

    connect();

    return () => {
      cancelled = true;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsKey, enabled, onConnect, onDisconnect, disconnect]);

  return { isConnected, lastMessage, unsubscribe: disconnect };
}

// Convenience hooks
export function useDeviceTelemetry(agentId: string | null, onTelemetry: (data: unknown) => void, enabled = true) {
  return useWebSocket({ topic: `/topic/telemetry/${agentId}`, onMessage: onTelemetry, enabled: enabled && !!agentId });
}

export function useDeviceStatusUpdates(onStatusChange: (data: unknown) => void, enabled = true) {
  return useWebSocket({ topic: '/topic/device-status', onMessage: onStatusChange, enabled });
}

export function useIssueUpdates(onIssueUpdate: (data: unknown) => void, enabled = true) {
  return useWebSocket({ topic: '/topic/issues', onMessage: onIssueUpdate, enabled });
}

export function useDashboardUpdates(onDashboardUpdate: (data: unknown) => void, enabled = true) {
  return useWebSocket({ topic: '/topic/dashboard', onMessage: onDashboardUpdate, enabled });
}
