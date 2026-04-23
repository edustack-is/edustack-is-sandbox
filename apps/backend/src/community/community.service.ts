import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  BulletinPost,
  Poll,
  PollOption,
  PollVote,
  CalendarEvent,
  EventRsvp,
} from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class CommunityService {
  constructor(private readonly db: DatabaseService) {}

  // ─── BULLETIN BOARD ─────────────────────────────────────

  async createBulletinPost(
    userId: string,
    schoolId: string,
    data: { title: string; content: string; pinned?: boolean },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "BulletinPost" (id, title, content, pinned, authorId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.title,
        data.content,
        data.pinned ? 1 : 0,
        userId,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    return await this.db.queryOne(
      'SELECT b.*, u.firstName, u.lastName FROM "BulletinPost" b JOIN "User" u ON b.authorId = u.id WHERE b.id = ?',
      [id],
    );
  }

  async getBulletinPosts(schoolId: string) {
    return this.db.query(
      `SELECT b.*, u.firstName, u.lastName FROM "BulletinPost" b 
       JOIN "User" u ON b.authorId = u.id 
       WHERE b.schoolId = ? ORDER BY b.pinned DESC, b.createdAt DESC`,
      [schoolId],
    );
  }

  async updateBulletinPost(
    userId: string,
    schoolId: string,
    postId: string,
    data: any,
  ) {
    const post = await this.db.queryOne(
      'SELECT * FROM "BulletinPost" WHERE id = ? AND schoolId = ?',
      [postId, schoolId],
    );
    if (!post) throw new NotFoundException('Post not found');

    const fields = ['updatedAt = ?'];
    const values = [new Date().toISOString()];
    ['title', 'content', 'pinned'].forEach((k) => {
      if (data[k] !== undefined) {
        fields.push(`"${k}" = ?`);
        values.push(k === 'pinned' ? (data[k] ? 1 : 0) : data[k]);
      }
    });

    await this.db.execute(
      `UPDATE "BulletinPost" SET ${fields.join(', ')} WHERE id = ?`,
      [...values, postId],
    );
    return await this.db.queryOne(
      'SELECT b.*, u.firstName, u.lastName FROM "BulletinPost" b JOIN "User" u ON b.authorId = u.id WHERE b.id = ?',
      [postId],
    );
  }

  async deleteBulletinPost(schoolId: string, postId: string) {
    const post = await this.db.queryOne(
      'SELECT id FROM "BulletinPost" WHERE id = ? AND schoolId = ?',
      [postId, schoolId],
    );
    if (!post) throw new NotFoundException('Post not found');
    await this.db.execute('DELETE FROM "BulletinPost" WHERE id = ?', [postId]);
    return { success: true };
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

    return this.db.transaction(async (db) => {
      const pollId = crypto.randomUUID();
      await db.execute(
        'INSERT INTO "Poll" (id, question, multiSelect, endsAt, authorId, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          pollId,
          data.question,
          data.multiSelect ? 1 : 0,
          data.endsAt ? new Date(data.endsAt).toISOString() : null,
          userId,
          schoolId,
          new Date().toISOString(),
        ],
      );

      for (const opt of data.options) {
        await db.execute(
          'INSERT INTO "PollOption" (id, text, pollId) VALUES (?, ?, ?)',
          [crypto.randomUUID(), opt, pollId],
        );
      }

      return await this.getPollWithDetails(pollId);
    });
  }

  private async getPollWithDetails(id: string) {
    const poll = await this.db.queryOne(
      'SELECT p.*, u.firstName, u.lastName FROM "Poll" p JOIN "User" u ON p.authorId = u.id WHERE p.id = ?',
      [id],
    );
    if (!poll) return null;
    const options = await this.db.query(
      'SELECT o.*, (SELECT COUNT(*) FROM "PollVote" WHERE optionId = o.id) as voteCount FROM "PollOption" o WHERE o.pollId = ?',
      [id],
    );
    return {
      ...poll,
      author: {
        firstName: (poll as any).firstName,
        lastName: (poll as any).lastName,
      },
      options: options.map((o: any) => ({
        ...o,
        _count: { votes: o.voteCount },
      })),
    };
  }

  async getPolls(schoolId: string) {
    const polls = await this.db.query(
      'SELECT id FROM "Poll" WHERE schoolId = ? ORDER BY createdAt DESC',
      [schoolId],
    );
    const result = [];
    for (const p of polls as any[]) {
      result.push(await this.getPollWithDetails(p.id));
    }
    return result;
  }

  async vote(userId: string, optionId: string) {
    const option = await this.db.queryOne(
      'SELECT o.*, p.multiSelect, p.endsAt FROM "PollOption" o JOIN "Poll" p ON o.pollId = p.id WHERE o.id = ?',
      [optionId],
    );
    if (!option) throw new NotFoundException('Option not found');
    const row = option as any;
    if (row.endsAt && new Date() > new Date(row.endsAt))
      throw new BadRequestException('Anketa již skončila');

    return this.db.transaction(async (db) => {
      if (!row.multiSelect) {
        await db.execute(
          'DELETE FROM "PollVote" WHERE userId = ? AND optionId IN (SELECT id FROM "PollOption" WHERE pollId = ?)',
          [userId, row.pollId],
        );
      }

      const existing = await db.queryOne(
        'SELECT id FROM "PollVote" WHERE userId = ? AND optionId = ?',
        [userId, optionId],
      );
      if (!existing) {
        await db.execute(
          'INSERT INTO "PollVote" (id, userId, optionId, createdAt) VALUES (?, ?, ?, ?)',
          [crypto.randomUUID(), userId, optionId, new Date().toISOString()],
        );
      }
      return { success: true };
    });
  }

  async deletePoll(schoolId: string, pollId: string) {
    const poll = await this.db.queryOne(
      'SELECT id FROM "Poll" WHERE id = ? AND schoolId = ?',
      [pollId, schoolId],
    );
    if (!poll) throw new NotFoundException('Poll not found');
    await this.db.transaction(async (db) => {
      await db.execute(
        'DELETE FROM "PollVote" WHERE optionId IN (SELECT id FROM "PollOption" WHERE pollId = ?)',
        [pollId],
      );
      await db.execute('DELETE FROM "PollOption" WHERE pollId = ?', [pollId]);
      await db.execute('DELETE FROM "Poll" WHERE id = ?', [pollId]);
    });
    return { success: true };
  }

  // ─── CALENDAR EVENTS ────────────────────────────────────

  async createCalendarEvent(userId: string, schoolId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "CalendarEvent" (id, title, description, startDate, endDate, location, authorId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.title,
        data.description || null,
        new Date(data.startDate).toISOString(),
        data.endDate ? new Date(data.endDate).toISOString() : null,
        data.location || null,
        userId,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    return await this.getCalendarEventWithDetails(id);
  }

  private async getCalendarEventWithDetails(id: string) {
    const ev = await this.db.queryOne(
      'SELECT e.*, u.firstName, u.lastName, (SELECT COUNT(*) FROM "EventRsvp" WHERE eventId = e.id) as rsvpCount FROM "CalendarEvent" e JOIN "User" u ON e.authorId = u.id WHERE e.id = ?',
      [id],
    );
    if (!ev) return null;
    const rsvps = await this.db.query(
      'SELECT r.*, u.firstName, u.lastName FROM "EventRsvp" r JOIN "User" u ON r.userId = u.id WHERE r.eventId = ?',
      [id],
    );
    return {
      ...ev,
      author: {
        firstName: (ev as any).firstName,
        lastName: (ev as any).lastName,
      },
      rsvps: rsvps.map((r: any) => ({
        ...r,
        user: { firstName: r.firstName, lastName: r.lastName },
      })),
      _count: { rsvps: (ev as any).rsvpCount },
    };
  }

  async getCalendarEvents(schoolId: string) {
    const events = await this.db.query(
      'SELECT id FROM "CalendarEvent" WHERE schoolId = ? ORDER BY startDate ASC',
      [schoolId],
    );
    const result = [];
    for (const e of events as any[]) {
      result.push(await this.getCalendarEventWithDetails(e.id));
    }
    return result;
  }

  async rsvpEvent(userId: string, eventId: string, status: string) {
    const existing = await this.db.queryOne(
      'SELECT id FROM "EventRsvp" WHERE userId = ? AND eventId = ?',
      [userId, eventId],
    );
    if (existing) {
      await this.db.execute('UPDATE "EventRsvp" SET status = ? WHERE id = ?', [
        status,
        (existing as any).id,
      ]);
    } else {
      await this.db.execute(
        'INSERT INTO "EventRsvp" (id, userId, eventId, status, createdAt) VALUES (?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          userId,
          eventId,
          status,
          new Date().toISOString(),
        ],
      );
    }
    return { success: true };
  }

  async deleteCalendarEvent(schoolId: string, eventId: string) {
    const ev = await this.db.queryOne(
      'SELECT id FROM "CalendarEvent" WHERE id = ? AND schoolId = ?',
      [eventId, schoolId],
    );
    if (!ev) throw new NotFoundException('Event not found');
    await this.db.transaction(async (db) => {
      await db.execute('DELETE FROM "EventRsvp" WHERE eventId = ?', [eventId]);
      await db.execute('DELETE FROM "CalendarEvent" WHERE id = ?', [eventId]);
    });
    return { success: true };
  }
}
