import nodemailer from 'nodemailer';

export type NotificationService = {
  sendEmail(to: string, subject: string, text: string): Promise<void>;
  sendSms(to: string, message: string): Promise<void>;
};

export function createNotificationService(): NotificationService {
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
      if (!transporter || !emailFrom) throw new NotificationConfigurationError('Email delivery is not configured');
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