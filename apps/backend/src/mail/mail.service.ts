import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(MailService.name);

    constructor(private configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('SMTP_HOST', 'localhost'),
            port: this.configService.get<number>('SMTP_PORT', 1025),
            secure: false, // true for 465, false for other ports
            auth: {
                user: this.configService.get<string>('SMTP_USER', ''),
                pass: this.configService.get<string>('SMTP_PASS', ''),
            },
        });
    }

    async sendMail(to: string, subject: string, text: string, html?: string) {
        const from = this.configService.get<string>('MAIL_FROM', 'noreply@edustack.local');

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
        const setupUrl = `http://localhost:5173/activate?token=${token}`; // TODO: use real base URL

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
}
