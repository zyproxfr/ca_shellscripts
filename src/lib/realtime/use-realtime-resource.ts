"use client";

import { useEffect, useState } from "react";
import useSWR, { type KeyedMutator, mutate as globalMutate } from "swr";
import { getSocketClient } from "@/lib/realtime/socket-client";

export interface RealtimeResource<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  connected: boolean;
  mutate: KeyedMutator<T>;
}

/**
 * Combine Socket.io (réactivité immédiate) et polling de secours (SWR) : si le
 * socket est indisponible, l'intervalle de polling se resserre automatiquement.
 * À la connexion (initiale ou après coupure), on rejoint la room ET on refetch un
 * snapshot immédiatement — stratégie "reconcile-on-reconnect" qui rend l'écran
 * robuste à un événement perdu pendant une coupure wifi (cf. plan temps réel).
 */
export function useRealtimeResource<T>(swrKey: string | null, room: string, fetcher: (key: string) => Promise<T>): RealtimeResource<T> {
  const [connected, setConnected] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    refreshInterval: connected ? 15000 : 5000,
  });

  useEffect(() => {
    const socket = getSocketClient();

    function handleConnect() {
      setConnected(true);
      socket.emit("join", room);
      mutate();
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleEvent() {
      mutate();
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("event", handleEvent);
    if (socket.connected) handleConnect();

    return () => {
      socket.emit("leave", room);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("event", handleEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return { data, error, isLoading, connected, mutate };
}

/**
 * Variante sans données propres : rejoint une room dont on ne connaît le nom
 * qu'après un premier fetch (ex: l'écran TV ne sait quel tournoi est en cours
 * qu'après avoir chargé l'état de l'établissement), et déclenche une revalidation
 * SWR globale par clé plutôt que via son propre useSWR. `room` peut être `null`
 * tant que le nom de la room n'est pas encore connu (aucune connexion tentée).
 */
export function useRealtimeInvalidate(room: string | null, swrKey: string | null): { connected: boolean } {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!room) return;
    const socket = getSocketClient();

    function handleConnect() {
      setConnected(true);
      socket.emit("join", room as string);
      if (swrKey) void globalMutate(swrKey);
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleEvent() {
      if (swrKey) void globalMutate(swrKey);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("event", handleEvent);
    if (socket.connected) handleConnect();

    return () => {
      socket.emit("leave", room as string);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("event", handleEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, swrKey]);

  return { connected };
}
