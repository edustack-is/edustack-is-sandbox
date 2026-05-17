import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const BRAND = {
  name: 'EduStack IS',
  primary: '#4F46E5', // indigo-600
  primaryDark: '#3730A3', // indigo-800
  text: '#1F2937', // slate-800
  muted: '#6B7280', // slate-500
  border: '#E5E7EB', // slate-200
  background: '#F3F4F6', // slate-100
  card: '#FFFFFF',
};

interface EmailLayoutOptions {
  preheader?: string;
  heading: string;
  greeting?: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaFallbackLabel?: string;
  expiryNote?: string;
  footnote?: string;
  bodyParagraphs?: string[];
}

/**
 * Escape user-supplied strings before they land in an HTML template. Email
 * clients render HTML directly, so an unsanitised name field would let
 * `<script>` / unbalanced markup through. Used for everything that
 * originates from the database or external input.
 */
function escapeHtml(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmailLayout(opts: EmailLayoutOptions): string {
  const {
    preheader = '',
    heading,
    greeting,
    intro,
    ctaLabel,
    ctaUrl,
    ctaFallbackLabel,
    expiryNote,
    footnote,
    bodyParagraphs = [],
  } = opts;

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
        <tr>
          <td align="center" style="padding: 8px 0 16px 0;">
            <a href="${ctaUrl}" target="_blank" rel="noopener" style="display: inline-block; background-color: ${BRAND.primary}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 8px; mso-padding-alt: 0;">
              ${escapeHtml(ctaLabel)}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 0 16px 0; color: ${BRAND.muted}; font-size: 13px; line-height: 1.5;">
            ${escapeHtml(ctaFallbackLabel || 'If the button does not work, copy and paste this link into your browser:')}<br />
            <a href="${ctaUrl}" style="color: ${BRAND.primary}; word-break: break-all;">${ctaUrl}</a>
          </td>
        </tr>`
      : '';

  const extraParagraphs = bodyParagraphs
    .map(
      (p) =>
        `<tr><td style="padding: 0 0 16px 0; color: ${BRAND.text}; font-size: 15px; line-height: 1.6;">${p}</td></tr>`,
    )
    .join('');

  const expiryBlock = expiryNote
    ? `<tr><td style="padding: 0 0 16px 0; color: ${BRAND.muted}; font-size: 13px; line-height: 1.5;">${escapeHtml(expiryNote)}</td></tr>`
    : '';

  const footnoteBlock = footnote
    ? `<tr><td style="padding: 16px 0 0 0; border-top: 1px solid ${BRAND.border}; color: ${BRAND.muted}; font-size: 12px; line-height: 1.5;">${escapeHtml(footnote)}</td></tr>`
    : '';

  const greetingBlock = greeting
    ? `<tr><td style="padding: 0 0 12px 0; color: ${BRAND.text}; font-size: 15px; line-height: 1.6;">${escapeHtml(greeting)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${BRAND.background};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: ${BRAND.card}; border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: ${BRAND.primary}; padding: 24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.01em;">
                    ${BRAND.name}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 0 16px 0; color: ${BRAND.text}; font-size: 22px; font-weight: 700; line-height: 1.3;">
                    ${escapeHtml(heading)}
                  </td>
                </tr>
                ${greetingBlock}
                <tr>
                  <td style="padding: 0 0 16px 0; color: ${BRAND.text}; font-size: 15px; line-height: 1.6;">
                    ${intro}
                  </td>
                </tr>
                ${extraParagraphs}
                ${ctaBlock}
                ${expiryBlock}
                ${footnoteBlock}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: ${BRAND.background}; border-top: 1px solid ${BRAND.border}; color: ${BRAND.muted}; font-size: 12px; line-height: 1.5; text-align: center;">
              © ${new Date().getFullYear()} ${BRAND.name}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
    const subject = `Pozvánka do ${BRAND.name}`;
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const setupUrl = `${frontendUrl}/activate?token=${encodeURIComponent(token)}`;

    const text = `Dobrý den, ${name},

byli jste pozváni do školního systému ${BRAND.name}. Svůj účet si můžete aktivovat na následujícím odkazu:

${setupUrl}

Tento odkaz vyprší za 7 dní. Pokud jste tuto pozvánku neočekávali, e-mail prosím ignorujte.`;

    const html = renderEmailLayout({
      preheader: 'Aktivujte svůj účet a začněte používat školní systém.',
      heading: `Vítejte v ${BRAND.name}`,
      greeting: `Dobrý den, ${name},`,
      intro: `byli jste pozváni do školního systému <strong>${escapeHtml(BRAND.name)}</strong>. Svůj účet si můžete aktivovat kliknutím na tlačítko níže.`,
      ctaLabel: 'Aktivovat účet',
      ctaUrl: setupUrl,
      ctaFallbackLabel:
        'Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:',
      expiryNote: 'Tento aktivační odkaz vyprší za 7 dní.',
      footnote:
        'Pokud jste tuto pozvánku neočekávali, e-mail prosím ignorujte – žádný účet nebude vytvořen, dokud odkaz nepoužijete.',
    });

    return this.sendMail(to, subject, text, html);
  }

  async sendPasswordReset(to: string, name: string, token: string) {
    const subject = `Obnovení hesla – ${BRAND.name}`;
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    const text = `Dobrý den, ${name},

obdrželi jsme žádost o obnovení hesla k vašemu účtu v ${BRAND.name}.

Pro nastavení nového hesla otevřete následující odkaz:

${resetUrl}

Tento odkaz vyprší za 1 hodinu. Pokud jste o obnovení hesla nežádali, tento e-mail můžete ignorovat – heslo zůstane beze změny.`;

    const html = renderEmailLayout({
      preheader: 'Nastavte si nové heslo pomocí jednorázového odkazu.',
      heading: 'Obnovení hesla',
      greeting: `Dobrý den, ${name},`,
      intro: `obdrželi jsme žádost o obnovení hesla k vašemu účtu v <strong>${escapeHtml(BRAND.name)}</strong>. Pro nastavení nového hesla klikněte na tlačítko níže.`,
      ctaLabel: 'Nastavit nové heslo',
      ctaUrl: resetUrl,
      ctaFallbackLabel:
        'Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:',
      expiryNote: 'Odkaz je platný jednu hodinu od odeslání tohoto e-mailu.',
      footnote:
        'Pokud jste o obnovení hesla nežádali, tento e-mail můžete ignorovat – vaše heslo zůstane beze změny.',
    });

    return this.sendMail(to, subject, text, html);
  }

  async sendNotificationEmail(
    to: string,
    title: string,
    body?: string,
    linkUrl?: string,
  ) {
    const subject = `${BRAND.name}: ${title}`;
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const fullLinkUrl = linkUrl
      ? `${frontendUrl}${linkUrl.startsWith('/') ? '' : '/'}${linkUrl}`
      : null;

    const text = `${title}${body ? `\n\n${body}` : ''}${
      fullLinkUrl ? `\n\nZobrazit v aplikaci: ${fullLinkUrl}` : ''
    }`;

    const html = renderEmailLayout({
      preheader: title,
      heading: title,
      intro: body
        ? escapeHtml(body).replace(/\n/g, '<br />')
        : 'V aplikaci na vás čeká nová notifikace.',
      ctaLabel: fullLinkUrl ? 'Zobrazit v aplikaci' : undefined,
      ctaUrl: fullLinkUrl || undefined,
      ctaFallbackLabel:
        'Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:',
      footnote: 'Tuto notifikaci můžete vypnout v nastavení profilu.',
    });

    return this.sendMail(to, subject, text, html);
  }
}
