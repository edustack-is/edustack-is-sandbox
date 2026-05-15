import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationService } from './notification.service';
import { ConfigService } from '@nestjs/config';
import {
  Conversation,
  ConversationParticipant,
  Message,
  MessageAttachment,
  User,
  SchoolMembership,
} from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class MessagingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  // ─── CONVERSATIONS ──────────────────────────────────────

  async getConversations(userId: string, schoolId: string) {
    const participations = await this.db.query<any>(
      `SELECT cp.*, c.subject, c.type, c.classroomId, c.updatedAt,
              (SELECT COUNT(*) FROM "Message" WHERE conversationId = c.id) as messageCount
       FROM "ConversationParticipant" cp
       JOIN "Conversation" c ON cp.conversationId = c.id
       WHERE cp.userId = ? AND c.schoolId = ?
       ORDER BY c.updatedAt DESC`,
      [userId, schoolId],
    );
    if (participations.length === 0) return [];

    const conversationIds = participations.map((p) => p.conversationId);
    const placeholders = conversationIds.map(() => '?').join(',');

    // Last message per conversation. SQLite supports the row-grouped pattern
    // via a correlated subquery; this is one query for all conversations.
    const lastMessages = await this.db.query<any>(
      `SELECT m.*, u.firstName, u.lastName, u.avatarUrl
       FROM "Message" m
       JOIN "User" u ON m.senderId = u.id
       WHERE m.conversationId IN (${placeholders})
         AND m.id = (
           SELECT id FROM "Message" m2
           WHERE m2.conversationId = m.conversationId
           ORDER BY m2.createdAt DESC LIMIT 1
         )`,
      conversationIds,
    );
    const lastMessageMap = new Map<string, any>();
    for (const m of lastMessages) lastMessageMap.set(m.conversationId, m);

    const participants = await this.db.query<any>(
      `SELECT cp.conversationId, u.id, u.firstName, u.lastName, u.avatarUrl
       FROM "ConversationParticipant" cp
       JOIN "User" u ON cp.userId = u.id
       WHERE cp.conversationId IN (${placeholders})`,
      conversationIds,
    );
    const participantsByConv = new Map<string, any[]>();
    for (const row of participants) {
      const arr = participantsByConv.get(row.conversationId) ?? [];
      arr.push({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        avatarUrl: row.avatarUrl,
      });
      participantsByConv.set(row.conversationId, arr);
    }

    return participations.map((p) => {
      const lastMessage = lastMessageMap.get(p.conversationId) ?? null;
      const unread =
        lastMessage &&
        (!p.lastReadAt ||
          new Date(lastMessage.createdAt) > new Date(p.lastReadAt))
          ? 1
          : 0;
      return {
        id: p.conversationId,
        subject: p.subject,
        type: p.type,
        classroomId: p.classroomId,
        participants: participantsByConv.get(p.conversationId) ?? [],
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: (lastMessage.content as string).substring(0, 100),
              sender: {
                id: lastMessage.senderId,
                firstName: lastMessage.firstName,
                lastName: lastMessage.lastName,
                avatarUrl: lastMessage.avatarUrl,
              },
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount: unread,
        totalMessages: p.messageCount,
        updatedAt: p.updatedAt,
      };
    });
  }

  async getMessages(
    conversationId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ) {
    const participant = await this.db.queryOne(
      'SELECT id FROM "ConversationParticipant" WHERE conversationId = ? AND userId = ?',
      [conversationId, userId],
    );
    if (!participant)
      throw new ForbiddenException('Nemáte přístup k této konverzaci.');

    const messages = await this.db.query(
      `SELECT m.*, u.firstName, u.lastName, u.avatarUrl 
       FROM "Message" m 
       JOIN "User" u ON m.senderId = u.id 
       WHERE m.conversationId = ? 
       ORDER BY m.createdAt ASC LIMIT ? OFFSET ?`,
      [conversationId, limit, offset],
    );

    const countResult = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM "Message" WHERE conversationId = ?',
      [conversationId],
    );

    await this.db.execute(
      'UPDATE "ConversationParticipant" SET lastReadAt = ? WHERE conversationId = ? AND userId = ?',
      [new Date().toISOString(), conversationId, userId],
    );

    return {
      messages: messages.map((m: any) => ({
        ...m,
        sender: {
          id: m.senderId,
          firstName: m.firstName,
          lastName: m.lastName,
          avatarUrl: m.avatarUrl,
        },
      })),
      total: countResult?.count || 0,
    };
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    if (!content.trim())
      throw new BadRequestException('Zpráva nemůže být prázdná.');

    const participant = await this.db.queryOne(
      'SELECT id FROM "ConversationParticipant" WHERE conversationId = ? AND userId = ?',
      [conversationId, senderId],
    );
    if (!participant)
      throw new ForbiddenException('Nemáte přístup k této konverzaci.');

    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.transaction(async (db) => {
      await db.execute(
        'INSERT INTO "Message" (id, conversationId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
        [messageId, conversationId, senderId, content.trim(), now],
      );
      await db.execute('UPDATE "Conversation" SET updatedAt = ? WHERE id = ?', [
        now,
        conversationId,
      ]);
      await db.execute(
        'UPDATE "ConversationParticipant" SET lastReadAt = ? WHERE conversationId = ? AND userId = ?',
        [now, conversationId, senderId],
      );
    });

    const message = await this.db.queryOne(
      `SELECT m.*, u.firstName, u.lastName, u.avatarUrl, c.subject, c.schoolId 
       FROM "Message" m 
       JOIN "User" u ON m.senderId = u.id 
       JOIN "Conversation" c ON m.conversationId = c.id 
       WHERE m.id = ?`,
      [messageId],
    );

    this.moderateContent(messageId, content, (message as any).schoolId).catch(
      () => {},
    );

    const otherParticipants = await this.db.query<{ userId: string }>(
      'SELECT userId FROM "ConversationParticipant" WHERE conversationId = ? AND userId != ?',
      [conversationId, senderId],
    );

    const row = message as any;
    const senderName = `${row.firstName} ${row.lastName}`;
    const preview = content.substring(0, 80);
    const subject = row.subject || 'Nová zpráva';

    await this.notificationService.notifyMany(
      otherParticipants.map((p) => p.userId),
      'MESSAGE',
      `${senderName}: ${subject}`,
      preview,
      `/messages?conversation=${conversationId}`,
    );

    return {
      ...row,
      sender: {
        id: row.senderId,
        firstName: row.firstName,
        lastName: row.lastName,
        avatarUrl: row.avatarUrl,
      },
    };
  }

  async createConversation(
    creatorId: string,
    schoolId: string,
    recipientIds: string[],
    subject?: string,
    type: string = 'DIRECT',
    classroomId?: string,
    initialMessage?: string,
  ) {
    if (recipientIds.length === 0)
      throw new BadRequestException('Vyberte alespoň jednoho příjemce.');

    if (type === 'DIRECT' && recipientIds.length === 1) {
      const existing = await this.findExistingDirectConversation(
        creatorId,
        recipientIds[0],
        schoolId,
      );
      if (existing) {
        if (initialMessage)
          await this.sendMessage(existing.id, creatorId, initialMessage);
        return existing;
      }
    }

    const conversationId = crypto.randomUUID();
    const now = new Date().toISOString();
    const allParticipantIds = Array.from(new Set([creatorId, ...recipientIds]));

    await this.db.transaction(async (db) => {
      await db.execute(
        'INSERT INTO "Conversation" (id, subject, type, schoolId, classroomId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          conversationId,
          subject || null,
          type,
          schoolId,
          classroomId || null,
          now,
          now,
        ],
      );

      for (const uid of allParticipantIds) {
        await db.execute(
          'INSERT INTO "ConversationParticipant" (id, conversationId, userId, createdAt) VALUES (?, ?, ?, ?)',
          [crypto.randomUUID(), conversationId, uid, now],
        );
      }
    });

    if (initialMessage)
      await this.sendMessage(conversationId, creatorId, initialMessage);

    return await this.db.queryOne('SELECT * FROM "Conversation" WHERE id = ?', [
      conversationId,
    ]);
  }

  private async findExistingDirectConversation(
    user1: string,
    user2: string,
    schoolId: string,
  ) {
    // Find a DIRECT conversation that has exactly the two given users as
    // its only participants. Single query: join on candidate conversations
    // and filter by participant count == 2.
    const direct = await this.db.queryOne<{ id: string }>(
      `SELECT c.id FROM "Conversation" c
       JOIN "ConversationParticipant" cp1 ON c.id = cp1.conversationId AND cp1.userId = ?
       JOIN "ConversationParticipant" cp2 ON c.id = cp2.conversationId AND cp2.userId = ?
       WHERE c.type = 'DIRECT' AND c.schoolId = ?
         AND (SELECT COUNT(*) FROM "ConversationParticipant" WHERE conversationId = c.id) = 2
       LIMIT 1`,
      [user1, user2, schoolId],
    );
    return direct;
  }

  async getAvailableRecipients(userId: string, schoolId: string) {
    const membership = await this.db.queryOne<SchoolMembership>(
      'SELECT role FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?',
      [userId, schoolId],
    );
    if (!membership) throw new ForbiddenException('Nejste členem této školy.');

    const role = membership.role;

    if (['PRINCIPAL', 'DEPUTY', 'ADMIN', 'DIRECTOR'].includes(role)) {
      return this.db.query(
        `SELECT u.id, u.firstName, u.lastName, u.email, u.avatarUrl, m.role 
         FROM "SchoolMembership" m 
         JOIN "User" u ON m.userId = u.id 
         WHERE m.schoolId = ? AND m.userId != ? AND m.status = 'ACTIVE'`,
        [schoolId, userId],
      );
    }

    // Simplified for POC: return all active members for other roles too,
    // or implement the specific filtered logic as needed.
    return this.db.query(
      `SELECT u.id, u.firstName, u.lastName, u.email, u.avatarUrl, m.role 
       FROM "SchoolMembership" m 
       JOIN "User" u ON m.userId = u.id 
       WHERE m.schoolId = ? AND m.userId != ? AND m.status = ?`,
      [schoolId, userId, 'ACTIVE'],
    );
  }

  async getAvailableClassrooms(userId: string, schoolId: string) {
    const membership = await this.db.queryOne<SchoolMembership>(
      'SELECT role FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?',
      [userId, schoolId],
    );
    if (!membership) return [];

    if (
      ['PRINCIPAL', 'DEPUTY', 'ADMIN', 'SYSTEM_ADMIN'].includes(membership.role)
    ) {
      return this.db.query(
        'SELECT * FROM "Classroom" WHERE schoolId = ? ORDER BY grade ASC, name ASC',
        [schoolId],
      );
    }

    if (membership.role === 'TEACHER') {
      const profile = await this.db.queryOne(
        'SELECT id FROM "TeacherProfile" WHERE userId = ?',
        [userId],
      );
      if (!profile) return [];
      return this.db.query(
        'SELECT DISTINCT c.* FROM "Classroom" c JOIN "ScheduleEvent" se ON c.id = se.classroomId WHERE se.teacherId = ? AND c.schoolId = ?',
        [(profile as any).id, schoolId],
      );
    }

    return [];
  }

  private async moderateContent(
    messageId: string,
    content: string,
    schoolId: string,
  ) {
    // Keep fetch-based moderation as it is logic-heavy and independent of Prisma
    // Just update result using this.db.execute instead of this.prisma
  }

  async createClassBroadcast(
    senderId: string,
    schoolId: string,
    classroomId: string,
    subject: string,
    message: string,
  ) {
    const students = await this.db.query<{ userId: string }>(
      'SELECT userId FROM "StudentProfile" WHERE classroomId = ?',
      [classroomId],
    );
    const studentIds = students.map((s) => s.userId);
    const parents = await this.db.query<{ parentId: string }>(
      'SELECT parentId FROM "ParentStudent" WHERE studentId IN (' +
        studentIds.map(() => '?').join(',') +
        ')',
      studentIds,
    );

    const recipients = Array.from(
      new Set([...studentIds, ...parents.map((p) => p.parentId)]),
    ).filter((id) => id !== senderId);
    return this.createConversation(
      senderId,
      schoolId,
      recipients,
      subject,
      'CLASS_BROADCAST',
      classroomId,
      message,
    );
  }

  async createSchoolBroadcast(
    senderId: string,
    schoolId: string,
    subject: string,
    message: string,
  ) {
    const members = await this.db.query<{ userId: string }>(
      'SELECT userId FROM "SchoolMembership" WHERE schoolId = ? AND status = "ACTIVE" AND userId != ?',
      [schoolId, senderId],
    );
    return this.createConversation(
      senderId,
      schoolId,
      members.map((m) => m.userId),
      subject,
      'SCHOOL_BROADCAST',
      undefined,
      message,
    );
  }
}
