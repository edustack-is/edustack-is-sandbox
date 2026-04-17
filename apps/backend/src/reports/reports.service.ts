import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── GRADE STATISTICS ───────────────────────────────────

  async getGradeStatsByClassroom(
    schoolId: string,
    classroomId: string,
    semesterId?: string,
  ) {
    const where: any = { schoolId, studentProfile: { classroomId } };
    if (semesterId) where.semesterId = semesterId;

    const grades = await this.prisma.grade.findMany({
      where,
      include: {
        subjectInstance: { include: { template: { select: { name: true } } } },
        studentProfile: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Group by subject
    const bySubject: Record<string, { name: string; grades: number[] }> = {};
    for (const g of grades) {
      const subj = g.subjectInstance?.template?.name || 'Neznámý';
      if (!bySubject[subj]) bySubject[subj] = { name: subj, grades: [] };
      const num = parseFloat(g.value);
      if (!isNaN(num)) bySubject[subj].grades.push(num);
    }

    const subjectStats = Object.values(bySubject).map((s: any) => {
      const sorted = [...s.grades].sort((a: number, b: number) => a - b);
      const sum = sorted.reduce((a: number, b: number) => a + b, 0);
      const avg = sorted.length ? sum / sorted.length : 0;
      const median = sorted.length
        ? sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]
        : 0;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<
        number,
        number
      >;
      for (const v of sorted) {
        const rounded = Math.round(v);
        if (rounded >= 1 && rounded <= 5) distribution[rounded]++;
      }
      return {
        subject: s.name,
        count: sorted.length,
        average: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        distribution,
        passRate: sorted.length
          ? Math.round(
              (sorted.filter((v: number) => v <= 4).length / sorted.length) *
                100,
            )
          : 0,
      };
    });

    // Group by student
    const byStudent: Record<string, { name: string; grades: number[] }> = {};
    for (const g of grades) {
      const sid = g.studentProfile.id;
      if (!byStudent[sid])
        byStudent[sid] = {
          name: `${g.studentProfile.lastName} ${g.studentProfile.firstName}`,
          grades: [],
        };
      const num = parseFloat(g.value);
      if (!isNaN(num)) byStudent[sid].grades.push(num);
    }

    const studentStats = Object.values(byStudent)
      .map((s: any) => ({
        student: s.name,
        count: s.grades.length,
        average: s.grades.length
          ? Math.round(
              (s.grades.reduce((a: number, b: number) => a + b, 0) /
                s.grades.length) *
                100,
            ) / 100
          : 0,
      }))
      .sort((a: any, b: any) => a.average - b.average);

    const allGrades = grades
      .map((g: any) => parseFloat(g.value))
      .filter((v: number) => !isNaN(v));
    const overallAvg = allGrades.length
      ? Math.round(
          (allGrades.reduce((a: number, b: number) => a + b, 0) /
            allGrades.length) *
            100,
        ) / 100
      : 0;

    return {
      subjectStats,
      studentStats,
      overall: { totalGrades: allGrades.length, average: overallAvg },
    };
  }

  async getGradeStatsBySchool(schoolId: string, semesterId?: string) {
    const classrooms = await this.prisma.classroom.findMany({
      where: { schoolId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const classroomStats = await Promise.all(
      classrooms.map(async (c: any) => {
        const stats = await this.getGradeStatsByClassroom(
          schoolId,
          c.id,
          semesterId,
        );
        return { classroom: c.name, classroomId: c.id, ...stats.overall };
      }),
    );

    return { classrooms: classroomStats };
  }

  // ─── ATTENDANCE STATISTICS ──────────────────────────────

  async getAttendanceStats(
    schoolId: string,
    classroomId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const where: any = { schoolId };
    if (classroomId) where.studentProfile = { classroomId };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        studentProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            classroom: { select: { name: true } },
          },
        },
      },
    });

    const total = records.length;
    const byStatus: Record<string, number> = {};
    for (const r of records) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    // Per-student
    const byStudent: Record<
      string,
      {
        name: string;
        classroom: string;
        total: number;
        absent: number;
        late: number;
        excused: number;
      }
    > = {};
    for (const r of records) {
      const sid = r.studentProfile.id;
      if (!byStudent[sid]) {
        byStudent[sid] = {
          name: `${r.studentProfile.lastName} ${r.studentProfile.firstName}`,
          classroom: r.studentProfile.classroom?.name || '',
          total: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
      }
      byStudent[sid].total++;
      if (r.status === 'ABSENT') byStudent[sid].absent++;
      if (r.status === 'LATE') byStudent[sid].late++;
      if (r.status === 'EXCUSED') byStudent[sid].excused++;
    }

    const students = Object.values(byStudent)
      .map((s: any) => ({
        ...s,
        attendanceRate: s.total
          ? Math.round(((s.total - s.absent) / s.total) * 100)
          : 100,
      }))
      .sort((a: any, b: any) => a.attendanceRate - b.attendanceRate);

    return {
      summary: { total, byStatus },
      students,
      overallRate: total
        ? Math.round(((total - (byStatus['ABSENT'] || 0)) / total) * 100)
        : 100,
    };
  }

  // ─── ČŠI REPORT (Czech School Inspectorate) ────────────

  async generateCsiReport(schoolId: string, academicYearId?: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    const classrooms = await this.prisma.classroom.findMany({
      where: { schoolId },
      include: { _count: { select: { students: true } } },
      orderBy: { name: 'asc' },
    });

    const teacherCount = await this.prisma.teacherProfile.count({
      where: { user: { schoolMemberships: { some: { schoolId } } } },
    });

    const studentCount = await this.prisma.studentProfile.count({
      where: { classroom: { schoolId } },
    });

    const gradeWhere: any = { schoolId };
    if (academicYearId) gradeWhere.academicYearId = academicYearId;
    const grades = await this.prisma.grade.findMany({
      where: gradeWhere,
      select: { value: true },
    });

    const numGrades = grades
      .map((g: any) => parseFloat(g.value))
      .filter((v: number) => !isNaN(v));
    const avgGrade = numGrades.length
      ? Math.round(
          (numGrades.reduce((a: number, b: number) => a + b, 0) /
            numGrades.length) *
            100,
        ) / 100
      : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<
      number,
      number
    >;
    for (const v of numGrades) {
      const r = Math.round(v);
      if (r >= 1 && r <= 5) distribution[r]++;
    }

    const attendanceRecords = await this.prisma.attendance.count({
      where: { schoolId },
    });
    const absentRecords = await this.prisma.attendance.count({
      where: { schoolId, status: 'ABSENT' },
    });

    return {
      title: 'Výkaz pro Českou školní inspekci',
      school: { name: school?.name || '' },
      period: academicYearId || 'Aktuální rok',
      staffing: {
        teachers: teacherCount,
        students: studentCount,
        classrooms: classrooms.length,
      },
      classes: classrooms.map((c: any) => ({
        name: c.name,
        studentCount: c._count.students,
      })),
      grading: {
        totalGrades: numGrades.length,
        average: avgGrade,
        distribution,
        passRate: numGrades.length
          ? Math.round(
              (numGrades.filter((v: number) => v <= 4).length /
                numGrades.length) *
                100,
            )
          : 0,
      },
      attendance: {
        totalRecords: attendanceRecords,
        absentRecords,
        attendanceRate: attendanceRecords
          ? Math.round(
              ((attendanceRecords - absentRecords) / attendanceRecords) * 100,
            )
          : 100,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── MŠMT REPORT (Ministry of Education) ───────────────

  async generateMsmtReport(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const studentCount = await this.prisma.studentProfile.count({
      where: { classroom: { schoolId } },
    });

    const teacherCount = await this.prisma.teacherProfile.count({
      where: { user: { schoolMemberships: { some: { schoolId } } } },
    });

    const classrooms = await this.prisma.classroom.findMany({
      where: { schoolId },
      include: {
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Group by grade number
    const byGrade: Record<
      number,
      { level: number; name: string; classCount: number; studentCount: number }
    > = {};
    for (const c of classrooms) {
      const grade = c.grade;
      if (!byGrade[grade])
        byGrade[grade] = {
          level: grade,
          name: `${grade}. ročník`,
          classCount: 0,
          studentCount: 0,
        };
      byGrade[grade].classCount++;
      byGrade[grade].studentCount += c._count.students;
    }

    const subjectInstances = await this.prisma.subjectInstance.findMany({
      where: { schoolId },
      include: { template: { select: { name: true } } },
    });

    const subjects = [
      ...new Set(
        subjectInstances.map((s: any) => s.template?.name).filter(Boolean),
      ),
    ].sort();

    const rooms = await this.prisma.room.findMany({
      where: { schoolId },
      select: { name: true, capacity: true, isComputerLab: true },
    });

    return {
      title: 'Výkaz pro Ministerstvo školství, mládeže a tělovýchovy',
      school: {
        name: school?.name || '',
        izo: '', // IZO number — would come from school settings
        redizo: '', // RED IZO — would come from school settings
      },
      summary: {
        totalStudents: studentCount,
        totalTeachers: teacherCount,
        totalClassrooms: classrooms.length,
        totalSubjects: subjects.length,
      },
      gradeBreakdown: Object.values(byGrade).sort(
        (a: any, b: any) => a.level - b.level,
      ),
      subjects,
      facilities: {
        rooms: rooms.length,
        computerLabs: rooms.filter((r: any) => r.isComputerLab).length,
        totalCapacity: rooms.reduce(
          (sum: number, r: any) => sum + (r.capacity || 0),
          0,
        ),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── HTML REPORT RENDERER ───────────────────────────────

  renderReportHtml(report: any, type: 'csi' | 'msmt'): string {
    const title = report.title;
    const school = report.school;

    let body = '';

    if (type === 'csi') {
      body = `
<h2>Škola: ${school.name}</h2>
<p>Období: ${report.period}</p>
<h3>Personální zajištění</h3>
<table><tr><th>Učitelé</th><td>${report.staffing.teachers}</td></tr>
<tr><th>Žáci</th><td>${report.staffing.students}</td></tr>
<tr><th>Třídy</th><td>${report.staffing.classrooms}</td></tr></table>
<h3>Třídy</h3>
<table><tr><th>Třída</th><th>Počet žáků</th></tr>
${report.classes.map((c: any) => `<tr><td>${c.name}</td><td>${c.studentCount}</td></tr>`).join('')}
</table>
<h3>Klasifikace</h3>
<table><tr><th>Celkem známek</th><td>${report.grading.totalGrades}</td></tr>
<tr><th>Průměr</th><td>${report.grading.average}</td></tr>
<tr><th>Úspěšnost</th><td>${report.grading.passRate}%</td></tr></table>
<table><tr><th>Známka</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
<tr><td>Počet</td>${[1, 2, 3, 4, 5].map((n: number) => `<td>${report.grading.distribution[n]}</td>`).join('')}</tr></table>
<h3>Docházka</h3>
<table><tr><th>Celkem záznamů</th><td>${report.attendance.totalRecords}</td></tr>
<tr><th>Absence</th><td>${report.attendance.absentRecords}</td></tr>
<tr><th>Účast</th><td>${report.attendance.attendanceRate}%</td></tr></table>`;
    } else {
      body = `
<h2>Škola: ${school.name}</h2>
${school.izo ? `<p>IZO: ${school.izo} | RED IZO: ${school.redizo}</p>` : ''}
<h3>Souhrn</h3>
<table><tr><th>Žáci</th><td>${report.summary.totalStudents}</td></tr>
<tr><th>Učitelé</th><td>${report.summary.totalTeachers}</td></tr>
<tr><th>Třídy</th><td>${report.summary.totalClassrooms}</td></tr>
<tr><th>Předměty</th><td>${report.summary.totalSubjects}</td></tr></table>
<h3>Rozložení po ročnících</h3>
<table><tr><th>Ročník</th><th>Tříd</th><th>Žáků</th></tr>
${report.gradeBreakdown.map((g: any) => `<tr><td>${g.name}</td><td>${g.classCount}</td><td>${g.studentCount}</td></tr>`).join('')}
</table>
<h3>Vyučované předměty</h3>
<p>${report.subjects.join(', ')}</p>
<h3>Zázemí</h3>
<table><tr><th>Místností</th><td>${report.facilities.rooms}</td></tr>
<tr><th>Celková kapacita</th><td>${report.facilities.totalCapacity}</td></tr></table>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Arial,sans-serif;margin:40px;font-size:13px}
h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:8px}
h2{font-size:15px;color:#444}h3{font-size:13px;margin-top:20px;border-bottom:1px solid #ccc}
table{border-collapse:collapse;margin:10px 0;width:100%}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
th{background:#f5f5f5;font-weight:600}
p{margin:5px 0}
@media print{body{margin:20px}}</style></head>
<body><h1>${title}</h1>${body}
<p style="margin-top:30px;color:#999;font-size:11px">Vygenerováno: ${report.generatedAt}</p>
</body></html>`;
  }
}
