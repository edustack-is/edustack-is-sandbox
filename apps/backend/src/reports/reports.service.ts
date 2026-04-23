import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  // ─── GRADE STATISTICS ───────────────────────────────────

  async getGradeStatsByClassroom(
    schoolId: string,
    classroomId: string,
    semesterId?: string,
  ) {
    let sql = `SELECT g.value, st.name as subName, sp.id as sId, sp.firstName, sp.lastName 
               FROM "Grade" g 
               JOIN "StudentProfile" sp ON g.studentId = sp.id 
               JOIN "SubjectInstance" si ON g.subjectInstanceId = si.id 
               JOIN "SubjectTemplate" st ON si.templateId = st.id 
               WHERE g.schoolId = ? AND sp.classroomId = ?`;
    const params: any[] = [schoolId, classroomId];
    if (semesterId) {
      sql += ' AND g.semesterId = ?';
      params.push(semesterId);
    }

    const grades = await this.db.query(sql, params);

    const bySubject: Record<string, number[]> = {};
    const byStudent: Record<string, { name: string; grades: number[] }> = {};

    for (const g of grades as any[]) {
      const val = parseFloat(g.value);
      if (isNaN(val)) continue;

      if (!bySubject[g.subName]) bySubject[g.subName] = [];
      bySubject[g.subName].push(val);

      if (!byStudent[g.sId])
        byStudent[g.sId] = { name: `${g.lastName} ${g.firstName}`, grades: [] };
      byStudent[g.sId].grades.push(val);
    }

    const subjectStats = Object.entries(bySubject).map(([name, vals]) => {
      const sorted = [...vals].sort((a, b) => a - b);
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      return {
        subject: name,
        count: sorted.length,
        average: Math.round(avg * 100) / 100,
      };
    });

    const studentStats = Object.values(byStudent)
      .map((s: any) => ({
        student: s.name,
        average: s.grades.length
          ? Math.round(
              (s.grades.reduce((a: number, b: number) => a + b, 0) /
                s.grades.length) *
                100,
            ) / 100
          : 0,
      }))
      .sort((a, b) => a.average - b.average);

    return {
      subjectStats,
      studentStats,
      overall: { totalGrades: (grades as any[]).length },
    };
  }

  async getGradeStatsBySchool(schoolId: string, semesterId?: string) {
    const classrooms = await this.db.query(
      'SELECT id, name FROM "Classroom" WHERE schoolId = ? ORDER BY name ASC',
      [schoolId],
    );
    const result = [];
    for (const c of classrooms as any[]) {
      const stats = await this.getGradeStatsByClassroom(
        schoolId,
        c.id,
        semesterId,
      );
      result.push({ classroom: c.name, classroomId: c.id, ...stats.overall });
    }
    return { classrooms: result };
  }

  // ─── ATTENDANCE STATISTICS ──────────────────────────────

  async getAttendanceStats(
    schoolId: string,
    classroomId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    let sql = `SELECT a.status, sp.id as sId, sp.firstName, sp.lastName, c.name as cName 
               FROM "Attendance" a 
               JOIN "StudentProfile" sp ON a.studentId = sp.id 
               LEFT JOIN "Classroom" c ON sp.classroomId = c.id 
               WHERE a.schoolId = ?`;
    const params: any[] = [schoolId];
    if (classroomId) {
      sql += ' AND sp.classroomId = ?';
      params.push(classroomId);
    }
    if (dateFrom) {
      sql += ' AND a.date >= ?';
      params.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      sql += ' AND a.date <= ?';
      params.push(new Date(dateTo).toISOString());
    }

    const records = await this.db.query(sql, params);
    const byStatus: any = {};
    const byStudent: any = {};

    for (const r of records as any[]) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (!byStudent[r.sId])
        byStudent[r.sId] = {
          name: `${r.lastName} ${r.firstName}`,
          classroom: r.cName || '',
          total: 0,
          absent: 0,
        };
      byStudent[r.sId].total++;
      if (r.status === 'ABSENT') byStudent[r.sId].absent++;
    }

    return {
      summary: { total: (records as any[]).length, byStatus },
      students: Object.values(byStudent).map((s: any) => ({
        ...s,
        attendanceRate: s.total
          ? Math.round(((s.total - s.absent) / s.total) * 100)
          : 100,
      })),
    };
  }

  // ─── CSI REPORT ─────────────────────────────────────────

  async generateCsiReport(schoolId: string, academicYearId?: string) {
    const school = await this.db.queryOne(
      'SELECT name FROM "School" WHERE id = ?',
      [schoolId],
    );
    const classrooms = await this.db.query(
      'SELECT c.*, (SELECT COUNT(*) FROM "StudentProfile" WHERE classroomId = c.id) as sCount FROM "Classroom" c WHERE c.schoolId = ?',
      [schoolId],
    );
    const teacherCount = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM "SchoolMembership" WHERE schoolId = ? AND role = "TEACHER"',
      [schoolId],
    );

    return {
      title: 'Výkaz pro Českou školní inspekci',
      school,
      staffing: {
        teachers: teacherCount?.count || 0,
        classrooms: (classrooms as any[]).length,
      },
      classes: (classrooms as any[]).map((c) => ({
        name: c.name,
        studentCount: c.sCount,
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
