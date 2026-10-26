import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const LOADING_DELAY_MS = 500;
const DEFAULT_LOADING_MESSAGE = 'Loading the latest information';

type PendingRequest = {
  timer: ReturnType<typeof setTimeout>;
  visible: boolean;
  message: string;
};

type ApiLoadingState = {
  installed: boolean;
  listeners: Set<() => void>;
  pending: Map<symbol, PendingRequest>;
  visibleRequests: number;
  visibleMessages: Map<symbol, string>;
};

declare global {
  interface Window {
    __nsrApiLoadingState?: ApiLoadingState;
  }
}

function createState(): ApiLoadingState {
  return {
    installed: false,
    listeners: new Set(),
    pending: new Map(),
    visibleRequests: 0,
    visibleMessages: new Map(),
  };
}

function getState(): ApiLoadingState {
  if (typeof window === 'undefined') return createState();
  window.__nsrApiLoadingState ??= createState();
  window.__nsrApiLoadingState.visibleMessages ??= new Map();
  return window.__nsrApiLoadingState;
}

function emitChange() {
  for (const listener of getState().listeners) listener();
}

function isApiRequest(input: RequestInfo | URL): boolean {
  const value = input instanceof Request ? input.url : String(input);
  try {
    return new URL(value, window.location.origin).pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function getApiLoadingMessage(input: RequestInfo | URL, init?: RequestInit): string {
  const value = input instanceof Request ? input.url : String(input);
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  let path: string;
  try {
    path = new URL(value, window.location.origin).pathname.toLowerCase();
  } catch {
    return DEFAULT_LOADING_MESSAGE;
  }

  if (path.includes('/super-admin/auth/login')) return 'Signing in to Super Admin';
  if (path.includes('/admin/auth/login')) return 'Signing in to College Admin';
  if (path.endsWith('/auth/login')) return 'Signing in to your student account';
  if (path.includes('/auth/register')) return 'Creating your account';
  if (path.includes('/change-temporary-password')) return 'Updating your password securely';
  if (path.includes('/forgot-password')) return 'Securing your student account';
  if (path.includes('/payments/student')) return 'Recording your payment securely';
  if (path.includes('/offline-payments')) return 'Recording the offline payment';
  if (/\/students\/[^/]+\/payments$/.test(path)) return 'Loading your payment history';
  if (/\/students\/[^/]+\/portal$/.test(path)) return 'Loading your student account';
  if (path.includes('/fee-plan')) return 'Saving the student fee plan';
  if (path.includes('/approve')) return 'Approving the student account';
  if (path.includes('/fee-collections') || path.includes('/reports')) return 'Loading fee collection reports';
  if (path.includes('/send-due-reminders')) return 'Sending student fee reminders';
  if (path.includes('/certificates')) return 'Preparing the student certificate';
  if (path.includes('/students/search')) return 'Searching student records';
  if (/\/admin\/students\/[^/]+$/.test(path) && method === 'GET') return 'Loading the student record';
  if (path.endsWith('/admin/students') && method === 'POST') return 'Creating the student account';
  if (path.includes('/super-admin/context')) return 'Loading the Super Admin workspace';
  if (path.includes('/admin/context')) return 'Loading the College Admin workspace';
  if (path.includes('/super-admin/admins')) return method === 'GET' ? 'Loading College Admin accounts' : 'Creating the College Admin account';
  if (path.includes('/student-counts')) return 'Loading branch enrollment data';
  if (path.includes('/public/metadata')) return 'Loading colleges, branches, and courses';
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') return 'Processing your request securely';
  return DEFAULT_LOADING_MESSAGE;
}

function beginRequest(input: RequestInfo | URL, init?: RequestInit): symbol {
  const state = getState();
  const requestId = Symbol('api-request');
  const request: PendingRequest = {
    visible: false,
    message: getApiLoadingMessage(input, init),
    timer: globalThis.setTimeout(() => {
      const current = state.pending.get(requestId);
      if (!current || current.visible) return;
      current.visible = true;
      state.visibleRequests += 1;
      state.visibleMessages.set(requestId, current.message);
      emitChange();
    }, LOADING_DELAY_MS),
  };
  state.pending.set(requestId, request);
  return requestId;
}

function finishRequest(requestId: symbol) {
  const state = getState();
  const request = state.pending.get(requestId);
  if (!request) return;
  globalThis.clearTimeout(request.timer);
  state.pending.delete(requestId);
  if (!request.visible) return;
  state.visibleRequests = Math.max(0, state.visibleRequests - 1);
  state.visibleMessages.delete(requestId);
  emitChange();
}

export function installApiLoadingTracker() {
  if (typeof window === 'undefined') return;
  const state = getState();
  if (state.installed) return;
  state.installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isApiRequest(input)) return originalFetch(input, init);
    const requestId = beginRequest(input, init);
    try {
      return await originalFetch(input, init);
    } finally {
      finishRequest(requestId);
    }
  };
}

function subscribe(listener: () => void) {
  const state = getState();
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

function getSnapshot() {
  return getState().visibleRequests > 0;
}

function getMessageSnapshot() {
  const messages = Array.from(getState().visibleMessages.values());
  return messages.at(-1) ?? DEFAULT_LOADING_MESSAGE;
}

export function ApiLoadingOverlay() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const message = useSyncExternalStore(subscribe, getMessageSnapshot, () => DEFAULT_LOADING_MESSAGE);
  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className="api-loading-screen" role="status" aria-live="polite" aria-label={`Loading: ${message}`}>
      <div className="api-loading-spinner" aria-hidden="true" />
      <p className="api-loading-text">Loading...</p>
      <p className="api-loading-subtext">{message}</p>
    </div>,
    document.body,
  );
}