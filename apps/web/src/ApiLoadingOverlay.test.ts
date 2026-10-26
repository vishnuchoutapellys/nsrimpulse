import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiLoadingMessage, installApiLoadingTracker } from './ApiLoadingOverlay';

type PendingFetch = {
  resolve: (response: Response) => void;
  reject: (reason: Error) => void;
};

describe('API loading tracker', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows only after 500ms and clears after success, failure, and concurrent requests', async () => {
    vi.useFakeTimers();
    const pending: PendingFetch[] = [];
    const fetchMock = vi.fn(() => new Promise<Response>((resolve, reject) => {
      pending.push({ resolve, reject });
    }));
    const testWindow = {
      location: { origin: 'https://www.nsrimpulse.com' },
      fetch: fetchMock,
    } as unknown as Window & typeof globalThis;
    vi.stubGlobal('window', testWindow);

    installApiLoadingTracker();

    const fastRequest = window.fetch('/api/v1/fast');
    expect(window.__nsrApiLoadingState?.visibleRequests).toBe(0);
    expect(window.__nsrApiLoadingState?.pending.size).toBe(1);
    vi.advanceTimersByTime(499);
    expect(window.__nsrApiLoadingState?.visibleRequests).toBe(0);
    pending.shift()!.resolve(new Response('{}', { status: 200 }));
    await fastRequest;
    expect(window.__nsrApiLoadingState?.visibleRequests).toBe(0);

    const successfulRequest = window.fetch('/api/v1/payments/student', { method: 'POST' });
    const failedRequest = window.fetch('/api/v1/admin/auth/login', { method: 'POST' }).catch((reason: unknown) => reason);
    vi.advanceTimersByTime(500);
    expect(window.__nsrApiLoadingState?.visibleRequests).toBe(2);
    expect(Array.from(window.__nsrApiLoadingState?.visibleMessages.values() ?? [])).toEqual([
      'Recording your payment securely',
      'Signing in to College Admin',
    ]);

    pending.shift()!.resolve(new Response('{}', { status: 200 }));
    await successfulRequest;
    expect(window.__nsrApiLoadingState?.visibleRequests).toBe(1);
    expect(Array.from(window.__nsrApiLoadingState?.visibleMessages.values() ?? [])).toEqual(['Signing in to College Admin']);

    pending.shift()!.reject(new Error('Network failure'));
    await failedRequest;
    expect(window.__nsrApiLoadingState?.visibleRequests).toBe(0);
    expect(window.__nsrApiLoadingState?.pending.size).toBe(0);
    expect(window.__nsrApiLoadingState?.visibleMessages.size).toBe(0);
  });

  it('maps Student, Admin, Super Admin, and transaction requests to useful messages', () => {
    const testWindow = { location: { origin: 'https://www.nsrimpulse.com' } } as Window & typeof globalThis;
    vi.stubGlobal('window', testWindow);

    expect(getApiLoadingMessage('/api/v1/auth/login', { method: 'POST' })).toBe('Signing in to your student account');
    expect(getApiLoadingMessage('/api/v1/admin/auth/login', { method: 'POST' })).toBe('Signing in to College Admin');
    expect(getApiLoadingMessage('/api/v1/super-admin/auth/login', { method: 'POST' })).toBe('Signing in to Super Admin');
    expect(getApiLoadingMessage('/api/v1/payments/student', { method: 'POST' })).toBe('Recording your payment securely');
    expect(getApiLoadingMessage('/api/v1/students/NSRHYD-001/payments')).toBe('Loading your payment history');
    expect(getApiLoadingMessage('/api/v1/admin/students/NSRHYD-001/fee-plan', { method: 'POST' })).toBe('Saving the student fee plan');
    expect(getApiLoadingMessage('/api/v1/admin/students/NSRHYD-001')).toBe('Loading the student record');
    expect(getApiLoadingMessage('/api/v1/admin/students', { method: 'POST' })).toBe('Creating the student account');
    expect(getApiLoadingMessage('/api/v1/admin/students/NSRHYD-001/offline-payments', { method: 'POST' })).toBe('Recording the offline payment');
  });
});