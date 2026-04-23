import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { User, Notification } from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
  ) {}

  async createNotification(
    userId: string,
    type: string,
    title: string,
    body?: string,
    linkUrl?: string,
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Notification" (id, userId, type, title, body, linkUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        userId,
        type,
        title,
        body || null,
        linkUrl || null,
        new Date().toISOString(),
      ],
    );

    try {
      const user = await this.db.queryOne<User>(
        'SELECT email, emailNotificationsEnabled FROM "User" WHERE id = ?',
        [userId],
      );
      if (user?.emailNotificationsEnabled && user.email) {
        await this.mailService.sendNotificationEmail(
          user.email,
          title,
          body,
          linkUrl,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to send email notification to user ${userId}`);
    }

    return await this.db.queryOne('SELECT * FROM "Notification" WHERE id = ?', [
      id,
    ]);
  }

  async notifyMany(
    userIds: string[],
    type: string,
    title: string,
    body?: string,
    linkUrl?: string,
  ) {
    await this.db.transaction(async (db) => {
      for (const userId of userIds) {
        await db.execute(
          'INSERT INTO "Notification" (id, userId, type, title, body, linkUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            userId,
            type,
            title,
            body || null,
            linkUrl || null,
            new Date().toISOString(),
          ],
        );
      }
    });

    for (const userId of userIds) {
      this.createEmailIfEnabled(userId, title, body, linkUrl).catch(() => {});
    }
  }

  private async createEmailIfEnabled(
    userId: string,
    title: string,
    body?: string,
    linkUrl?: string,
  ) {
    const user = await this.db.queryOne<User>(
      'SELECT email, emailNotificationsEnabled FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user?.emailNotificationsEnabled || !user.email) return;
    await this.mailService.sendNotificationEmail(
      user.email,
      title,
      body,
      linkUrl,
    );
  }

  async getNotifications(userId: string, limit = 20, offset = 0) {
    const [notifications, totalResult, unreadResult] = await Promise.all([
      this.db.query(
        'SELECT * FROM "Notification" WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?',
        [userId, limit, offset],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "Notification" WHERE userId = ?',
        [userId],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "Notification" WHERE userId = ? AND read = 0',
        [userId],
      ),
    ]);
    return {
      notifications,
      total: totalResult?.count || 0,
      unreadCount: unreadResult?.count || 0,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM "Notification" WHERE userId = ? AND read = 0',
      [userId],
    );
    return result?.count || 0;
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.db.execute(
      'UPDATE "Notification" SET read = 1 WHERE id = ? AND userId = ?',
      [notificationId, userId],
    );
  }

  async markAllRead(userId: string) {
    return this.db.execute(
      'UPDATE "Notification" SET read = 1 WHERE userId = ? AND read = 0',
      [userId],
    );
  }
}
