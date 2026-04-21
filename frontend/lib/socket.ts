'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiBase } from './api';

export type CrmEvent = {
  resource: 'lead' | 'ticket';
  action: string;
  id: string;
};

export type NotificationEvent = {
  userId: string;
  type: string;
  message: string;
  createdAt: string;
};

export function useCrmSocket(
  onEvent?: (evt: CrmEvent) => void,
  onNotification?: (evt: NotificationEvent) => void,
) {
  const [connected, setConnected] = useState(false);
  // stable ref so socket is only created once, not on every render
  const onEventRef = useRef(onEvent);
  const onNotificationRef = useRef(onNotification);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);

  useEffect(() => {
    const socket: Socket = io(`${getApiBase()}/crm`, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('crm', (payload: CrmEvent) => {
      onEventRef.current?.(payload);
    });
    socket.on('notification', (payload: NotificationEvent) => {
      onNotificationRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
    };
    // intentionally empty — connect once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connected };
}
