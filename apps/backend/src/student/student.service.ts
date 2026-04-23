import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  StudentProfile,
  User,
  Classroom,
  Grade,
  SubjectInstance,
  SubjectTemplate,
} from '../database/types';

@Injectable()
export class StudentService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns the student's profile including their classroom and subjects.
   * Strictly uses userId from JWT — never trusts ID from URL.
   */
  async getMyData(userId: string, schoolId: string) {
    const studentProfile = await this.db.queryOne<StudentProfile>(
      'SELECT * FROM StudentProfile WHERE userId = ?',
      [userId],
    );

    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    const user = await this.db.queryOne<Partial<User>>(
      'SELECT id, email, firstName, lastName FROM User WHERE id = ?',
      [studentProfile.userId],
    );

    const classroom = studentProfile.classroomId
      ? await this.db.queryOne<Classroom>(
          'SELECT * FROM Classroom WHERE id = ?',
          [studentProfile.classroomId],
        )
      : null;

    const grades = await this.db.query<any>(
      `SELECT g.*, si.id as si_id, st.id as st_id, st.name as st_name
       FROM Grade g
       JOIN SubjectInstance si ON g.subjectInstanceId = si.id
       JOIN SubjectTemplate st ON si.templateId = st.id
       WHERE g.studentId = ?
       ORDER BY g.date DESC LIMIT 20`,
      [studentProfile.id],
    );

    // Map grades to match original structure
    const formattedGrades = grades.map((g) => ({
      ...g,
      subjectInstance: {
        id: g.si_id,
        template: {
          id: g.st_id,
          name: g.st_name,
        },
      },
    }));

    // Get subjects the student has via their classroom schedule
    const subjects = studentProfile.classroomId
      ? await this.db.query<any>(
          `SELECT DISTINCT si.*, st.name as st_name
           FROM SubjectInstance si
           JOIN SubjectTemplate st ON si.templateId = st.id
           JOIN ScheduleEvent se ON se.subjectInstanceId = si.id
           WHERE si.schoolId = ? AND se.classroomId = ?`,
          [schoolId, studentProfile.classroomId],
        )
      : [];

    const formattedSubjects = subjects.map((s) => ({
      ...s,
      template: {
        name: s.st_name,
      },
    }));

    return {
      profile: {
        ...studentProfile,
        user,
        classroom,
        grades: formattedGrades,
      },
      subjects: formattedSubjects,
    };
  }

  /**
   * Returns schedule events for the student's classroom.
   */
  async getSchedule(userId: string, schoolId: string) {
    const studentProfile = await this.db.queryOne<StudentProfile>(
      'SELECT classroomId FROM StudentProfile WHERE userId = ?',
      [userId],
    );

    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    if (!studentProfile.classroomId) {
      return []; // Student not assigned to a classroom yet
    }

    const events = await this.db.query<any>(
      `SELECT se.*,
              si.id as si_id,
              st.name as st_name,
              u.firstName, u.lastName,
              c.name as c_name
       FROM ScheduleEvent se
       JOIN SubjectInstance si ON se.subjectInstanceId = si.id
       JOIN SubjectTemplate st ON si.templateId = st.id
       JOIN TeacherProfile tp ON se.teacherId = tp.id
       JOIN User u ON tp.userId = u.id
       JOIN Classroom c ON se.classroomId = c.id
       WHERE se.schoolId = ? AND se.classroomId = ?
       ORDER BY se.dayOfWeek ASC, se.startTime ASC`,
      [schoolId, studentProfile.classroomId],
    );

    return events.map((e) => ({
      ...e,
      subject: {
        id: e.si_id,
        template: { name: e.st_name },
      },
      teacherProfile: {
        user: { firstName: e.firstName, lastName: e.lastName },
      },
      classroom: {
        id: e.classroomId,
        name: e.c_name,
      },
    }));
  }
}
