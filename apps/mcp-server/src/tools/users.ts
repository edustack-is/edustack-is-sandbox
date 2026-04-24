import { server } from '../server.js';
import { prisma } from '../db.js';
import { z } from 'zod';

// ─── LIST / SEARCH USERS ────────────────────────────────────────

server.tool(
    'list_users',
    'Vypíše uživatele v systému. Může filtrovat podle školy, role, statusu nebo vyhledávat podle jména či emailu.',
    {
        schoolId: z.string().optional().describe('Filtrovat podle ID školy'),
        role: z
            .enum(['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEPUTY', 'TEACHER', 'STUDENT', 'PARENT'])
            .optional()
            .describe('Filtrovat podle role'),
        status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional().describe('Filtrovat podle statusu'),
        search: z.string().optional().describe('Vyhledávací fráze (jméno nebo email)'),
        limit: z.number().optional().describe('Maximální počet výsledků (výchozí 50)'),
        offset: z.number().optional().describe('Offset pro stránkování (výchozí 0)'),
    },
    async ({ schoolId, role, status, search, limit, offset }) => {
        try {
            const take = limit ?? 50;
            const skip = offset ?? 0;

            const where: any = {};

            if (schoolId || role || status) {
                where.schoolMemberships = {
                    some: {
                        ...(schoolId ? { schoolId } : {}),
                        ...(role ? { role } : {}),
                        ...(status ? { status } : {}),
                    },
                };
            }

            if (search) {
                where.OR = [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ];
            }

            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    take,
                    skip,
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        isSystemAdmin: true,
                        lastLogin: true,
                        createdAt: true,
                        schoolMemberships: {
                            select: {
                                schoolId: true,
                                role: true,
                                status: true,
                                school: { select: { name: true } },
                            },
                        },
                    },
                    orderBy: { lastName: 'asc' },
                }),
                prisma.user.count({ where }),
            ]);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ total, count: users.length, offset: skip, users }, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při načítání uživatelů: ${error.message}` }],
            };
        }
    },
);

// ─── GET USER DETAIL ────────────────────────────────────────────

server.tool(
    'get_user_detail',
    'Vrátí detailní informace o konkrétním uživateli včetně jeho členství ve školách, profilů a rodinných vazeb.',
    {
        userId: z.string().describe('ID uživatele'),
    },
    async ({ userId }) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    isSystemAdmin: true,
                    lastLogin: true,
                    createdAt: true,
                    deletedAt: true,
                    schoolMemberships: {
                        select: {
                            id: true,
                            schoolId: true,
                            role: true,
                            status: true,
                            workloadPercentage: true,
                            school: { select: { name: true } },
                        },
                    },
                    studentProfile: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            classroomId: true,
                            classroom: { select: { name: true, grade: true } },
                        },
                    },
                    teacherProfile: {
                        select: {
                            id: true,
                            degree: true,
                            approbation: true,
                            homeroomClassId: true,
                            homeroomClass: { select: { name: true } },
                        },
                    },
                    parentOf: {
                        select: {
                            student: {
                                select: { id: true, firstName: true, lastName: true, email: true },
                            },
                        },
                    },
                    childOf: {
                        select: {
                            parent: {
                                select: { id: true, firstName: true, lastName: true, email: true },
                            },
                        },
                    },
                },
            });

            if (!user) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Uživatel s ID '${userId}' nebyl nalezen.` }],
                };
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(user, null, 2) }],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při načítání uživatele: ${error.message}` }],
            };
        }
    },
);

// ─── CREATE USER ────────────────────────────────────────────────

server.tool(
    'create_user',
    'Vytvoří nového uživatele a volitelně ho přiřadí ke škole s danou rolí. Pokud je role TEACHER, vytvoří i TeacherProfile. Pokud je role STUDENT, vytvoří i StudentProfile.',
    {
        email: z.string().describe('E-mail uživatele'),
        firstName: z.string().describe('Jméno'),
        lastName: z.string().describe('Příjmení'),
        schoolId: z.string().optional().describe('ID školy pro přiřazení'),
        role: z
            .enum(['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEPUTY', 'TEACHER', 'STUDENT', 'PARENT'])
            .optional()
            .describe('Role ve škole (vyžaduje schoolId)'),
        isSystemAdmin: z.boolean().optional().describe('Nastavit jako systémového administrátora'),
    },
    async ({ email, firstName, lastName, schoolId, role, isSystemAdmin }) => {
        try {
            const data: any = {
                email,
                firstName,
                lastName,
                passwordHash: 'awaiting_activation',
                isSystemAdmin: isSystemAdmin ?? false,
            };

            if (schoolId && role) {
                data.schoolMemberships = {
                    create: {
                        schoolId,
                        role,
                        status: 'ACTIVE',
                    },
                };

                if (role === 'TEACHER') {
                    data.teacherProfile = { create: {} };
                }

                if (role === 'STUDENT') {
                    data.studentProfile = {
                        create: {
                            firstName,
                            lastName,
                        },
                    };
                }
            }

            const user = await prisma.user.create({
                data,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    isSystemAdmin: true,
                    schoolMemberships: {
                        select: { schoolId: true, role: true, status: true },
                    },
                },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text:
                            `Uživatel '${firstName} ${lastName}' (${email}) byl úspěšně vytvořen s ID: ${user.id}` +
                            (role ? ` a rolí ${role}` : '') +
                            (schoolId ? ` ve škole ${schoolId}` : ''),
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při vytváření uživatele: ${error.message}` }],
            };
        }
    },
);

// ─── UPDATE USER ────────────────────────────────────────────────

server.tool(
    'update_user',
    'Aktualizuje údaje existujícího uživatele (jméno, příjmení, email, systémový admin status).',
    {
        userId: z.string().describe('ID uživatele'),
        firstName: z.string().optional().describe('Nové jméno'),
        lastName: z.string().optional().describe('Nové příjmení'),
        email: z.string().optional().describe('Nový email'),
        isSystemAdmin: z.boolean().optional().describe('Nastavit/odebrat systémového administrátora'),
    },
    async ({ userId, firstName, lastName, email, isSystemAdmin }) => {
        try {
            const data: any = {};
            if (firstName !== undefined) data.firstName = firstName;
            if (lastName !== undefined) data.lastName = lastName;
            if (email !== undefined) data.email = email;
            if (isSystemAdmin !== undefined) data.isSystemAdmin = isSystemAdmin;

            const user = await prisma.user.update({
                where: { id: userId },
                data,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    isSystemAdmin: true,
                },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Uživatel ${user.firstName} ${user.lastName} (${user.id}) byl úspěšně aktualizován.`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při aktualizaci uživatele: ${error.message}` }],
            };
        }
    },
);

// ─── ASSIGN / CHANGE ROLE ───────────────────────────────────────

server.tool(
    'assign_user_role',
    'Přiřadí uživatele ke škole s danou rolí, nebo změní existující roli/status členství. Pokud členství existuje, aktualizuje ho. Pokud ne, vytvoří nové.',
    {
        userId: z.string().describe('ID uživatele'),
        schoolId: z.string().describe('ID školy'),
        role: z
            .enum(['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEPUTY', 'TEACHER', 'STUDENT', 'PARENT'])
            .describe('Role ve škole'),
        status: z
            .enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'])
            .optional()
            .describe('Status členství (výchozí ACTIVE)'),
    },
    async ({ userId, schoolId, role, status }) => {
        try {
            const membership = await prisma.schoolMembership.upsert({
                where: {
                    userId_schoolId: { userId, schoolId },
                },
                update: {
                    role,
                    status: status ?? 'ACTIVE',
                },
                create: {
                    userId,
                    schoolId,
                    role,
                    status: status ?? 'ACTIVE',
                },
                include: {
                    user: { select: { firstName: true, lastName: true } },
                    school: { select: { name: true } },
                },
            });

            // Create teacher/student profile if needed
            if (role === 'TEACHER') {
                await prisma.teacherProfile.upsert({
                    where: { userId },
                    update: {},
                    create: { userId },
                });
            }

            if (role === 'STUDENT') {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { firstName: true, lastName: true },
                });
                await prisma.studentProfile.upsert({
                    where: { userId },
                    update: {},
                    create: {
                        userId,
                        firstName: user?.firstName ?? '',
                        lastName: user?.lastName ?? '',
                    },
                });
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Uživatel '${membership.user.firstName} ${membership.user.lastName}' má nyní roli ${role} ve škole '${membership.school.name}'.`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při přiřazení role: ${error.message}` }],
            };
        }
    },
);

// ─── REMOVE USER FROM SCHOOL ────────────────────────────────────

server.tool(
    'remove_user_from_school',
    'Odebere uživatele ze školy (smaže jeho SchoolMembership).',
    {
        userId: z.string().describe('ID uživatele'),
        schoolId: z.string().describe('ID školy'),
    },
    async ({ userId, schoolId }) => {
        try {
            await prisma.schoolMembership.delete({
                where: {
                    userId_schoolId: { userId, schoolId },
                },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Členství uživatele ${userId} ve škole ${schoolId} bylo odstraněno.`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při odebírání ze školy: ${error.message}` }],
            };
        }
    },
);

// ─── LIST SCHOOLS ───────────────────────────────────────────────

server.tool(
    'list_schools',
    'Vypíše všechny školy v systému včetně počtu členů.',
    {
        search: z.string().optional().describe('Vyhledávání podle názvu školy'),
    },
    async ({ search }) => {
        try {
            const where: any = { deletedAt: null };
            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }

            const schools = await prisma.school.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    address: true,
                    contactEmail: true,
                    createdAt: true,
                    _count: {
                        select: {
                            members: true,
                            classrooms: true,
                        },
                    },
                },
                orderBy: { name: 'asc' },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(schools, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při načítání škol: ${error.message}` }],
            };
        }
    },
);

// ─── GET SCHOOL DETAIL ──────────────────────────────────────────

server.tool(
    'get_school_detail',
    'Vrátí detailní informace o škole včetně seznamu tříd, školních roků a počtu členů podle rolí.',
    {
        schoolId: z.string().describe('ID školy'),
    },
    async ({ schoolId }) => {
        try {
            const school = await prisma.school.findUnique({
                where: { id: schoolId },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    contactEmail: true,
                    allowStudentSelfRegistration: true,
                    createdAt: true,
                    classrooms: {
                        select: {
                            id: true,
                            name: true,
                            grade: true,
                            _count: { select: { students: true } },
                        },
                        orderBy: { grade: 'asc' },
                    },
                    academicYears: {
                        select: {
                            id: true,
                            name: true,
                            startDate: true,
                            endDate: true,
                            isCurrent: true,
                        },
                        orderBy: { startDate: 'desc' },
                    },
                },
            });

            if (!school) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Škola s ID '${schoolId}' nebyla nalezena.` }],
                };
            }

            // Count members by role
            const membersByRole = await prisma.schoolMembership.groupBy({
                by: ['role'],
                where: { schoolId, status: 'ACTIVE' },
                _count: { role: true },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ ...school, membersByRole }, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při načítání školy: ${error.message}` }],
            };
        }
    },
);

// ─── UPDATE SCHOOL ──────────────────────────────────────────────

server.tool(
    'update_school',
    'Aktualizuje údaje existující školy (název, adresa, kontakní email, povolení self-registrace).',
    {
        schoolId: z.string().describe('ID školy'),
        name: z.string().optional().describe('Nový název školy'),
        address: z.string().optional().describe('Nová adresa'),
        contactEmail: z.string().optional().describe('Nový kontaktní email'),
        allowStudentSelfRegistration: z.boolean().optional().describe('Povolit/zakázat self-registraci studentů'),
    },
    async ({ schoolId, name, address, contactEmail, allowStudentSelfRegistration }) => {
        try {
            const data: any = {};
            if (name !== undefined) data.name = name;
            if (address !== undefined) data.address = address;
            if (contactEmail !== undefined) data.contactEmail = contactEmail;
            if (allowStudentSelfRegistration !== undefined)
                data.allowStudentSelfRegistration = allowStudentSelfRegistration;

            const school = await prisma.school.update({
                where: { id: schoolId },
                data,
                select: { id: true, name: true, address: true, contactEmail: true },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Škola '${school.name}' (${school.id}) byla úspěšně aktualizována.`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při aktualizaci školy: ${error.message}` }],
            };
        }
    },
);

// ─── LIST CLASSROOMS ────────────────────────────────────────────

server.tool(
    'list_classrooms',
    'Vypíše třídy v dané škole včetně počtu studentů.',
    {
        schoolId: z.string().describe('ID školy'),
    },
    async ({ schoolId }) => {
        try {
            const classrooms = await prisma.classroom.findMany({
                where: { schoolId },
                select: {
                    id: true,
                    name: true,
                    grade: true,
                    homeroomTeacher: {
                        select: {
                            user: { select: { firstName: true, lastName: true } },
                        },
                    },
                    _count: { select: { students: true } },
                },
                orderBy: { grade: 'asc' },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(classrooms, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při načítání tříd: ${error.message}` }],
            };
        }
    },
);

// ─── CREATE CLASSROOM ───────────────────────────────────────────

server.tool(
    'create_classroom',
    'Vytvoří novou třídu v dané škole.',
    {
        schoolId: z.string().describe('ID školy'),
        name: z.string().describe("Název třídy (např. '1.A')"),
        grade: z.number().describe('Ročník (číslo, např. 1)'),
    },
    async ({ schoolId, name, grade }) => {
        try {
            const classroom = await prisma.classroom.create({
                data: { name, grade, schoolId },
                select: { id: true, name: true, grade: true },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Třída '${classroom.name}' (ročník ${classroom.grade}) byla vytvořena s ID: ${classroom.id}`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při vytváření třídy: ${error.message}` }],
            };
        }
    },
);

// ─── ASSIGN STUDENT TO CLASSROOM ────────────────────────────────

server.tool(
    'assign_student_to_classroom',
    'Přiřadí studenta do třídy (aktualizuje StudentProfile).',
    {
        userId: z.string().describe('ID uživatele (studenta)'),
        classroomId: z.string().describe('ID třídy'),
    },
    async ({ userId, classroomId }) => {
        try {
            const profile = await prisma.studentProfile.update({
                where: { userId },
                data: { classroomId },
                select: {
                    userId: true,
                    firstName: true,
                    lastName: true,
                    classroom: { select: { name: true } },
                },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Student '${profile.firstName} ${profile.lastName}' byl přiřazen do třídy '${profile.classroom?.name}'.`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při přiřazení studenta do třídy: ${error.message}` }],
            };
        }
    },
);

// ─── LINK PARENT TO STUDENT ─────────────────────────────────────

server.tool(
    'link_parent_to_student',
    'Propojí rodiče se studentem (vytvoří ParentStudent vazbu).',
    {
        parentUserId: z.string().describe('ID uživatele (rodiče)'),
        studentUserId: z.string().describe('ID uživatele (studenta)'),
    },
    async ({ parentUserId, studentUserId }) => {
        try {
            await prisma.parentStudent.create({
                data: {
                    parentId: parentUserId,
                    studentId: studentUserId,
                },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Rodič ${parentUserId} byl úspěšně propojen se studentem ${studentUserId}.`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při propojování rodiče a studenta: ${error.message}` }],
            };
        }
    },
);

// ─── DELETE SCHOOL (SOFT DELETE) ────────────────────────────────

server.tool(
    'delete_school',
    'Smaže školu (soft delete – nastaví deletedAt). Škola se přestane zobrazovat v seznamech, ale data zůstanou v databázi.',
    {
        schoolId: z.string().describe('ID školy ke smazání'),
    },
    async ({ schoolId }) => {
        try {
            const school = await prisma.school.findUnique({ where: { id: schoolId } });
            if (!school) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Škola s ID '${schoolId}' nebyla nalezena.` }],
                };
            }
            if (school.deletedAt) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Škola '${school.name}' je již smazaná.` }],
                };
            }

            await prisma.school.update({
                where: { id: schoolId },
                data: { deletedAt: new Date() },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Škola '${school.name}' byla úspěšně smazána (soft delete).`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při mazání školy: ${error.message}` }],
            };
        }
    },
);

// ─── BATCH CREATE USERS ─────────────────────────────────────────

server.tool(
    'batch_create_users',
    'Hromadně vytvoří uživatele a přiřadí je ke škole. Podporuje vytváření studentů, učitelů, rodičů a dalších rolí. U studentů automaticky vytváří StudentProfile, u učitelů TeacherProfile. Může propojit rodiče se studenty.',
    {
        schoolId: z.string().describe('ID školy, ke které budou uživatelé přiřazeni'),
        users: z
            .array(
                z.object({
                    firstName: z.string().describe('Jméno'),
                    lastName: z.string().describe('Příjmení'),
                    email: z.string().describe('E-mail'),
                    role: z
                        .enum(['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEPUTY', 'TEACHER', 'STUDENT', 'PARENT'])
                        .describe('Role ve škole'),
                    classroomId: z.string().optional().describe('ID třídy (pro studenty)'),
                    parentEmails: z
                        .array(z.string())
                        .optional()
                        .describe(
                            'E-maily rodičů, kteří mají být propojeni s tímto studentem (vytvoří se automaticky pokud neexistují)',
                        ),
                }),
            )
            .describe('Seznam uživatelů k vytvoření'),
    },
    async ({ schoolId, users }) => {
        try {
            const result = await prisma.$transaction(async (tx) => {
                const created: { id: string; name: string; role: string; email: string }[] = [];
                const parentMap = new Map<string, string>(); // email -> userId

                // First pass: create all users
                for (const u of users) {
                    // Check if user already exists
                    let user = await tx.user.findUnique({ where: { email: u.email } });

                    if (!user) {
                        const data: any = {
                            email: u.email,
                            firstName: u.firstName,
                            lastName: u.lastName,
                            passwordHash: 'awaiting_activation',
                            schoolMemberships: {
                                create: {
                                    schoolId,
                                    role: u.role,
                                    status: 'ACTIVE',
                                },
                            },
                        };

                        if (u.role === 'STUDENT') {
                            data.studentProfile = {
                                create: {
                                    firstName: u.firstName,
                                    lastName: u.lastName,
                                    ...(u.classroomId ? { classroomId: u.classroomId } : {}),
                                },
                            };
                        }

                        if (u.role === 'TEACHER') {
                            data.teacherProfile = { create: {} };
                        }

                        user = await tx.user.create({ data });
                    } else {
                        // User exists, just add membership if not already present
                        const existingMembership = await tx.schoolMembership.findUnique({
                            where: { userId_schoolId: { userId: user.id, schoolId } },
                        });
                        if (!existingMembership) {
                            await tx.schoolMembership.create({
                                data: { userId: user.id, schoolId, role: u.role, status: 'ACTIVE' },
                            });
                        }
                    }

                    created.push({ id: user.id, name: `${u.firstName} ${u.lastName}`, role: u.role, email: u.email });

                    if (u.role === 'PARENT') {
                        parentMap.set(u.email, user.id);
                    }
                }

                // Second pass: create parent-student links
                for (const u of users) {
                    if (u.role === 'STUDENT' && u.parentEmails && u.parentEmails.length > 0) {
                        const studentUser = created.find((c) => c.email === u.email);
                        if (!studentUser) continue;

                        for (const parentEmail of u.parentEmails) {
                            let parentId = parentMap.get(parentEmail);

                            if (!parentId) {
                                // Try to find existing parent user
                                const existingParent = await tx.user.findUnique({ where: { email: parentEmail } });
                                if (existingParent) {
                                    parentId = existingParent.id;
                                }
                            }

                            if (parentId) {
                                // Check if link already exists
                                const existingLink = await tx.parentStudent.findUnique({
                                    where: { parentId_studentId: { parentId, studentId: studentUser.id } },
                                });
                                if (!existingLink) {
                                    await tx.parentStudent.create({
                                        data: { parentId, studentId: studentUser.id },
                                    });
                                }
                            }
                        }
                    }
                }

                return created;
            });

            const summary = {
                total: result.length,
                byRole: result.reduce(
                    (acc, u) => {
                        acc[u.role] = (acc[u.role] || 0) + 1;
                        return acc;
                    },
                    {} as Record<string, number>,
                ),
                users: result,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: `Úspěšně vytvořeno ${result.length} uživatelů.\n${JSON.stringify(summary, null, 2)}`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při hromadném vytváření uživatelů: ${error.message}` }],
            };
        }
    },
);
