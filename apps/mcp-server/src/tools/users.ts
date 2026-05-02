import { server } from '../server.js';
import { db, transaction } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

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

            let sql = `
                SELECT DISTINCT u.id, u.email, u.firstName, u.lastName, u.isSystemAdmin, u.lastLogin, u.createdAt
                FROM "User" u
            `;
            const params: any[] = [];
            const conditions: string[] = [];

            if (schoolId || role || status) {
                sql += ` JOIN "SchoolMembership" m ON u.id = m.userId`;
                if (schoolId) {
                    conditions.push(`m.schoolId = ?`);
                    params.push(schoolId);
                }
                if (role) {
                    conditions.push(`m.role = ?`);
                    params.push(role);
                }
                if (status) {
                    conditions.push(`m.status = ?`);
                    params.push(status);
                }
            }

            if (search) {
                conditions.push(`(u.firstName LIKE ? OR u.lastName LIKE ? OR u.email LIKE ?)`);
                const s = `%${search}%`;
                params.push(s, s, s);
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
            const total = (db.prepare(countSql).get(...params) as any).total;

            sql += ` ORDER BY u.lastName ASC LIMIT ? OFFSET ?`;
            params.push(take, skip);

            const users = db.prepare(sql).all(...params) as any[];

            // Add memberships to results
            for (const user of users) {
                const memberships = db
                    .prepare(
                        `
                    SELECT m.schoolId, m.role, m.status, s.name as schoolName
                    FROM "SchoolMembership" m
                    JOIN "School" s ON m.schoolId = s.id
                    WHERE m.userId = ?
                `,
                    )
                    .all(user.id) as any[];
                user.schoolMemberships = memberships.map((m) => ({
                    schoolId: m.schoolId,
                    role: m.role,
                    status: m.status,
                    school: { name: m.schoolName },
                }));
            }

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
            const user = db.prepare('SELECT * FROM "User" WHERE id = ?').get(userId) as any;

            if (!user) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Uživatel s ID '${userId}' nebyl nalezen.` }],
                };
            }

            // Memberships
            user.schoolMemberships = db
                .prepare(
                    `
                SELECT m.*, s.name as schoolName
                FROM "SchoolMembership" m
                JOIN "School" s ON m.schoolId = s.id
                WHERE m.userId = ?
            `,
                )
                .all(userId)
                .map((m: any) => ({
                    ...m,
                    school: { name: m.schoolName },
                }));

            // Profiles
            user.studentProfile = db
                .prepare(
                    `
                SELECT sp.*, c.name as classroomName, c.grade
                FROM "StudentProfile" sp
                LEFT JOIN "Classroom" c ON sp.classroomId = c.id
                WHERE sp.userId = ?
            `,
                )
                .get(userId);
            if (user.studentProfile) {
                user.studentProfile.classroom = {
                    name: (user.studentProfile as any).classroomName,
                    grade: (user.studentProfile as any).grade,
                };
            }

            user.teacherProfile = db
                .prepare(
                    `
                SELECT tp.*, c.name as homeroomClassName
                FROM "TeacherProfile" tp
                LEFT JOIN "Classroom" c ON tp.homeroomClassId = c.id
                WHERE tp.userId = ?
            `,
                )
                .get(userId);
            if (user.teacherProfile) {
                user.teacherProfile.homeroomClass = { name: (user.teacherProfile as any).homeroomClassName };
            }

            // Family ties
            user.parentOf = db
                .prepare(
                    `
                SELECT u.id, u.firstName, u.lastName, u.email
                FROM "ParentStudent" ps
                JOIN "User" u ON ps.studentId = u.id
                WHERE ps.parentId = ?
            `,
                )
                .all(userId)
                .map((s) => ({ student: s }));

            user.childOf = db
                .prepare(
                    `
                SELECT u.id, u.firstName, u.lastName, u.email
                FROM "ParentStudent" ps
                JOIN "User" u ON ps.parentId = u.id
                WHERE ps.studentId = ?
            `,
                )
                .all(userId)
                .map((p) => ({ parent: p }));

            // Clean up password hash
            delete user.passwordHash;

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
            const id = randomUUID();
            const now = new Date().toISOString();

            transaction(() => {
                db.prepare(
                    'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, isSystemAdmin, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ).run(id, email, firstName, lastName, 'awaiting_activation', isSystemAdmin ? 1 : 0, now, now);

                if (schoolId && role) {
                    db.prepare(
                        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ).run(randomUUID(), id, schoolId, role, 'ACTIVE', now, now);

                    if (role === 'TEACHER') {
                        db.prepare('INSERT INTO "TeacherProfile" (id, userId) VALUES (?, ?)').run(randomUUID(), id);
                    }

                    if (role === 'STUDENT') {
                        db.prepare(
                            'INSERT INTO "StudentProfile" (id, userId, firstName, lastName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                        ).run(randomUUID(), id, firstName, lastName, now, now);
                    }
                }
            });

            return {
                content: [
                    {
                        type: 'text',
                        text:
                            `Uživatel '${firstName} ${lastName}' (${email}) byl úspěšně vytvořen s ID: ${id}` +
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
            const fields: string[] = [];
            const params: any[] = [];
            if (firstName !== undefined) {
                fields.push('firstName = ?');
                params.push(firstName);
            }
            if (lastName !== undefined) {
                fields.push('lastName = ?');
                params.push(lastName);
            }
            if (email !== undefined) {
                fields.push('email = ?');
                params.push(email);
            }
            if (isSystemAdmin !== undefined) {
                fields.push('isSystemAdmin = ?');
                params.push(isSystemAdmin ? 1 : 0);
            }

            if (fields.length === 0) {
                return { content: [{ type: 'text', text: 'Nebyly zadány žádné změny.' }] };
            }

            fields.push('updatedAt = ?');
            params.push(new Date().toISOString());
            params.push(userId);

            db.prepare(`UPDATE "User" SET ${fields.join(', ')} WHERE id = ?`).run(...params);

            return {
                content: [{ type: 'text', text: `Uživatel (${userId}) byl úspěšně aktualizován.` }],
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
            const now = new Date().toISOString();
            transaction(() => {
                const existing = db
                    .prepare('SELECT id FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?')
                    .get(userId, schoolId);

                if (existing) {
                    db.prepare('UPDATE "SchoolMembership" SET role = ?, status = ?, updatedAt = ? WHERE id = ?').run(
                        role,
                        status ?? 'ACTIVE',
                        now,
                        (existing as any).id,
                    );
                } else {
                    db.prepare(
                        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ).run(randomUUID(), userId, schoolId, role, status ?? 'ACTIVE', now, now);
                }

                // Create teacher/student profile if needed
                if (role === 'TEACHER') {
                    const prof = db.prepare('SELECT id FROM "TeacherProfile" WHERE userId = ?').get(userId);
                    if (!prof) {
                        db.prepare('INSERT INTO "TeacherProfile" (id, userId) VALUES (?, ?)').run(randomUUID(), userId);
                    }
                }

                if (role === 'STUDENT') {
                    const prof = db.prepare('SELECT id FROM "StudentProfile" WHERE userId = ?').get(userId);
                    if (!prof) {
                        const user = db
                            .prepare('SELECT firstName, lastName FROM "User" WHERE id = ?')
                            .get(userId) as any;
                        db.prepare(
                            'INSERT INTO "StudentProfile" (id, userId, firstName, lastName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                        ).run(randomUUID(), userId, user?.firstName ?? '', user?.lastName ?? '', now, now);
                    }
                }
            });

            return {
                content: [
                    { type: 'text', text: `Role ${role} byla úspěšně přiřazena uživateli ve škole ${schoolId}.` },
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
            db.prepare('DELETE FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?').run(userId, schoolId);
            return {
                content: [{ type: 'text', text: `Členství uživatele ${userId} ve škole ${schoolId} bylo odstraněno.` }],
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
            let sql = `SELECT * FROM "School" WHERE deletedAt IS NULL`;
            const params: any[] = [];
            if (search) {
                sql += ' AND name LIKE ?';
                params.push(`%${search}%`);
            }
            sql += ' ORDER BY name ASC';

            const schools = db.prepare(sql).all(...params) as any[];

            for (const school of schools) {
                const memberCount = (
                    db
                        .prepare('SELECT COUNT(*) as count FROM "SchoolMembership" WHERE schoolId = ?')
                        .get(school.id) as any
                ).count;
                const classCount = (
                    db.prepare('SELECT COUNT(*) as count FROM "Classroom" WHERE schoolId = ?').get(school.id) as any
                ).count;
                school._count = { members: memberCount, classrooms: classCount };
            }

            return { content: [{ type: 'text', text: JSON.stringify(schools, null, 2) }] };
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
            const school = db.prepare('SELECT * FROM "School" WHERE id = ?').get(schoolId) as any;
            if (!school) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Škola s ID '${schoolId}' nebyla nalezena.` }],
                };
            }

            school.classrooms = db
                .prepare('SELECT * FROM "Classroom" WHERE schoolId = ? ORDER BY grade ASC')
                .all(schoolId) as any[];
            for (const cls of school.classrooms) {
                cls._count = {
                    students: (
                        db
                            .prepare('SELECT COUNT(*) as count FROM "StudentProfile" WHERE classroomId = ?')
                            .get(cls.id) as any
                    ).count,
                };
            }

            school.academicYears = db
                .prepare('SELECT * FROM "AcademicYear" WHERE schoolId = ? ORDER BY startDate DESC')
                .all(schoolId);

            const membersByRole = db
                .prepare(
                    `
                SELECT role, COUNT(*) as count
                FROM "SchoolMembership"
                WHERE schoolId = ? AND status = 'ACTIVE'
                GROUP BY role
            `,
                )
                .all(schoolId);

            return { content: [{ type: 'text', text: JSON.stringify({ ...school, membersByRole }, null, 2) }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba při načítání školy: ${error.message}` }] };
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
            const classrooms = db
                .prepare('SELECT * FROM "Classroom" WHERE schoolId = ? ORDER BY grade ASC')
                .all(schoolId) as any[];
            for (const cls of classrooms) {
                const teacher = db
                    .prepare(
                        `
                    SELECT u.firstName, u.lastName
                    FROM "TeacherProfile" tp
                    JOIN "User" u ON tp.userId = u.id
                    WHERE tp.homeroomClassId = ?
                `,
                    )
                    .get(cls.id) as any;
                if (teacher) {
                    cls.homeroomTeacher = { user: teacher };
                }
                cls._count = {
                    students: (
                        db
                            .prepare('SELECT COUNT(*) as count FROM "StudentProfile" WHERE classroomId = ?')
                            .get(cls.id) as any
                    ).count,
                };
            }
            return { content: [{ type: 'text', text: JSON.stringify(classrooms, null, 2) }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba při načítání tříd: ${error.message}` }] };
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
            const now = new Date().toISOString();
            const created = transaction(() => {
                const results: any[] = [];
                const parentMap = new Map<string, string>();

                for (const u of users) {
                    let user = db.prepare('SELECT id FROM "User" WHERE email = ?').get(u.email) as any;
                    let userId = user?.id;

                    if (!userId) {
                        userId = randomUUID();
                        db.prepare(
                            'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        ).run(userId, u.email, u.firstName, u.lastName, 'awaiting_activation', now, now);

                        if (u.role === 'STUDENT') {
                            db.prepare(
                                'INSERT INTO "StudentProfile" (id, userId, firstName, lastName, classroomId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            ).run(randomUUID(), userId, u.firstName, u.lastName, u.classroomId || null, now, now);
                        }
                        if (u.role === 'TEACHER') {
                            db.prepare('INSERT INTO "TeacherProfile" (id, userId) VALUES (?, ?)').run(
                                randomUUID(),
                                userId,
                            );
                        }
                    }

                    // Membership
                    const exists = db
                        .prepare('SELECT id FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?')
                        .get(userId, schoolId);
                    if (!exists) {
                        db.prepare(
                            'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        ).run(randomUUID(), userId, schoolId, u.role, 'ACTIVE', now, now);
                    }

                    results.push({ id: userId, name: `${u.firstName} ${u.lastName}`, role: u.role, email: u.email });
                    if (u.role === 'PARENT') parentMap.set(u.email, userId);
                }

                // Links
                for (const u of users) {
                    if (u.role === 'STUDENT' && u.parentEmails) {
                        const studentId = results.find((r) => r.email === u.email)?.id;
                        if (!studentId) continue;
                        for (const pEmail of u.parentEmails) {
                            let pId = parentMap.get(pEmail);
                            if (!pId) {
                                const pUser = db.prepare('SELECT id FROM "User" WHERE email = ?').get(pEmail) as any;
                                pId = pUser?.id;
                            }
                            if (pId) {
                                const linkExists = db
                                    .prepare('SELECT id FROM "ParentStudent" WHERE parentId = ? AND studentId = ?')
                                    .get(pId, studentId);
                                if (!linkExists) {
                                    db.prepare(
                                        'INSERT INTO "ParentStudent" (id, parentId, studentId) VALUES (?, ?, ?)',
                                    ).run(randomUUID(), pId, studentId);
                                }
                            }
                        }
                    }
                }
                return results;
            });

            return { content: [{ type: 'text', text: `Úspěšně vytvořeno ${created.length} uživatelů.` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);
