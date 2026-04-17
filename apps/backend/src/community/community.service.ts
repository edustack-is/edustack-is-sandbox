import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  // ─── BULLETIN BOARD ─────────────────────────────────────

  async createBulletinPost(
    userId: string,
    schoolId: string,
    data: { title: string; content: string; pinned?: boolean },
  ) {
    return this.prisma.bulletinPost.create({
      data: {
        title: data.title,
        content: data.content,
        pinned: data.pinned ?? false,
        authorId: userId,
        schoolId,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
  }

  async getBulletinPosts(schoolId: string) {
    return this.prisma.bulletinPost.findMany({
      where: { schoolId },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateBulletinPost(
    userId: string,
    schoolId: string,
    postId: string,
    data: { title?: string; content?: string; pinned?: boolean },
  ) {
    const post = await this.prisma.bulletinPost.findFirst({
      where: { id: postId, schoolId },
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.bulletinPost.update({
      where: { id: postId },
      data,
      include: { author: { select: { firstName: true, lastName: true } } },
    });
  }

  async deleteBulletinPost(schoolId: string, postId: string) {
    const post = await this.prisma.bulletinPost.findFirst({
      where: { id: postId, schoolId },
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.bulletinPost.delete({ where: { id: postId } });
  }

  // ─── POLLS ──────────────────────────────────────────────

  async createPoll(
    userId: string,
    schoolId: string,
    data: {
      question: string;
      options: string[];
      multiSelect?: boolean;
      endsAt?: string;
    },
  ) {
    if (!data.options || data.options.length < 2)
      throw new BadRequestException('Alespoň 2 možnosti');
    return this.prisma.poll.create({
      data: {
        question: data.question,
        multiSelect: data.multiSelect ?? false,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        authorId: userId,
        schoolId,
        options: {
          create: data.options.map((text) => ({ text })),
        },
      },
      include: {
        options: { include: { _count: { select: { votes: true } } } },
        author: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async getPolls(schoolId: string) {
    return this.prisma.poll.findMany({
      where: { schoolId },
      include: {
        options: { include: { _count: { select: { votes: true } } } },
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { options: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async vote(userId: string, optionId: string) {
    const option = await this.prisma.pollOption.findUnique({
      where: { id: optionId },
      include: { poll: true },
    });
    if (!option) throw new NotFoundException('Option not found');
    if (option.poll.endsAt && new Date() > option.poll.endsAt) {
      throw new BadRequestException('Anketa již skončila');
    }

    // If not multiSelect, remove previous vote for this poll
    if (!option.poll.multiSelect) {
      const existingVotes = await this.prisma.pollVote.findMany({
        where: {
          userId,
          option: { pollId: option.pollId },
        },
      });
      if (existingVotes.length > 0) {
        await this.prisma.pollVote.deleteMany({
          where: { id: { in: existingVotes.map((v) => v.id) } },
        });
      }
    }

    return this.prisma.pollVote.upsert({
      where: { userId_optionId: { userId, optionId } },
      update: {},
      create: { userId, optionId },
    });
  }

  async deletePoll(schoolId: string, pollId: string) {
    const poll = await this.prisma.poll.findFirst({
      where: { id: pollId, schoolId },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    return this.prisma.poll.delete({ where: { id: pollId } });
  }

  // ─── CALENDAR EVENTS ────────────────────────────────────

  async createCalendarEvent(
    userId: string,
    schoolId: string,
    data: {
      title: string;
      description?: string;
      startDate: string;
      endDate?: string;
      location?: string;
    },
  ) {
    return this.prisma.calendarEvent.create({
      data: {
        title: data.title,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        location: data.location,
        authorId: userId,
        schoolId,
      },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { rsvps: true } },
      },
    });
  }

  async getCalendarEvents(schoolId: string) {
    return this.prisma.calendarEvent.findMany({
      where: { schoolId },
      include: {
        author: { select: { firstName: true, lastName: true } },
        rsvps: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { rsvps: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async rsvpEvent(
    userId: string,
    eventId: string,
    status: 'YES' | 'NO' | 'MAYBE',
  ) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.eventRsvp.upsert({
      where: { userId_eventId: { userId, eventId } },
      update: { status },
      create: { userId, eventId, status },
    });
  }

  async deleteCalendarEvent(schoolId: string, eventId: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, schoolId },
    });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.calendarEvent.delete({ where: { id: eventId } });
  }
}
