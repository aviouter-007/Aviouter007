import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'aviouter_server_url';

/** Default: PC local IP for phone on same Wi‑Fi (change in app Settings). */
export const DEFAULT_SERVER_URL = 'http://192.168.1.100:3001';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getServerUrl() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved.replace(/\/$/, '');
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (!isNativeApp()) {
    return '';
  }
  return DEFAULT_SERVER_URL;
}

export function setServerUrl(url) {
  const normalized = url.trim().replace(/\/$/, '');
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function getApiBase() {
  const base = getServerUrl();
  return base ? `${base}/api` : '/api';
}

export function getSocketUrl() {
  return getServerUrl() || undefined;
}
