import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNotificationService, NotificationConfigurationError } from './notifications.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Resend email delivery', () => {
  it('sends email through the Resend API using the configured sender', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    vi.stubEnv('EMAIL_FROM', 'NSR Impulse <no-reply@example.com>');
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASSWORD', '');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await createNotificationService().sendEmail('student@example.com', 'Welcome', 'Your account is ready.');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-resend-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'NSR Impulse <no-reply@example.com>',
        to: ['student@example.com'],
        subject: 'Welcome',
        text: 'Your account is ready.'
      })
    }));
  });

  it('fails clearly when neither Resend nor SMTP is configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASSWORD', '');
    vi.stubEnv('EMAIL_FROM', 'NSR Impulse <no-reply@example.com>');

    await expect(createNotificationService().sendEmail('student@example.com', 'Welcome', 'Hello'))
      .rejects.toBeInstanceOf(NotificationConfigurationError);
  });

  it('reports Resend provider rejection without exposing credentials', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    vi.stubEnv('EMAIL_FROM', 'NSR Impulse <no-reply@example.com>');
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASSWORD', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: 'API key is invalid' })
    }));

    await expect(createNotificationService().sendEmail('student@example.com', 'Welcome', 'Hello'))
      .rejects.toThrow('Resend email API returned HTTP 403: API key is invalid');
  });
});
