import { router } from "@inertiajs/react";
import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL = 10000;
const REFRESH_CHANNEL = "blackphone-registros-actualizados";

export function notifyRecordsUpdated() {
  const payload = String(Date.now());

  window.dispatchEvent(new CustomEvent(REFRESH_CHANNEL));
  window.localStorage.setItem(REFRESH_CHANNEL, payload);

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(REFRESH_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  }
}

export function useAutoRefresh(only = [], intervalMs = DEFAULT_INTERVAL) {
  useEffect(() => {
    const refresh = () => {
      router.reload({
        only,
        preserveScroll: true,
        preserveState: true,
      });
    };

    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };

    const timer = window.setInterval(refreshWhenVisible, intervalMs);
    let channel = null;

    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(REFRESH_CHANNEL);
      channel.onmessage = refresh;
    }

    const refreshFromStorage = (event) => {
      if (event.key === REFRESH_CHANNEL) refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener(REFRESH_CHANNEL, refresh);
    window.addEventListener("storage", refreshFromStorage);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      channel?.close();
      window.removeEventListener("focus", refresh);
      window.removeEventListener(REFRESH_CHANNEL, refresh);
      window.removeEventListener("storage", refreshFromStorage);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [intervalMs, JSON.stringify(only)]);
}

export function useAutoRefreshCallback(callback, intervalMs = DEFAULT_INTERVAL) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const refresh = () => {
      callbackRef.current?.();
    };

    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };

    const timer = window.setInterval(refreshWhenVisible, intervalMs);
    let channel = null;

    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(REFRESH_CHANNEL);
      channel.onmessage = refresh;
    }

    const refreshFromStorage = (event) => {
      if (event.key === REFRESH_CHANNEL) refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener(REFRESH_CHANNEL, refresh);
    window.addEventListener("storage", refreshFromStorage);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      channel?.close();
      window.removeEventListener("focus", refresh);
      window.removeEventListener(REFRESH_CHANNEL, refresh);
      window.removeEventListener("storage", refreshFromStorage);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [intervalMs]);
}
