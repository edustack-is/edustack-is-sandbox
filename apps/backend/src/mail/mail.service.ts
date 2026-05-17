import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const port = Number(this.configService.get<string>('SMTP_PORT', '1025'));
    const user = this.configService.get<string>('SMTP_USER', '');
    const pass = this.configService.get<string>('SMTP_PASS', '');

    const transportOptions: Record<string, any> = {
      host,
      port,
      secure: port === 465,
    };

    if (user && pass) {
      transportOptions.auth = { user, pass };
    }

    this.transporter = nodemailer.createTransport(
      transportOptions as nodemailer.TransportOptions,
    );
    this.logger.log(
      `SMTP transport configured: ${host}:${port} (auth: ${user ? 'on' : 'off'})`,
    );
  }

  async sendMail(to: string, subject: string, text: string, html?: string) {
    const from = this.configService.get<string>(
      'MAIL_FROM',
      'noreply@edustack.local',
    );

    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
      throw error;
    }
  }

  async sendInvitation(to: string, name: string, token: string) {
    const subject = 'Pozvánka do EduStack IS';
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const setupUrl = `${frontendUrl}/activate?token=${token}`;

    const text = `Dobrý den, ${name},\n\nbyli jste pozváni do školního systému EduStack IS. Svůj účet si můžete aktivovat na následujícím odkazu:\n\n${setupUrl}\n\nTento odkaz vyprší za 7 dní.`;

    const html = `
      <h1>Vítejte v EduStack IS</h1>
      <p>Dobrý den, ${name},</p>
      <p>byli jste pozváni do školního systému <strong>EduStack IS</strong>.</p>
      <p>Svůj účet si můžete aktivovat kliknutím na tlačítko níže:</p>
      <p>
        <a href="${setupUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Aktivovat účet</a>
      </p>
      <p>Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:</p>
      <p>${setupUrl}</p>
      <p>Tento odkaz vyprší za 7 dní.</p>
    `;

    return this.sendMail(to, subject, text, html);
  }

  async sendPasswordReset(to: string, name: string, token: string) {
    const subject = 'Obnovení hesla – EduStack IS';
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const text = `Dobrý den, ${name},\n\nobdrželi jsme žádost o obnovení hesla k vašemu účtu v EduStack IS.\n\nPro nastavení nového hesla klikněte na následující odkaz:\n\n${resetUrl}\n\nTento odkaz vyprší za 1 hodinu.\n\nPokud jste o obnovení hesla nežádali, tento email ignorujte.`;

    const html = `
      <h1>Obnovení hesla – EduStack IS</h1>
      <p>Dobrý den, ${name},</p>
      <p>obdrželi jsme žádost o obnovení hesla k vašemu účtu v <strong>EduStack IS</strong>.</p>
      <p>Pro nastavení nového hesla klikněte na tlačítko níže:</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Nastavit nové heslo</a>
      </p>
      <p>Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:</p>
      <p>${resetUrl}</p>
      <p>Tento odkaz vyprší za 1 hodinu.</p>
      <p style="color: #666; font-size: 12px;">Pokud jste o obnovení hesla nežádali, tento email ignorujte.</p>
    `;

    return this.sendMail(to, subject, text, html);
  }

  async sendNotificationEmail(
    to: string,
    title: string,
    body?: string,
    linkUrl?: string,
  ) {
    const subject = `EduStack: ${title}`;
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const fullLinkUrl = linkUrl
      ? `${frontendUrl}${linkUrl.startsWith('/') ? '' : '/'}${linkUrl}`
      : null;

    const text = `${title}${body ? `\n\n${body}` : ''}${fullLinkUrl ? `\n\nZobrazit v aplikaci: ${fullLinkUrl}` : ''}`;

    const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">${title}</h2>
                ${body ? `<p style="color: #4a4a4a;">${body}</p>` : ''}
                ${fullLinkUrl ? `<p><a href="${fullLinkUrl}" style="display: inline-block; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Zobrazit v aplikaci</a></p>` : ''}
                <hr style="border-color: #e5e7eb; margin: 20px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">Tuto notifikaci můžete vypnout v nastavení profilu.</p>
            </div>
        `;

    return this.sendMail(to, subject, text, html);
  }
}
