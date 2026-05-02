import { server } from '../server.js';
import { db, transaction } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

server.tool(
    'create_school',
    'Vytvoří novou školu v systému EduStack.',
    {
        name: z.string().describe('Název školy'),
        address: z.string().optional().describe('Adresa školy'),
    },
    async ({ name, address }: { name: string; address?: string }) => {
        try {
            const existing = db.prepare('SELECT id FROM "School" WHERE name = ? AND deletedAt IS NULL').get(name);
            if (existing) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Škola s názvem '${name}' již existuje.` }],
                };
            }

            const id = randomUUID();
            const now = new Date().toISOString();
            db.prepare('INSERT INTO "School" (id, name, address, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)').run(
                id,
                name,
                address || null,
                now,
                now,
            );

            return {
                content: [{ type: 'text', text: `Škola '${name}' byla úspěšně vytvořena s ID: ${id}` }],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při vytváření školy: ${error.message}` }],
            };
        }
    },
);

server.tool(
    'create_student_and_parent',
    'Vytvoří studenta a volitelně jeho rodiče v rámci jedné transakce.',
    {
        schoolId: z.string().describe('ID školy'),
        classroomId: z.string().describe('ID třídy'),
        student: z.object({
            firstName: z.string(),
            lastName: z.string(),
            email: z.string(),
        }),
        parents: z
            .array(
                z.object({
                    firstName: z.string(),
                    lastName: z.string(),
                    email: z.string(),
                }),
            )
            .optional(),
    },
    async ({
        schoolId,
        classroomId,
        student,
        parents,
    }: {
        schoolId: string;
        classroomId: string;
        student: { firstName: string; lastName: string; email: string };
        parents?: { firstName: string; lastName: string; email: string }[];
    }) => {
        try {
            const result = transaction(() => {
                const now = new Date().toISOString();
                const studentId = randomUUID();

                // Create student user
                db.prepare(
                    'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ).run(studentId, student.email, student.firstName, student.lastName, 'awaiting_activation', now, now);

                // Create membership
                db.prepare(
                    'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ).run(randomUUID(), studentId, schoolId, 'STUDENT', 'ACTIVE', now, now);

                // Create student profile
                db.prepare(
                    'INSERT INTO "StudentProfile" (id, userId, firstName, lastName, classroomId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ).run(randomUUID(), studentId, student.firstName, student.lastName, classroomId, now, now);

                const createdParents = [];
                if (parents && parents.length > 0) {
                    for (const p of parents) {
                        const parentId = randomUUID();
                        db.prepare(
                            'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        ).run(parentId, p.email, p.firstName, p.lastName, 'awaiting_activation', now, now);

                        db.prepare(
                            'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        ).run(randomUUID(), parentId, schoolId, 'PARENT', 'ACTIVE', now, now);

                        // Link parent to student
                        db.prepare('INSERT INTO "ParentStudent" (id, parentId, studentId) VALUES (?, ?, ?)').run(
                            randomUUID(),
                            parentId,
                            studentId,
                        );
                        createdParents.push(parentId);
                    }
                }

                return { studentId, parentIds: createdParents };
            });

            return {
                content: [
                    { type: 'text', text: `Student i rodiče byli úspěšně vytvořeni. Student ID: ${result.studentId}` },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při vytváření studenta/rodičů: ${error.message}` }],
            };
        }
    },
);

// ═══════════════════════════════════════════════════════════════
// ROOMS (UČEBNY)
// ═══════════════════════════════════════════════════════════════

server.tool(
    'create_room',
    'Vytvoří novou učebnu/místnost v dané škole.',
    {
        schoolId: z.string().describe('ID školy'),
        name: z.string().describe("Název učebny, např. 'A101', 'PC učebna'"),
        capacity: z.number().int().optional().describe('Kapacita (výchozí: 30)'),
        isComputerLab: z.boolean().optional().describe('Je to počítačová učebna?'),
        specialEquipment: z
            .array(z.string())
            .optional()
            .describe("Speciální vybavení, např. ['projektor', 'interaktivní tabule']"),
    },
    async ({ schoolId, name, capacity, isComputerLab, specialEquipment }) => {
        try {
            const existing = db.prepare('SELECT id FROM "Room" WHERE name = ? AND schoolId = ?').get(name, schoolId);
            if (existing) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `Místnost '${name}' v této škole již existuje (ID: ${(existing as any).id}).`,
                        },
                    ],
                };
            }

            const id = randomUUID();
            const now = new Date().toISOString();
            db.prepare(
                'INSERT INTO "Room" (id, name, capacity, isComputerLab, specialEquipment, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ).run(
                id,
                name,
                capacity || 30,
                isComputerLab ? 1 : 0,
                JSON.stringify(specialEquipment || []),
                schoolId,
                now,
                now,
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: `Učebna '${name}' vytvořena (kapacita: ${capacity || 30}${isComputerLab ? ', PC učebna' : ''}). ID: ${id}`,
                    },
                ],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

server.tool(
    'list_rooms',
    'Vypíše všechny učebny/místnosti v dané škole.',
    {
        schoolId: z.string().describe('ID školy'),
    },
    async ({ schoolId }) => {
        try {
            const rooms = db
                .prepare('SELECT * FROM "Room" WHERE schoolId = ? ORDER BY name ASC')
                .all(schoolId) as any[];

            if (rooms.length === 0) {
                return { content: [{ type: 'text', text: 'Škola nemá žádné učebny.' }] };
            }

            const lines = rooms.map((r) => {
                const extras = [];
                if (r.isComputerLab) extras.push('PC');
                const specialEquipment = typeof r.specialEquipment === 'string' ? JSON.parse(r.specialEquipment) : [];
                if (specialEquipment && Array.isArray(specialEquipment) && specialEquipment.length > 0) {
                    extras.push(specialEquipment.join(', '));
                }
                return `- ${r.name} (kapacita: ${r.capacity})${extras.length > 0 ? ` [${extras.join(', ')}]` : ''} | ID: ${r.id}`;
            });

            return { content: [{ type: 'text', text: `Učebny (${rooms.length}):\n${lines.join('\n')}` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);
