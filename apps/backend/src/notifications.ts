import nodemailer from 'nodemailer';

export type NotificationService = {
  sendEmail(to: string, subject: string, text: string): Promise<void>;
  sendSms(to: string, message: string): Promise<void>;
};

export function createNotificationService(): NotificationService {
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM;
  const smsWebhookUrl = process.env.SMS_WEBHOOK_URL;
  const smsWebhookToken = process.env.SMS_WEBHOOK_TOKEN;

  const transporter = smtpHost && smtpUser && smtpPassword
    ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
      requireTLS: smtpPort !== 465
    })
    : null;

  return {
    async sendEmail(to, subject, text) {
      if (!emailFrom) throw new NotificationConfigurationError('EMAIL_FROM is required for email delivery');
      if (resendApiKey) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from: emailFrom, to: [to], subject, text }),
            signal: controller.signal
          });
          if (!response.ok) {
            const responseBody = await response.text();
            let providerMessage = '';
            try {
              const details = JSON.parse(responseBody) as { message?: unknown; name?: unknown };
              if (typeof details.message === 'string') providerMessage = details.message;
              else if (typeof details.name === 'string') providerMessage = details.name;
            } catch {
              providerMessage = responseBody.slice(0, 300);
            }
            throw new Error(`Resend email API returned HTTP ${response.status}${providerMessage ? `: ${providerMessage}` : ''}`);
          }
        } finally {
          clearTimeout(timeout);
        }
        return;
      }
      if (!transporter) throw new NotificationConfigurationError('Configure RESEND_API_KEY or complete the SMTP settings to enable email delivery');
      await transporter.sendMail({ from: emailFrom, to, subject, text });
    },
    async sendSms(to, message) {
      if (!smsWebhookUrl) throw new NotificationConfigurationError('SMS delivery is not configured');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(smsWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(smsWebhookToken ? { Authorization: `Bearer ${smsWebhookToken}` } : {})
          },
          body: JSON.stringify({ to, message }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

export class NotificationConfigurationError extends Error {}