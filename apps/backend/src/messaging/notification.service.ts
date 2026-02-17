import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
    ) { }

    /**
     * Create an in-app notification and optionally send email.
     */
    async createNotification(
        userId: string,
        type: string,
        title: string,
        body?: string,
        linkUrl?: string,
    ) {
        const notification = await this.prisma.notification.create({
            data: { userId, type, title, body, linkUrl },
        });

        // Send email if user has it enabled
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, emailNotificationsEnabled: true, firstName: true },
            });

            if (user?.emailNotificationsEnabled && user.email) {
                const html = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1a1a1a;">${title}</h2>
                        ${body ? `<p style="color: #4a4a4a;">${body}</p>` : ''}
                        ${linkUrl ? `<p><a href="http://localhost:5173${linkUrl}" style="display: inline-block; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Zobrazit v aplikaci</a></p>` : ''}
                        <hr style="border-color: #e5e7eb; margin: 20px 0;" />
                        <p style="color: #9ca3af; font-size: 12px;">Tuto notifikaci můžete vypnout v nastavení profilu.</p>
                    </div>
                `;
                await this.mailService.sendMail(
                    user.email,
                    `EduStack: ${title}`,
                    body || title,
                    html,
                );
            }
        } catch (err) {
            this.logger.warn(`Failed to send email notification to user ${userId}`, err);
        }

        return notification;
    }

    /**
     * Notify multiple users (batch).
     */
    async notifyMany(
        userIds: string[],
        type: string,
        title: string,
        body?: string,
        linkUrl?: string,
    ) {
        // Create all notifications in a transaction
        const notifications = await this.prisma.notification.createMany({
            data: userIds.map(userId => ({ userId, type, title, body, linkUrl })),
        });

        // Send emails in background (don't block)
        for (const userId of userIds) {
            this.createEmailIfEnabled(userId, title, body, linkUrl).catch(() => { });
        }

        return notifications;
    }

    private async createEmailIfEnabled(
        userId: string,
        title: string,
        body?: string,
        linkUrl?: string,
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, emailNotificationsEnabled: true },
        });
        if (!user?.emailNotificationsEnabled || !user.email) return;

        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">${title}</h2>
                ${body ? `<p style="color: #4a4a4a;">${body}</p>` : ''}
                ${linkUrl ? `<p><a href="http://localhost:5173${linkUrl}" style="display: inline-block; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Zobrazit v aplikaci</a></p>` : ''}
                <hr style="border-color: #e5e7eb; margin: 20px 0;" />
                <p style="color: #9ca3af; font-size: 12px;">Tuto notifikaci můžete vypnout v nastavení profilu.</p>
            </div>
        `;
        await this.mailService.sendMail(user.email, `EduStack: ${title}`, body || title, html);
    }

    /**
     * Get notifications for a user (paginated).
     */
    async getNotifications(userId: string, limit = 20, offset = 0) {
        const [notifications, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.notification.count({ where: { userId } }),
            this.prisma.notification.count({ where: { userId, read: false } }),
        ]);
        return { notifications, total, unreadCount };
    }

    async getUnreadCount(userId: string): Promise<number> {
        return this.prisma.notification.count({ where: { userId, read: false } });
    }

    async markAsRead(notificationId: string, userId: string) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { read: true },
        });
    }

    async markAllRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });
    }
}
