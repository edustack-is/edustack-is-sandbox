import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private configService: ConfigService,
  ) {}

  // ─── CONVERSATIONS ──────────────────────────────────────

  /**
   * List conversations for a user with unread counts and last message preview.
   */
  async getConversations(userId: string, schoolId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId, conversation: { schoolId } },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            _count: { select: { messages: true } },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return participations.map((p) => {
      const conv = p.conversation;
      const lastMessage = conv.messages[0] || null;
      const unreadCount =
        lastMessage &&
        (!p.lastReadAt ||
          new Date(lastMessage.createdAt) > new Date(p.lastReadAt))
          ? 1 // Simplified: at least 1 unread
          : 0;

      return {
        id: conv.id,
        subject: conv.subject,
        type: conv.type,
        classroomId: conv.classroomId,
        participants: conv.participants.map((pp) => pp.user),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content.substring(0, 100),
              sender: lastMessage.sender,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount,
        totalMessages: conv._count.messages,
        updatedAt: conv.updatedAt,
      };
    });
  }

  /**
   * Get messages in a conversation. Marks as read.
   */
  async getMessages(
    conversationId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ) {
    // Verify user is a participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant)
      throw new ForbiddenException('Nemáte přístup k této konverzaci.');

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          attachments: true,
        },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    // Mark as read
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    return { messages, total };
  }

  /**
   * Send a message in an existing conversation.
   */
  async sendMessage(conversationId: string, senderId: string, content: string) {
    if (!content.trim())
      throw new BadRequestException('Zpráva nemůže být prázdná.');

    // Verify sender is participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant)
      throw new ForbiddenException('Nemáte přístup k této konverzaci.');

    const message = await this.prisma.message.create({
      data: { conversationId, senderId, content: content.trim() },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        conversation: { select: { subject: true, schoolId: true } },
        attachments: true,
      },
    });

    // AI content moderation (async, don’t block message delivery)
    this.moderateContent(
      message.id,
      content,
      message.conversation.schoolId,
    ).catch(() => {});

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Update sender's lastReadAt
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      data: { lastReadAt: new Date() },
    });

    // Notify other participants
    const otherParticipants =
      await this.prisma.conversationParticipant.findMany({
        where: { conversationId, userId: { not: senderId } },
        select: { userId: true },
      });

    const senderName = `${message.sender.firstName} ${message.sender.lastName}`;
    const preview = content.substring(0, 80);
    const subject = message.conversation.subject || 'Nová zpráva';

    await this.notificationService.notifyMany(
      otherParticipants.map((p) => p.userId),
      'MESSAGE',
      `${senderName}: ${subject}`,
      preview,
      `/messages?conversation=${conversationId}`,
    );

    return message;
  }

  /**
   * Create a new conversation.
   */
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

    // For DIRECT conversations, check if one already exists between these two users
    if (type === 'DIRECT' && recipientIds.length === 1) {
      const existing = await this.findExistingDirectConversation(
        creatorId,
        recipientIds[0],
        schoolId,
      );
      if (existing) {
        // Send message in existing conversation if initialMessage provided
        if (initialMessage) {
          await this.sendMessage(existing.id, creatorId, initialMessage);
        }
        return existing;
      }
    }

    // Validate all recipients belong to the same school
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { userId: { in: recipientIds }, schoolId },
    });
    if (memberships.length !== recipientIds.length) {
      throw new BadRequestException('Někteří příjemci nepatří do této školy.');
    }

    // Create conversation with all participants
    const allParticipantIds = [
      creatorId,
      ...recipientIds.filter((id) => id !== creatorId),
    ];

    const conversation = await this.prisma.conversation.create({
      data: {
        subject,
        type,
        schoolId,
        classroomId: classroomId || null,
        participants: {
          create: allParticipantIds.map((userId) => ({ userId })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Send initial message if provided
    if (initialMessage) {
      await this.sendMessage(conversation.id, creatorId, initialMessage);
    }

    return conversation;
  }

  private async findExistingDirectConversation(
    user1: string,
    user2: string,
    schoolId: string,
  ) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        type: 'DIRECT',
        schoolId,
        participants: { some: { userId: user1 } },
      },
      include: {
        participants: { select: { userId: true } },
      },
    });

    return (
      conversations.find(
        (c) =>
          c.participants.length === 2 &&
          c.participants.some((p) => p.userId === user2),
      ) || null
    );
  }

  // ─── AVAILABLE RECIPIENTS ───────────────────────────────

  /**
   * Get available recipients for a user based on their role.
   */
  async getAvailableRecipients(userId: string, schoolId: string) {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (!membership) throw new ForbiddenException('Nejste členem této školy.');

    const role = membership.role;

    // Principal, Deputy, Admin → can message anyone in the school
    if (['PRINCIPAL', 'DEPUTY', 'ADMIN', 'DIRECTOR'].includes(role)) {
      return this.getAllSchoolUsers(schoolId, userId);
    }

    // Teacher → students & parents of taught classes, other teachers, principal/deputy
    if (role === 'TEACHER') {
      return this.getTeacherRecipients(userId, schoolId);
    }

    // Student → teachers who teach them, principal, deputy
    if (role === 'STUDENT') {
      return this.getStudentRecipients(userId, schoolId);
    }

    // Parent → teachers of their children, principal, deputy
    if (role === 'PARENT') {
      return this.getParentRecipients(userId, schoolId);
    }

    return [];
  }

  private async getAllSchoolUsers(schoolId: string, excludeUserId: string) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { schoolId, userId: { not: excludeUserId }, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
    return memberships.map((m) => ({
      ...m.user,
      role: m.role,
    }));
  }

  private async getTeacherRecipients(userId: string, schoolId: string) {
    // Teachers  this teacher teaches with (via schedule)
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!teacherProfile) return [];

    // Get classrooms this teacher teaches
    const scheduleEvents = await this.prisma.scheduleEvent.findMany({
      where: { teacherId: teacherProfile.id, schoolId },
      select: { classroomId: true },
      distinct: ['classroomId'],
    });
    const classroomIds = scheduleEvents.map((e) => e.classroomId);

    // Students in those classrooms
    const students = await this.prisma.studentProfile.findMany({
      where: { classroomId: { in: classroomIds } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Parents of those students
    const studentUserIds = students.map((s) => s.userId);
    const parentRelations = await this.prisma.parentStudent.findMany({
      where: { studentId: { in: studentUserIds } },
      include: {
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Staff (other teachers, principal, deputy)
    const staff = await this.prisma.schoolMembership.findMany({
      where: {
        schoolId,
        userId: { not: userId },
        status: 'ACTIVE',
        role: { in: ['TEACHER', 'PRINCIPAL', 'DEPUTY', 'DIRECTOR', 'ADMIN'] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const result: any[] = [];
    const seen = new Set<string>();

    for (const s of students) {
      if (!seen.has(s.userId)) {
        seen.add(s.userId);
        result.push({ ...s.user, role: 'STUDENT' });
      }
    }
    for (const p of parentRelations) {
      if (!seen.has(p.parent.id)) {
        seen.add(p.parent.id);
        result.push({ ...p.parent, role: 'PARENT' });
      }
    }
    for (const m of staff) {
      if (!seen.has(m.userId)) {
        seen.add(m.userId);
        result.push({ ...m.user, role: m.role });
      }
    }

    return result;
  }

  private async getStudentRecipients(userId: string, schoolId: string) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!studentProfile?.classroomId) return [];

    // Teachers who teach this student's classroom
    const scheduleEvents = await this.prisma.scheduleEvent.findMany({
      where: { classroomId: studentProfile.classroomId, schoolId },
      select: { teacherId: true },
      distinct: ['teacherId'],
    });

    const teacherProfiles = await this.prisma.teacherProfile.findMany({
      where: { id: { in: scheduleEvents.map((e) => e.teacherId) } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Principal and deputy
    const leadership = await this.prisma.schoolMembership.findMany({
      where: {
        schoolId,
        status: 'ACTIVE',
        role: { in: ['PRINCIPAL', 'DEPUTY', 'DIRECTOR'] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const result: any[] = [];
    const seen = new Set<string>();

    for (const t of teacherProfiles) {
      if (!seen.has(t.userId)) {
        seen.add(t.userId);
        result.push({ ...t.user, role: 'TEACHER' });
      }
    }
    for (const m of leadership) {
      if (!seen.has(m.userId)) {
        seen.add(m.userId);
        result.push({ ...m.user, role: m.role });
      }
    }

    return result;
  }

  private async getParentRecipients(userId: string, schoolId: string) {
    // Get children
    const parentRelations = await this.prisma.parentStudent.findMany({
      where: { parentId: userId },
      include: {
        student: {
          include: {
            studentProfile: true,
          },
        },
      },
    });

    const classroomIds = parentRelations
      .map((pr) => pr.student.studentProfile?.classroomId)
      .filter(Boolean) as string[];

    if (classroomIds.length === 0) return [];

    // Teachers of children's classrooms
    const scheduleEvents = await this.prisma.scheduleEvent.findMany({
      where: { classroomId: { in: classroomIds }, schoolId },
      select: { teacherId: true },
      distinct: ['teacherId'],
    });

    const teacherProfiles = await this.prisma.teacherProfile.findMany({
      where: { id: { in: scheduleEvents.map((e) => e.teacherId) } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Principal and deputy
    const leadership = await this.prisma.schoolMembership.findMany({
      where: {
        schoolId,
        status: 'ACTIVE',
        role: { in: ['PRINCIPAL', 'DEPUTY', 'DIRECTOR'] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const result: any[] = [];
    const seen = new Set<string>();

    for (const t of teacherProfiles) {
      if (!seen.has(t.userId)) {
        seen.add(t.userId);
        result.push({ ...t.user, role: 'TEACHER' });
      }
    }
    for (const m of leadership) {
      if (!seen.has(m.userId)) {
        seen.add(m.userId);
        result.push({ ...m.user, role: m.role });
      }
    }

    return result;
  }

  // ─── BROADCAST HELPERS ──────────────────────────────────

  /**
   * Get available classrooms for broadcast (for principals/deputies).
   */
  async getAvailableClassrooms(userId: string, schoolId: string) {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });

    if (
      !membership ||
      !['PRINCIPAL', 'DEPUTY', 'ADMIN', 'DIRECTOR', 'TEACHER'].includes(
        membership.role,
      )
    ) {
      return [];
    }

    if (
      ['PRINCIPAL', 'DEPUTY', 'ADMIN', 'DIRECTOR'].includes(membership.role)
    ) {
      return this.prisma.classroom.findMany({
        where: { schoolId },
        select: { id: true, name: true, grade: true },
        orderBy: { name: 'asc' },
      });
    }

    // Teacher: only classrooms they teach
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!teacherProfile) return [];

    const events = await this.prisma.scheduleEvent.findMany({
      where: { teacherId: teacherProfile.id, schoolId },
      select: { classroomId: true },
      distinct: ['classroomId'],
    });

    return this.prisma.classroom.findMany({
      where: { id: { in: events.map((e) => e.classroomId) } },
      select: { id: true, name: true, grade: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a class broadcast conversation — adds all students + parents + teachers of the classroom.
   */
  async createClassBroadcast(
    senderId: string,
    schoolId: string,
    classroomId: string,
    subject: string,
    message: string,
  ) {
    // Get all students in classroom
    const students = await this.prisma.studentProfile.findMany({
      where: { classroomId },
      select: { userId: true },
    });

    // Get parents of those students
    const studentUserIds = students.map((s) => s.userId);
    const parentRelations = await this.prisma.parentStudent.findMany({
      where: { studentId: { in: studentUserIds } },
      select: { parentId: true },
    });

    const recipientIds = [
      ...students.map((s) => s.userId),
      ...parentRelations.map((p) => p.parentId),
    ];

    // Deduplicate
    const uniqueRecipients = [...new Set(recipientIds)].filter(
      (id) => id !== senderId,
    );

    return this.createConversation(
      senderId,
      schoolId,
      uniqueRecipients,
      subject,
      'CLASS_BROADCAST',
      classroomId,
      message,
    );
  }

  /**
   * Create a school-wide broadcast.
   */
  async createSchoolBroadcast(
    senderId: string,
    schoolId: string,
    subject: string,
    message: string,
  ) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { schoolId, status: 'ACTIVE', userId: { not: senderId } },
      select: { userId: true },
    });

    return this.createConversation(
      senderId,
      schoolId,
      memberships.map((m) => m.userId),
      subject,
      'SCHOOL_BROADCAST',
      undefined,
      message,
    );
  }

  // ─── AI CONTENT MODERATION ──────────────────────────────

  private async moderateContent(
    messageId: string,
    content: string,
    schoolId: string,
  ) {
    try {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) return;

      const prompt = `You are a content moderation system for a school information system. Analyze the following message and determine if it contains:
1. Threats or violence
2. Harassment or bullying
3. Sexually explicit content
4. Hate speech
5. Profanity or vulgar language inappropriate for a school environment

Respond with JSON: {"flagged": boolean, "reason": string | null}
If the content is appropriate, return {"flagged": false, "reason": null}.
If flagged, provide a brief reason in Czech.

Message: "${content.replace(/"/g, '\\"').substring(0, 500)}";
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) return;

      const result = JSON.parse(jsonMatch[0]);
      if (result.flagged) {
        await this.prisma.message.update({
          where: { id: messageId },
          data: { flagged: true, flagReason: result.reason },
        });

        // Notify school admins
        const admins = await this.prisma.schoolMembership.findMany({
          where: {
            schoolId,
            role: { in: ['PRINCIPAL', 'DEPUTY'] },
            status: 'ACTIVE',
          },
          select: { userId: true },
        });
        await this.notificationService.notifyMany(
          admins.map((a) => a.userId),
          'SYSTEM',
          'Zpráva označena',
          `Zpráva byla automaticky označena: ${result.reason}`,
          '/messages',
        );
      }
    } catch {
      // Moderation failure should not block messaging
    }
  }

  async moderateAttachment(
    attachmentId: string,
    mimeType: string,
    schoolId: string,
  ) {
    // MIME type whitelist
    const ALLOWED = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!ALLOWED.includes(mimeType)) {
      await this.prisma.messageAttachment.update({
        where: { id: attachmentId },
        data: {
          flagged: true,
          flagReason: `Nepovolený typ souboru: ${mimeType}`,
        },
      });
      return;
    }

    // For images, we could do Gemini Vision check (placeholder for future)
    if (mimeType.startsWith('image/')) {
      // TODO: Gemini Vision API for NSFW detection
    }
  }
}
