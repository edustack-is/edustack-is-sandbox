import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class DeputyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ─── SCHOOL DASHBOARD ────────────────────────────────────────────

  async getSchoolDashboard(schoolId: string) {
    const [
      studentCount,
      teacherCount,
      classroomCount,
      subjectCount,
      roomCount,
      buildingCount,
      currentAcademicYear,
      recentMembers,
      upcomingEvents,
    ] = await Promise.all([
      this.prisma.schoolMembership.count({
        where: { schoolId, role: 'STUDENT', status: UserStatus.ACTIVE },
      }),
      this.prisma.schoolMembership.count({
        where: { schoolId, role: 'TEACHER', status: UserStatus.ACTIVE },
      }),
      this.prisma.classroom.count({ where: { schoolId } }),
      this.prisma.subjectTemplate.count({ where: { schoolId } }),
      this.prisma.room.count({ where: { schoolId } }),
      this.prisma.building.count({ where: { schoolId } }),
      this.prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true, name: true, startDate: true, endDate: true },
      }),
      this.prisma.schoolMembership.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.schoolEvent.findMany({
        where: { schoolId, date: { gte: new Date() } },
        orderBy: { date: 'asc' },
        take: 5,
      }),
    ]);

    // Count all members (not just active)
    const totalMembers = await this.prisma.schoolMembership.count({
      where: { schoolId },
    });
    const pendingMembers = await this.prisma.schoolMembership.count({
      where: { schoolId, status: UserStatus.PENDING },
    });

    return {
      studentCount,
      teacherCount,
      classroomCount,
      subjectCount,
      roomCount,
      buildingCount,
      totalMembers,
      pendingMembers,
      currentAcademicYear,
      upcomingEvents,
      recentMembers: recentMembers.map((m: any) => ({
        id: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt,
      })),
    };
  }

  // ─── CLASSROOM CRUD ──────────────────────────────────────────────

  async getClassrooms(schoolId: string) {
    return this.prisma.classroom.findMany({
      where: { schoolId },
      include: {
        students: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        homeroomTeacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
    });
  }

  async createClassroom(
    actorId: string,
    schoolId: string,
    data: { name: string; grade: number },
  ) {
    const classroom = await this.prisma.classroom.create({
      data: { name: data.name, grade: data.grade, schoolId },
    });

    await this.audit(
      actorId,
      'CREATE_CLASSROOM',
      'Classroom',
      classroom.id,
      data,
    );
    return classroom;
  }

  async updateClassroom(
    actorId: string,
    schoolId: string,
    id: string,
    data: { name?: string; grade?: number },
  ) {
    const existing = await this.prisma.classroom.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Classroom not found');

    const updated = await this.prisma.classroom.update({
      where: { id },
      data,
    });

    await this.audit(
      actorId,
      'UPDATE_CLASSROOM',
      'Classroom',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteClassroom(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.classroom.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Classroom not found');

    await this.prisma.classroom.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_CLASSROOM',
      'Classroom',
      id,
      null,
      existing,
    );
    return { deleted: true };
  }

  // ─── SUBJECT CRUD ────────────────────────────────────────────────

  async getSubjects(schoolId: string) {
    return this.prisma.subjectTemplate.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  async createSubject(
    actorId: string,
    schoolId: string,
    data: { name: string; code: string; svpDescription?: string },
  ) {
    const subject = await this.prisma.subjectTemplate.create({
      data: {
        name: data.name,
        code: data.code,
        svpDescription: data.svpDescription,
        schoolId,
      },
    });

    await this.audit(
      actorId,
      'CREATE_SUBJECT',
      'SubjectTemplate',
      subject.id,
      data,
    );
    return subject;
  }

  async updateSubject(
    actorId: string,
    schoolId: string,
    id: string,
    data: { name?: string; code?: string; svpDescription?: string },
  ) {
    const existing = await this.prisma.subjectTemplate.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Subject template not found');

    const updated = await this.prisma.subjectTemplate.update({
      where: { id },
      data,
    });
    await this.audit(
      actorId,
      'UPDATE_SUBJECT',
      'SubjectTemplate',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteSubject(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.subjectTemplate.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Subject template not found');

    await this.prisma.subjectTemplate.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_SUBJECT',
      'SubjectTemplate',
      id,
      null,
      existing,
    );
    return { deleted: true };
  }

  // ─── ROOM CRUD ───────────────────────────────────────────────────

  async getRooms(schoolId: string) {
    return this.prisma.room.findMany({
      where: { schoolId },
      include: { building: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createRoom(
    actorId: string,
    schoolId: string,
    data: {
      name: string;
      capacity?: number;
      isComputerLab?: boolean;
      specialEquipment?: string[];
      buildingId?: string;
      floor?: number;
    },
  ) {
    const room = await this.prisma.room.create({
      data: {
        name: data.name,
        capacity: data.capacity ?? 30,
        isComputerLab: data.isComputerLab ?? false,
        specialEquipment: data.specialEquipment ?? [],
        buildingId: data.buildingId || null,
        floor: data.floor ?? null,
        schoolId,
      },
    });

    await this.audit(actorId, 'CREATE_ROOM', 'Room', room.id, data);
    return room;
  }

  async updateRoom(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      name?: string;
      capacity?: number;
      isComputerLab?: boolean;
      specialEquipment?: string[];
      buildingId?: string | null;
      floor?: number | null;
    },
  ) {
    const existing = await this.prisma.room.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Room not found');

    const updated = await this.prisma.room.update({ where: { id }, data });
    await this.audit(actorId, 'UPDATE_ROOM', 'Room', id, data, existing);
    return updated;
  }

  async deleteRoom(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.room.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Room not found');

    await this.prisma.room.delete({ where: { id } });
    await this.audit(actorId, 'DELETE_ROOM', 'Room', id, null, existing);
    return { deleted: true };
  }

  // ─── BUILDING CRUD ───────────────────────────────────────────────

  async getBuildings(schoolId: string) {
    return this.prisma.building.findMany({
      where: { schoolId },
      include: { rooms: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createBuilding(
    actorId: string,
    schoolId: string,
    data: { name: string; address?: string; floors?: number },
  ) {
    const building = await this.prisma.building.create({
      data: {
        name: data.name,
        address: data.address,
        floors: data.floors ?? 1,
        schoolId,
      },
    });
    await this.audit(actorId, 'CREATE_BUILDING', 'Building', building.id, data);
    return building;
  }

  async updateBuilding(
    actorId: string,
    schoolId: string,
    id: string,
    data: { name?: string; address?: string; floors?: number },
  ) {
    const existing = await this.prisma.building.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Building not found');
    const updated = await this.prisma.building.update({ where: { id }, data });
    await this.audit(
      actorId,
      'UPDATE_BUILDING',
      'Building',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteBuilding(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.building.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Building not found');
    await this.prisma.building.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_BUILDING',
      'Building',
      id,
      null,
      existing,
    );
    return { deleted: true };
  }

  // ─── ROOM SHARING ────────────────────────────────────────────────

  async shareRoom(
    actorId: string,
    schoolId: string,
    roomId: string,
    targetSchoolId: string,
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, schoolId },
    });
    if (!room) throw new NotFoundException('Room not found in your school');
    if (schoolId === targetSchoolId)
      throw new BadRequestException('Cannot share room with the same school');

    const sharing = await this.prisma.roomSharing.create({
      data: { roomId, sharedWithSchoolId: targetSchoolId },
    });
    await this.audit(actorId, 'SHARE_ROOM', 'RoomSharing', sharing.id, {
      roomId,
      targetSchoolId,
    });
    return sharing;
  }

  async unshareRoom(
    actorId: string,
    schoolId: string,
    roomId: string,
    targetSchoolId: string,
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, schoolId },
    });
    if (!room) throw new NotFoundException('Room not found in your school');

    const sharing = await this.prisma.roomSharing.findUnique({
      where: {
        roomId_sharedWithSchoolId: {
          roomId,
          sharedWithSchoolId: targetSchoolId,
        },
      },
    });
    if (!sharing) throw new NotFoundException('Sharing not found');

    await this.prisma.roomSharing.delete({ where: { id: sharing.id } });
    await this.audit(actorId, 'UNSHARE_ROOM', 'RoomSharing', sharing.id, {
      roomId,
      targetSchoolId,
    });
    return { deleted: true };
  }

  async getSharedRooms(schoolId: string) {
    // Rooms shared TO this school by other schools
    const sharings = await this.prisma.roomSharing.findMany({
      where: { sharedWithSchoolId: schoolId },
      include: {
        room: {
          include: {
            school: { select: { id: true, name: true } },
            building: { select: { id: true, name: true } },
          },
        },
      },
    });
    return sharings.map((s) => ({
      id: s.id,
      room: s.room,
      ownerSchool: s.room.school,
    }));
  }

  async getRoomSharingsForRoom(roomId: string) {
    return this.prisma.roomSharing.findMany({
      where: { roomId },
      include: {
        room: { include: { school: { select: { id: true, name: true } } } },
      },
    });
  }

  // ─── SCHOOL EVENT CRUD ───────────────────────────────────────────

  async getEvents(schoolId: string) {
    return this.prisma.schoolEvent.findMany({
      where: { schoolId },
      orderBy: { date: 'asc' },
    });
  }

  async getUpcomingEvents(schoolId: string, limit = 10) {
    return this.prisma.schoolEvent.findMany({
      where: { schoolId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: limit,
    });
  }

  async createEvent(
    actorId: string,
    schoolId: string,
    data: {
      title: string;
      description?: string;
      date: string;
      endDate?: string;
      type?: string;
      allDay?: boolean;
    },
  ) {
    const event = await this.prisma.schoolEvent.create({
      data: {
        title: data.title,
        description: data.description,
        date: new Date(data.date),
        endDate: data.endDate ? new Date(data.endDate) : null,
        type: data.type ?? 'OTHER',
        allDay: data.allDay ?? true,
        schoolId,
      },
    });
    await this.audit(actorId, 'CREATE_EVENT', 'SchoolEvent', event.id, data);
    return event;
  }

  async updateEvent(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      date?: string;
      endDate?: string;
      type?: string;
      allDay?: boolean;
    },
  ) {
    const existing = await this.prisma.schoolEvent.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Event not found');

    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    const updated = await this.prisma.schoolEvent.update({
      where: { id },
      data: updateData,
    });
    await this.audit(
      actorId,
      'UPDATE_EVENT',
      'SchoolEvent',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteEvent(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.schoolEvent.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Event not found');
    await this.prisma.schoolEvent.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_EVENT',
      'SchoolEvent',
      id,
      null,
      existing,
    );
    return { deleted: true };
  }

  // ─── USER INVITATION ─────────────────────────────────────────────

  async inviteUser(
    actorId: string,
    schoolId: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      workloadPercentage?: number;
    },
  ) {
    if (!['TEACHER', 'STUDENT', 'DEPUTY', 'PRINCIPAL'].includes(data.role)) {
      throw new BadRequestException(
        'Can only invite TEACHER, STUDENT, DEPUTY, or PRINCIPAL roles.',
      );
    }

    // PRINCIPAL uniqueness: only one per school
    if (data.role === 'PRINCIPAL') {
      const existingPrincipal = await this.prisma.schoolMembership.findFirst({
        where: { schoolId, role: 'PRINCIPAL' },
      });
      if (existingPrincipal) {
        throw new BadRequestException(
          'This school already has a principal. Only one principal per school is allowed.',
        );
      }
    }

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(invitationToken, 10);
    const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          invitationToken: hashedToken,
          invitationExpires,
        },
      });
    } else {
      // Update existing user with invitation token
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { invitationToken: hashedToken, invitationExpires },
      });
    }

    // Create school membership with appropriate role
    const membershipData: any = {
      userId: user.id,
      schoolId,
      role: data.role,
      status: UserStatus.PENDING,
    };

    if (data.role === 'TEACHER' && data.workloadPercentage !== undefined) {
      membershipData.workloadPercentage = data.workloadPercentage;
    }

    // Upsert membership (user might already be a member with different role)
    await this.prisma.schoolMembership.upsert({
      where: { userId_schoolId: { userId: user.id, schoolId } },
      create: membershipData,
      update: {
        role: data.role,
        status: UserStatus.PENDING,
        ...(data.role === 'TEACHER' && data.workloadPercentage !== undefined
          ? { workloadPercentage: data.workloadPercentage }
          : {}),
      },
    });

    // Create teacher/student profile if needed
    if (data.role === 'TEACHER') {
      await this.prisma.teacherProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
    } else if (data.role === 'STUDENT') {
      await this.prisma.studentProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
        },
        update: {},
      });
    }

    const fullToken = `${user.id}.${invitationToken}`;

    // Send invitation email
    this.mailService
      .sendInvitation(
        user.email,
        `${user.firstName} ${user.lastName}`,
        fullToken,
      )
      .catch((e) => console.error('Failed to send invitation email', e));

    await this.audit(actorId, 'INVITE_USER', 'User', user.id, {
      email: data.email,
      role: data.role,
      workloadPercentage: data.workloadPercentage,
    });

    return { token: fullToken, userId: user.id };
  }

  // ─── SCHOOL-SCOPED USER LIST ────────────────────────────────────

  async getSchoolUsers(schoolId: string) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { schoolId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            lastLogin: true,
            createdAt: true,
            studentProfile: {
              select: {
                id: true,
                classroom: { select: { id: true, name: true } },
              },
            },
            teacherProfile: {
              select: {
                id: true,
                homeroomClass: { select: { id: true, name: true } },
              },
            },
            childOf: {
              select: {
                parent: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            parentOf: {
              select: {
                student: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m: any) => ({
      id: m.user.id,
      membershipId: m.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.role,
      status: m.status,
      workloadPercentage: m.workloadPercentage,
      lastLogin: m.user.lastLogin,
      createdAt: m.user.createdAt,
      classroomName: m.user.studentProfile?.classroom?.name || null,
      classroomId: m.user.studentProfile?.classroom?.id || null,
      homeroomClassName: m.user.teacherProfile?.homeroomClass?.name || null,
      teacherProfileId: m.user.teacherProfile?.id || null,
      parents: (m.user.childOf || []).map((r: any) => ({
        id: r.parent.id,
        name: `${r.parent.firstName} ${r.parent.lastName}`,
      })),
      children: (m.user.parentOf || []).map((r: any) => ({
        id: r.student.id,
        name: `${r.student.firstName} ${r.student.lastName}`,
      })),
    }));
  }

  // ─── CREATE STUDENT + FAMILY ────────────────────────────────────

  async createStudentFamily(
    actorId: string,
    schoolId: string,
    data: {
      student: { firstName: string; lastName: string; email?: string };
      parents: Array<{
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
      }>;
    },
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      // 1. Create student user
      const studentEmail =
        data.student.email || `student-${crypto.randomUUID()}@noemail.local`;
      const studentInvitationToken = data.student.email
        ? crypto.randomBytes(32).toString('hex')
        : null;
      const studentHashedToken = studentInvitationToken
        ? await bcrypt.hash(studentInvitationToken, 10)
        : null;
      const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const studentUser = await tx.user.create({
        data: {
          email: studentEmail,
          firstName: data.student.firstName,
          lastName: data.student.lastName,
          ...(studentHashedToken
            ? {
                invitationToken: studentHashedToken,
                invitationExpires: invitationExpires,
              }
            : {}),
        },
      });

      // 2. Create SchoolMembership for student
      await tx.schoolMembership.create({
        data: {
          userId: studentUser.id,
          schoolId,
          role: 'STUDENT',
          status: UserStatus.PENDING,
        },
      });

      // 3. Create StudentProfile
      await tx.studentProfile.create({
        data: {
          userId: studentUser.id,
          firstName: data.student.firstName,
          lastName: data.student.lastName,
        },
      });

      // 4. Process parents
      const createdParents: Array<{
        userId: string;
        email: string;
        token?: string;
      }> = [];

      for (const parentData of data.parents) {
        // Find or create parent user
        let parentUser = await tx.user.findUnique({
          where: { email: parentData.email },
        });
        const parentInvitationToken = crypto.randomBytes(32).toString('hex');
        const parentHashedToken = await bcrypt.hash(parentInvitationToken, 10);

        if (!parentUser) {
          parentUser = await tx.user.create({
            data: {
              email: parentData.email,
              firstName: parentData.firstName,
              lastName: parentData.lastName,
              invitationToken: parentHashedToken,
              invitationExpires: invitationExpires,
            },
          });
        } else {
          parentUser = await tx.user.update({
            where: { id: parentUser.id },
            data: {
              invitationToken: parentHashedToken,
              invitationExpires: invitationExpires,
            },
          });
        }

        // Create/upsert SchoolMembership for parent
        await tx.schoolMembership.upsert({
          where: { userId_schoolId: { userId: parentUser.id, schoolId } },
          create: {
            userId: parentUser.id,
            schoolId,
            role: 'PARENT',
            status: UserStatus.PENDING,
          },
          update: {},
        });

        // Create ParentStudent link
        await tx.parentStudent.upsert({
          where: {
            parentId_studentId: {
              parentId: parentUser.id,
              studentId: studentUser.id,
            },
          },
          create: { parentId: parentUser.id, studentId: studentUser.id },
          update: {},
        });

        const fullParentToken = `${parentUser.id}.${parentInvitationToken}`;
        createdParents.push({
          userId: parentUser.id,
          email: parentData.email,
          token: fullParentToken,
        });

        // Send invitation email to parent
        this.mailService
          .sendInvitation(
            parentData.email,
            `${parentData.firstName} ${parentData.lastName}`,
            fullParentToken,
          )
          .catch((e) =>
            console.error('Failed to send parent invitation email', e),
          );
      }

      // 5. Audit
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CREATE_STUDENT_FAMILY',
          entity: 'User',
          entityId: studentUser.id,
          newValues: {
            student: data.student,
            parentCount: data.parents.length,
          },
        },
      });

      // Send invitation email to student (outside loop, once)
      if (studentInvitationToken) {
        this.mailService
          .sendInvitation(
            studentUser.email,
            `${studentUser.firstName} ${studentUser.lastName}`,
            `${studentUser.id}.${studentInvitationToken}`,
          )
          .catch((e) =>
            console.error('Failed to send student invitation email', e),
          );
      }

      return {
        student: { id: studentUser.id, email: studentEmail },
        parents: createdParents,
        studentToken: studentInvitationToken
          ? `${studentUser.id}.${studentInvitationToken}`
          : null,
      };
    });
  }

  // ─── CREATE STAFF ───────────────────────────────────────────────

  async createStaff(
    actorId: string,
    schoolId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      role: 'TEACHER' | 'DEPUTY';
      workloadPercentage: number;
    },
  ) {
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(invitationToken, 10);
    const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx: any) => {
      // Find or create user
      let user = await tx.user.findUnique({ where: { email: data.email } });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            invitationToken: hashedToken,
            invitationExpires,
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: { invitationToken: hashedToken, invitationExpires },
        });
      }

      // Create SchoolMembership
      await tx.schoolMembership.upsert({
        where: { userId_schoolId: { userId: user.id, schoolId } },
        create: {
          userId: user.id,
          schoolId,
          role: data.role,
          status: UserStatus.PENDING,
          workloadPercentage: data.workloadPercentage,
        },
        update: {
          role: data.role,
          status: UserStatus.PENDING,
          workloadPercentage: data.workloadPercentage,
        },
      });

      // Create TeacherProfile if TEACHER
      if (data.role === 'TEACHER') {
        await tx.teacherProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {},
        });
      }
      return user;
    });

    const fullToken = `${user.id}.${invitationToken}`;

    // Send invitation email
    this.mailService
      .sendInvitation(
        user.email,
        `${user.firstName} ${user.lastName}`,
        fullToken,
      )
      .catch((e) => console.error('Failed to send invitation email', e));

    await this.audit(actorId, 'CREATE_STAFF', 'User', user.id, {
      email: data.email,
      role: data.role,
      workloadPercentage: data.workloadPercentage,
    });

    return { token: fullToken, userId: user.id };
  }

  async resendInvitation(actorId: string, schoolId: string, userId: string) {
    // 1. Verify user exists and belongs to the school
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException('User not found in this school');
    }

    if (membership.status !== UserStatus.PENDING) {
      throw new BadRequestException('User is already active or not pending');
    }

    const user = membership.user;

    // 2. Generate new token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(invitationToken, 10);
    const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        invitationToken: hashedToken,
        invitationExpires,
      },
    });

    // 3. Send email
    const fullToken = `${userId}.${invitationToken}`;
    // We'll use fire-and-forget for email sending if we want to be consistent,
    // but for a manual action like "resend", maybe it's better to await or at least handle error.
    this.mailService
      .sendInvitation(
        user.email,
        `${user.firstName} ${user.lastName}`,
        fullToken,
      )
      .catch((e) => console.error('Failed to resend invitation email', e));

    // 4. Audit
    await this.audit(actorId, 'RESEND_INVITATION', 'User', userId, {
      email: user.email,
    });

    return { success: true };
  }

  // ─── REMOVE USER FROM SCHOOL ────────────────────────────────────

  async removeSchoolUser(
    actorId: string,
    schoolId: string,
    targetUserId: string,
  ) {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { userId: targetUserId, schoolId },
      include: { user: true },
    });
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');

    // Cannot remove yourself
    if (actorId === targetUserId) {
      throw new BadRequestException('Cannot remove yourself from the school.');
    }

    // Cannot remove PRINCIPAL unless you are PRINCIPAL
    if (membership.role === 'PRINCIPAL') {
      throw new BadRequestException(
        'Cannot remove the principal. Contact system admin.',
      );
    }

    await this.prisma.schoolMembership.update({
      where: { id: membership.id },
      data: { status: 'ARCHIVED' },
    });

    await this.audit(
      actorId,
      'REMOVE_SCHOOL_USER',
      'SchoolMembership',
      membership.id,
      {
        userId: targetUserId,
        email: membership.user.email,
        role: membership.role,
        newStatus: 'ARCHIVED',
      },
    );

    return {
      message: `User ${membership.user.email} has been removed from the school.`,
    };
  }

  // ─── SET STUDENT AS ALUMNI ────────────────────────────────────────

  async setAlumniStatus(
    actorId: string,
    schoolId: string,
    targetUserId: string,
  ) {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { userId: targetUserId, schoolId },
      include: { user: true },
    });
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');

    if (membership.role !== 'STUDENT') {
      throw new BadRequestException('Only students can be set as alumni.');
    }

    if (membership.status === 'ALUMNI') {
      throw new BadRequestException('User is already marked as alumni.');
    }

    const oldStatus = membership.status;
    await this.prisma.schoolMembership.update({
      where: { id: membership.id },
      data: { status: 'ALUMNI' },
    });

    await this.audit(
      actorId,
      'SET_ALUMNI',
      'SchoolMembership',
      membership.id,
      {
        userId: targetUserId,
        email: membership.user.email,
        newStatus: 'ALUMNI',
      },
      {
        oldStatus,
      },
    );

    return {
      message: `Student ${membership.user.firstName} ${membership.user.lastName} has been marked as alumni.`,
    };
  }

  // ─── IMPERSONATE SCHOOL USER (read-only) ─────────────────────────

  async impersonateSchoolUser(
    actorId: string,
    schoolId: string,
    targetUserId: string,
    jwtService: any,
  ) {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { userId: targetUserId, schoolId },
      include: { user: true },
    });
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');

    // Cannot impersonate PRINCIPAL or DEPUTY
    if (['PRINCIPAL', 'DEPUTY'].includes(membership.role)) {
      throw new BadRequestException('Cannot impersonate school management.');
    }

    // Audit
    await this.audit(actorId, 'IMPERSONATE_SCHOOL_USER', 'User', targetUserId, {
      email: membership.user.email,
      role: membership.role,
      schoolId,
      readOnly: true,
    });

    // Generate a read-only tenant token for the target user
    const payload = {
      sub: membership.user.id,
      email: membership.user.email,
      schoolId,
      role: membership.role,
      type: 'TENANT',
      isImpersonated: true,
      readOnly: true,
      actorId,
    };

    return {
      access_token: jwtService.sign(payload),
    };
  }
  // ─── UPDATE SCHOOL USER ────────────────────────────────────────────

  async updateSchoolUser(
    actorId: string,
    schoolId: string,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      workloadPercentage?: number;
    },
  ) {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { userId, schoolId },
      include: { user: true },
    });
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');

    const oldValues = {
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      email: membership.user.email,
      workloadPercentage: membership.workloadPercentage,
    };

    // Update user fields
    const userUpdate: any = {};
    if (data.firstName !== undefined) userUpdate.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdate.lastName = data.lastName;
    if (data.email !== undefined) userUpdate.email = data.email;

    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
    }

    // Update membership fields
    if (data.workloadPercentage !== undefined) {
      await this.prisma.schoolMembership.update({
        where: { id: membership.id },
        data: { workloadPercentage: data.workloadPercentage },
      });
    }

    // Update student profile name if student
    if (membership.role === 'STUDENT' && (data.firstName || data.lastName)) {
      await this.prisma.studentProfile.updateMany({
        where: { userId },
        data: {
          ...(data.firstName ? { firstName: data.firstName } : {}),
          ...(data.lastName ? { lastName: data.lastName } : {}),
        },
      });
    }

    await this.audit(
      actorId,
      'UPDATE_SCHOOL_USER',
      'User',
      userId,
      data,
      oldValues,
    );
    return { success: true };
  }

  // ─── SUSPEND / REACTIVATE USER ───────────────────────────────────

  async suspendUser(actorId: string, schoolId: string, userId: string) {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { userId, schoolId },
      include: { user: true },
    });
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');
    if (membership.role === 'PRINCIPAL')
      throw new BadRequestException('Cannot suspend the principal.');
    if (actorId === userId)
      throw new BadRequestException('Cannot suspend yourself.');
    if (membership.status === 'SUSPENDED')
      throw new BadRequestException('User is already suspended.');

    await this.prisma.schoolMembership.update({
      where: { id: membership.id },
      data: { status: 'SUSPENDED' },
    });

    await this.audit(
      actorId,
      'SUSPEND_USER',
      'SchoolMembership',
      membership.id,
      {
        userId,
        newStatus: 'SUSPENDED',
      },
      { oldStatus: membership.status },
    );

    return {
      message: `User ${membership.user.firstName} ${membership.user.lastName} has been suspended.`,
    };
  }

  async reactivateUser(actorId: string, schoolId: string, userId: string) {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { userId, schoolId },
      include: { user: true },
    });
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');
    if (membership.status !== 'SUSPENDED')
      throw new BadRequestException('User is not suspended.');

    await this.prisma.schoolMembership.update({
      where: { id: membership.id },
      data: { status: 'ACTIVE' },
    });

    await this.audit(
      actorId,
      'REACTIVATE_USER',
      'SchoolMembership',
      membership.id,
      {
        userId,
        newStatus: 'ACTIVE',
      },
      { oldStatus: 'SUSPENDED' },
    );

    return {
      message: `User ${membership.user.firstName} ${membership.user.lastName} has been reactivated.`,
    };
  }

  // ─── CHANGE USER ROLE ────────────────────────────────────────────

  async changeUserRole(
    actorId: string,
    schoolId: string,
    userId: string,
    newRole: string,
  ) {
    const validRoles = ['TEACHER', 'STUDENT', 'DEPUTY', 'PARENT'];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException(
        `Invalid role. Allowed: ${validRoles.join(', ')}`,
      );
    }

    const membership = await this.prisma.schoolMembership.findFirst({
      where: { userId, schoolId },
      include: { user: true },
    });
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');
    if (membership.role === 'PRINCIPAL')
      throw new BadRequestException('Cannot change the principal role.');
    if (actorId === userId)
      throw new BadRequestException('Cannot change your own role.');

    const oldRole = membership.role;

    await this.prisma.schoolMembership.update({
      where: { id: membership.id },
      data: { role: newRole as any },
    });

    // Create profiles if needed
    if (newRole === 'TEACHER') {
      await this.prisma.teacherProfile.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
    } else if (newRole === 'STUDENT') {
      const user = membership.user;
      await this.prisma.studentProfile.upsert({
        where: { userId },
        create: { userId, firstName: user.firstName, lastName: user.lastName },
        update: {},
      });
    }

    await this.audit(
      actorId,
      'CHANGE_USER_ROLE',
      'SchoolMembership',
      membership.id,
      {
        userId,
        newRole,
      },
      { oldRole },
    );

    return { success: true, newRole };
  }

  // ─── EXPORT USERS CSV ────────────────────────────────────────────

  async exportUsersCSV(schoolId: string): Promise<string> {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { schoolId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            lastLogin: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header =
      'Příjmení;Jméno;Email;Role;Status;Úvazek;Poslední přihlášení;Datum vytvoření';
    const rows = memberships.map((m: any) => {
      const u = m.user;
      return [
        u.lastName,
        u.firstName,
        u.email,
        m.role,
        m.status,
        m.workloadPercentage ?? '',
        u.lastLogin ? new Date(u.lastLogin).toISOString() : '',
        new Date(u.createdAt).toISOString(),
      ].join(';');
    });

    return [header, ...rows].join('\n');
  }

  // ─── THEMATIC PLANS ──────────────────────────────────────────────

  async getThematicPlans(schoolId: string) {
    return this.prisma.thematicPlan.findMany({
      where: { schoolId },
      include: {
        subjectTemplate: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        gradeLevel: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { weeks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getThematicPlan(schoolId: string, id: string) {
    const plan = await this.prisma.thematicPlan.findFirst({
      where: { id, schoolId },
      include: {
        subjectTemplate: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        gradeLevel: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        weeks: { orderBy: { weekNumber: 'asc' } },
      },
    });
    if (!plan) throw new NotFoundException('Thematic plan not found');
    return plan;
  }

  async createThematicPlan(
    actorId: string,
    schoolId: string,
    data: {
      title: string;
      subjectTemplateId: string;
      academicYearId: string;
      gradeLevelId: string;
    },
  ) {
    const plan = await this.prisma.thematicPlan.create({
      data: { ...data, teacherId: actorId, schoolId },
    });
    await this.audit(
      actorId,
      'CREATE_THEMATIC_PLAN',
      'ThematicPlan',
      plan.id,
      data,
    );
    return plan;
  }

  async updateThematicPlan(
    actorId: string,
    schoolId: string,
    id: string,
    data: { title?: string },
  ) {
    const existing = await this.prisma.thematicPlan.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Thematic plan not found');
    const updated = await this.prisma.thematicPlan.update({
      where: { id },
      data,
    });
    await this.audit(
      actorId,
      'UPDATE_THEMATIC_PLAN',
      'ThematicPlan',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteThematicPlan(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.thematicPlan.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Thematic plan not found');
    await this.prisma.thematicPlan.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_THEMATIC_PLAN',
      'ThematicPlan',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  async saveThematicPlanWeeks(
    actorId: string,
    schoolId: string,
    planId: string,
    weeks: Array<{
      weekNumber: number;
      topic: string;
      objectives?: string;
      methods?: string;
      resources?: string;
      crossCurricular?: string;
      notes?: string;
    }>,
  ) {
    const plan = await this.prisma.thematicPlan.findFirst({
      where: { id: planId, schoolId },
    });
    if (!plan) throw new NotFoundException('Thematic plan not found');

    // Delete existing weeks and recreate
    await this.prisma.thematicPlanWeek.deleteMany({ where: { planId } });
    const created = await this.prisma.thematicPlanWeek.createMany({
      data: weeks.map((w: any) => ({ ...w, planId })),
    });
    await this.audit(actorId, 'SAVE_PLAN_WEEKS', 'ThematicPlan', planId, {
      weekCount: weeks.length,
    });
    return { saved: created.count };
  }

  // ─── LESSON PREPARATIONS ─────────────────────────────────────────

  async getLessonPreparations(
    schoolId: string,
    filters?: { subjectTemplateId?: string; teacherId?: string },
  ) {
    return this.prisma.lessonPreparation.findMany({
      where: {
        schoolId,
        ...(filters?.subjectTemplateId
          ? { subjectTemplateId: filters.subjectTemplateId }
          : {}),
        ...(filters?.teacherId ? { teacherId: filters.teacherId } : {}),
      },
      include: {
        subjectTemplate: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async createLessonPreparation(
    actorId: string,
    schoolId: string,
    data: {
      title: string;
      date: string;
      duration?: number;
      topic: string;
      objectives?: string;
      activities?: string;
      materials?: string;
      homework?: string;
      evaluation?: string;
      subjectTemplateId: string;
    },
  ) {
    const prep = await this.prisma.lessonPreparation.create({
      data: {
        title: data.title,
        date: new Date(data.date),
        duration: data.duration ?? 45,
        topic: data.topic,
        objectives: data.objectives,
        activities: data.activities,
        materials: data.materials,
        homework: data.homework,
        evaluation: data.evaluation,
        subjectTemplateId: data.subjectTemplateId,
        teacherId: actorId,
        schoolId,
      },
    });
    await this.audit(
      actorId,
      'CREATE_LESSON_PREPARATION',
      'LessonPreparation',
      prep.id,
      data,
    );
    return prep;
  }

  async updateLessonPreparation(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      title?: string;
      date?: string;
      duration?: number;
      topic?: string;
      objectives?: string;
      activities?: string;
      materials?: string;
      homework?: string;
      evaluation?: string;
    },
  ) {
    const existing = await this.prisma.lessonPreparation.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Lesson preparation not found');
    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    const updated = await this.prisma.lessonPreparation.update({
      where: { id },
      data: updateData,
    });
    await this.audit(
      actorId,
      'UPDATE_LESSON_PREPARATION',
      'LessonPreparation',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteLessonPreparation(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.lessonPreparation.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Lesson preparation not found');
    await this.prisma.lessonPreparation.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_LESSON_PREPARATION',
      'LessonPreparation',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  // ─── TEACHING MATERIALS ──────────────────────────────────────────

  async getTeachingMaterials(
    schoolId: string,
    filters?: { subjectTemplateId?: string; type?: string },
  ) {
    return this.prisma.teachingMaterial.findMany({
      where: {
        schoolId,
        ...(filters?.subjectTemplateId
          ? { subjectTemplateId: filters.subjectTemplateId }
          : {}),
        ...(filters?.type ? { type: filters.type } : {}),
      },
      include: {
        subjectTemplate: { select: { id: true, name: true, code: true } },
        gradeLevel: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTeachingMaterial(
    actorId: string,
    schoolId: string,
    data: {
      title: string;
      description?: string;
      url: string;
      type?: string;
      subjectTemplateId?: string;
      gradeLevelId?: string;
    },
  ) {
    const material = await this.prisma.teachingMaterial.create({
      data: {
        title: data.title,
        description: data.description,
        url: data.url,
        type: data.type ?? 'OTHER',
        subjectTemplateId: data.subjectTemplateId || null,
        gradeLevelId: data.gradeLevelId || null,
        uploadedById: actorId,
        schoolId,
      },
    });
    await this.audit(
      actorId,
      'CREATE_TEACHING_MATERIAL',
      'TeachingMaterial',
      material.id,
      data,
    );
    return material;
  }

  async updateTeachingMaterial(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      url?: string;
      type?: string;
      subjectTemplateId?: string | null;
      gradeLevelId?: string | null;
    },
  ) {
    const existing = await this.prisma.teachingMaterial.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Teaching material not found');
    const updated = await this.prisma.teachingMaterial.update({
      where: { id },
      data,
    });
    await this.audit(
      actorId,
      'UPDATE_TEACHING_MATERIAL',
      'TeachingMaterial',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteTeachingMaterial(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.teachingMaterial.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Teaching material not found');
    await this.prisma.teachingMaterial.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_TEACHING_MATERIAL',
      'TeachingMaterial',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  // ─── RVP COMPETENCIES ────────────────────────────────────────────

  async getRvpCompetencies(schoolId: string) {
    return this.prisma.rvpCompetency.findMany({
      where: { schoolId },
      include: { _count: { select: { mappings: true } } },
      orderBy: [{ area: 'asc' }, { code: 'asc' }],
    });
  }

  async createRvpCompetency(
    actorId: string,
    schoolId: string,
    data: {
      code: string;
      name: string;
      area: string;
      description?: string;
    },
  ) {
    const comp = await this.prisma.rvpCompetency.create({
      data: { ...data, schoolId },
    });
    await this.audit(
      actorId,
      'CREATE_RVP_COMPETENCY',
      'RvpCompetency',
      comp.id,
      data,
    );
    return comp;
  }

  async updateRvpCompetency(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      code?: string;
      name?: string;
      area?: string;
      description?: string;
    },
  ) {
    const existing = await this.prisma.rvpCompetency.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Competency not found');
    const updated = await this.prisma.rvpCompetency.update({
      where: { id },
      data,
    });
    await this.audit(
      actorId,
      'UPDATE_RVP_COMPETENCY',
      'RvpCompetency',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteRvpCompetency(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.rvpCompetency.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Competency not found');
    await this.prisma.rvpCompetency.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_RVP_COMPETENCY',
      'RvpCompetency',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  // ─── COMPETENCY MAPPINGS ─────────────────────────────────────────

  async getCompetencyMappings(
    schoolId: string,
    filters?: { subjectTemplateId?: string; gradeLevelId?: string },
  ) {
    // We fetch via competency → school to scope
    return this.prisma.competencyMapping.findMany({
      where: {
        competency: { schoolId },
        ...(filters?.subjectTemplateId
          ? { subjectTemplateId: filters.subjectTemplateId }
          : {}),
        ...(filters?.gradeLevelId
          ? { gradeLevelId: filters.gradeLevelId }
          : {}),
      },
      include: {
        competency: {
          select: { id: true, code: true, name: true, area: true },
        },
        subjectTemplate: { select: { id: true, name: true, code: true } },
        gradeLevel: { select: { id: true, name: true } },
      },
      orderBy: { competency: { code: 'asc' } },
    });
  }

  async upsertCompetencyMapping(
    actorId: string,
    schoolId: string,
    data: {
      competencyId: string;
      subjectTemplateId: string;
      gradeLevelId: string;
      fulfilled: boolean;
      note?: string;
    },
  ) {
    // Verify competency belongs to school
    const comp = await this.prisma.rvpCompetency.findFirst({
      where: { id: data.competencyId, schoolId },
    });
    if (!comp)
      throw new NotFoundException('Competency not found in this school');

    const mapping = await this.prisma.competencyMapping.upsert({
      where: {
        competencyId_subjectTemplateId_gradeLevelId: {
          competencyId: data.competencyId,
          subjectTemplateId: data.subjectTemplateId,
          gradeLevelId: data.gradeLevelId,
        },
      },
      create: data,
      update: { fulfilled: data.fulfilled, note: data.note },
    });
    await this.audit(
      actorId,
      'UPSERT_COMPETENCY_MAPPING',
      'CompetencyMapping',
      mapping.id,
      data,
    );
    return mapping;
  }

  async deleteCompetencyMapping(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.competencyMapping.findFirst({
      where: { id, competency: { schoolId } },
    });
    if (!existing) throw new NotFoundException('Mapping not found');
    await this.prisma.competencyMapping.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_COMPETENCY_MAPPING',
      'CompetencyMapping',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  // ─── AUDIT HELPER ────────────────────────────────────────────────

  private async audit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    newValues?: any,
    oldValues?: any,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        newValues: newValues ?? undefined,
        oldValues: oldValues ?? undefined,
      },
    });
  }
}
