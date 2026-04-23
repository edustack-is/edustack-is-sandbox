import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ParentService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns all children linked to this parent, across all schools.
   */
  async getChildren(parentUserId: string) {
    const links = await this.db.query(
      `SELECT ps.*, u.firstName, u.lastName, u.email, sp.id as profileId, sp.classroomId, c.name as cName 
       FROM "ParentStudent" ps 
       JOIN "User" u ON ps.studentId = u.id 
       LEFT JOIN "StudentProfile" sp ON u.id = sp.userId 
       LEFT JOIN "Classroom" c ON sp.classroomId = c.id 
       WHERE ps.parentId = ?`,
      [parentUserId],
    );

    return links.map((l: any) => ({
      linkId: l.id,
      studentId: l.studentId,
      student: {
        id: l.studentId,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        studentProfile: l.profileId
          ? {
              id: l.profileId,
              classroom: l.classroomId
                ? { id: l.classroomId, name: l.cName }
                : null,
            }
          : null,
      },
    }));
  }

  /**
   * Returns a child's dashboard data (grades, schedule, profile).
   */
  async getChildDashboard(parentUserId: string, studentUserId: string) {
    const link = await this.db.queryOne(
      'SELECT id FROM "ParentStudent" WHERE parentId = ? AND studentId = ?',
      [parentUserId, studentUserId],
    );
    if (!link)
      throw new ForbiddenException('You do not have access to this student.');

    const user = await this.db.queryOne('SELECT * FROM "User" WHERE id = ?', [
      studentUserId,
    ]);
    const profile = await this.db.queryOne(
      'SELECT * FROM "StudentProfile" WHERE userId = ?',
      [studentUserId],
    );
    if (!profile) throw new NotFoundException('Student profile not found');

    const classroom = (profile as any).classroomId
      ? await this.db.queryOne('SELECT * FROM "Classroom" WHERE id = ?', [
          (profile as any).classroomId,
        ])
      : null;

    const grades = await this.db.query(
      `SELECT g.*, st.name as subName, u.firstName as tFN, u.lastName as tLN 
       FROM "Grade" g 
       JOIN "SubjectInstance" si ON g.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "TeacherProfile" tp ON g.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       WHERE g.studentId = ? ORDER BY g.date DESC LIMIT 30`,
      [(profile as any).id],
    );

    const schedule = (profile as any).classroomId
      ? await this.db.query(
          `SELECT se.*, st.name as subName, u.firstName as tFN, u.lastName as tLN 
       FROM "ScheduleEvent" se 
       JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "TeacherProfile" tp ON se.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       WHERE se.classroomId = ? ORDER BY se.dayOfWeek ASC, se.startTime ASC`,
          [(profile as any).classroomId],
        )
      : [];

    return {
      profile: {
        ...profile,
        user,
        classroom,
        grades: grades.map((g: any) => ({
          ...g,
          subjectInstance: { template: { name: g.subName } },
          teacherProfile: { user: { firstName: g.tFN, lastName: g.tLN } },
        })),
      },
      schedule: (schedule as any[]).map((s) => ({
        ...s,
        subject: { template: { name: s.subName } },
        teacherProfile: { user: { firstName: s.tFN, lastName: s.tLN } },
      })),
      subjects: [], // Simplified for POC
    };
  }
}
