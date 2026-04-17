import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassBookService {
  constructor(private prisma: PrismaService) {}

  // ─── GET ENTRIES FOR A DATE ─────────────────────────────

  /**
   * Returns class book entries for a classroom on a given date.
   * Pre-fills from schedule if entries don't exist yet.
   */
  async getEntriesForDate(schoolId: string, classroomId: string, date: string) {
    const d = new Date(date);
    const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon...7=Sun

    // Get schedule events for this day
    const scheduleEvents = await this.prisma.scheduleEvent.findMany({
      where: { schoolId, classroomId, dayOfWeek },
      include: {
        subject: { include: { template: true } },
        teacherProfile: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { lessonNumber: 'asc' },
    });

    // Get existing entries
    const existing = await this.prisma.classBookEntry.findMany({
      where: {
        schoolId,
        classroomId,
        date: {
          gte: new Date(d.toISOString().slice(0, 10) + 'T00:00:00Z'),
          lt: new Date(d.toISOString().slice(0, 10) + 'T23:59:59Z'),
        },
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        signature: true,
      },
      orderBy: { lessonNumber: 'asc' },
    });

    const existingMap = new Map(existing.map((e) => [e.lessonNumber, e]));

    // Merge: for each schedule event, return existing entry or a "template"
    return scheduleEvents.map((se) => {
      const entry = existingMap.get(se.lessonNumber);
      if (entry) {
        return {
          ...entry,
          subjectName: entry.subjectName || se.subject?.template?.name,
          fromSchedule: true,
        };
      }
      return {
        id: null,
        date: d.toISOString(),
        lessonNumber: se.lessonNumber,
        topic: null,
        notes: null,
        absentCount: null,
        schoolId,
        classroomId,
        teacherId: se.teacherProfile?.user?.id,
        teacher: se.teacherProfile?.user,
        scheduleEventId: se.id,
        subjectName: se.subject?.template?.name,
        signature: null,
        fromSchedule: true,
      };
    });
  }

  // ─── UPSERT ENTRY ───────────────────────────────────────

  async upsertEntry(
    userId: string,
    schoolId: string,
    data: {
      classroomId: string;
      date: string;
      lessonNumber: number;
      topic?: string;
      notes?: string;
      absentCount?: number;
      scheduleEventId?: string;
      subjectName?: string;
    },
  ) {
    const d = new Date(data.date);
    return this.prisma.classBookEntry.upsert({
      where: {
        schoolId_classroomId_date_lessonNumber: {
          schoolId,
          classroomId: data.classroomId,
          date: d,
          lessonNumber: data.lessonNumber,
        },
      },
      update: {
        topic: data.topic,
        notes: data.notes,
        absentCount: data.absentCount,
      },
      create: {
        date: d,
        lessonNumber: data.lessonNumber,
        topic: data.topic,
        notes: data.notes,
        absentCount: data.absentCount,
        schoolId,
        classroomId: data.classroomId,
        teacherId: userId,
        scheduleEventId: data.scheduleEventId,
        subjectName: data.subjectName,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        signature: true,
      },
    });
  }

  // ─── SIGN ENTRY ─────────────────────────────────────────

  async signEntry(userId: string, entryId: string, ipAddress?: string) {
    const entry = await this.prisma.classBookEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) throw new NotFoundException('Záznam nenalezen');
    if (entry.teacherId !== userId)
      throw new ForbiddenException('Můžete podepsat pouze své záznamy');

    return this.prisma.teacherSignature.upsert({
      where: { classBookEntryId: entryId },
      update: { signedAt: new Date(), ipAddress },
      create: {
        classBookEntryId: entryId,
        teacherId: userId,
        ipAddress,
      },
    });
  }

  // ─── GET ENTRIES FOR RANGE (for print) ──────────────────

  async getEntriesForRange(
    schoolId: string,
    classroomId: string,
    dateFrom: string,
    dateTo: string,
  ) {
    return this.prisma.classBookEntry.findMany({
      where: {
        schoolId,
        classroomId,
        date: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      },
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        signature: true,
      },
      orderBy: [{ date: 'asc' }, { lessonNumber: 'asc' }],
    });
  }

  // ─── PRINT (HTML export) ────────────────────────────────

  async generatePrintHtml(
    schoolId: string,
    classroomId: string,
    dateFrom: string,
    dateTo: string,
  ) {
    const entries = await this.getEntriesForRange(
      schoolId,
      classroomId,
      dateFrom,
      dateTo,
    );

    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { name: true, grade: true },
    });

    // Group by date
    const byDate = new Map<string, typeof entries>();
    for (const e of entries) {
      const key = e.date.toISOString().slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(e);
    }

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Třídní kniha – ${classroom?.name || ''}</title>
<style>
body{font-family:Arial,sans-serif;margin:20px}
h1{font-size:18px}h2{font-size:14px;margin-top:20px;border-bottom:1px solid #ccc}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
th,td{border:1px solid #999;padding:4px 8px;text-align:left}
th{background:#f0f0f0}
.sig{color:green;font-size:10px}
@media print{body{margin:0}}
</style></head><body>
<h1>Třídní kniha – ${classroom?.name || ''} (${classroom?.grade || ''})</h1>
<p>Období: ${dateFrom} – ${dateTo}</p>`;

    for (const [dateKey, dayEntries] of byDate) {
      const d = new Date(dateKey);
      const dayLabel = d.toLocaleDateString('cs-CZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      html += `<h2>${dayLabel}</h2><table>
<tr><th>Hod.</th><th>Předmět</th><th>Učitel</th><th>Probírané učivo</th><th>Poznámky</th><th>Nepřítomnos</th><th>Podpis</th></tr>`;
      for (const e of dayEntries) {
        const teacherName = e.teacher
          ? `${e.teacher.lastName} ${e.teacher.firstName}`
          : '-';
        const sig = e.signature
          ? `<span class="sig">✓ ${e.signature.signedAt.toISOString().slice(0, 16)}</span>`
          : '-';
        html += `<tr>
<td>${e.lessonNumber}</td>
<td>${e.subjectName || '-'}</td>
<td>${teacherName}</td>
<td>${e.topic || ''}</td>
<td>${e.notes || ''}</td>
<td>${e.absentCount ?? ''}</td>
<td>${sig}</td>
</tr>`;
      }
      html += '</table>';
    }

    html += '</body></html>';
    return html;
  }

  // ─── GET ATTENDANCE LINK ────────────────────────────────

  async getAttendanceForLesson(
    schoolId: string,
    classroomId: string,
    date: string,
    lessonNumber: number,
  ) {
    const d = new Date(date);
    return this.prisma.attendance.findMany({
      where: {
        schoolId,
        studentProfile: { classroomId },
        date: {
          gte: new Date(d.toISOString().slice(0, 10) + 'T00:00:00Z'),
          lt: new Date(d.toISOString().slice(0, 10) + 'T23:59:59Z'),
        },
        lessonNumber,
      },
      include: {
        studentProfile: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { studentProfile: { user: { lastName: 'asc' } } },
    });
  }
}
