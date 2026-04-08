import { server } from "../server.js";
import { prisma } from "../db.js";
import { z } from "zod";

server.tool(
    "create_school",
    "Vytvoří novou školu v systému EduStack.",
    {
        name: z.string().describe("Název školy"),
        address: z.string().optional().describe("Adresa školy"),
    },
    async ({ name, address }: { name: string; address?: string }) => {
        try {
            // Check uniqueness among non-deleted schools
            const existing = await prisma.school.findFirst({
                where: { name, deletedAt: null },
            });
            if (existing) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Škola s názvem '${name}' již existuje.` }],
                };
            }

            const school = await prisma.school.create({
                data: {
                    name,
                    address,
                },
            });
            return {
                content: [{ type: "text", text: `Škola '${name}' byla úspěšně vytvořena s ID: ${school.id}` }],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text", text: `Chyba při vytváření školy: ${error.message}` }],
            };
        }
    }
);

server.tool(
    "create_student_and_parent",
    "Vytvoří studenta a volitelně jeho rodiče v rámci jedné transakce.",
    {
        schoolId: z.string().describe("ID školy"),
        classroomId: z.string().describe("ID třídy"),
        student: z.object({
            firstName: z.string(),
            lastName: z.string(),
            email: z.string(),
        }),
        parents: z.array(z.object({
            firstName: z.string(),
            lastName: z.string(),
            email: z.string(),
        })).optional(),
    },
    async ({ schoolId, classroomId, student, parents }: {
        schoolId: string;
        classroomId: string;
        student: { firstName: string; lastName: string; email: string };
        parents?: { firstName: string; lastName: string; email: string }[];
    }) => {
        try {
            const result = await prisma.$transaction(async (tx) => {
                // Create student user
                const studentUser = await tx.user.create({
                    data: {
                        email: student.email,
                        firstName: student.firstName,
                        lastName: student.lastName,
                        passwordHash: "awaiting_activation",
                        schoolMemberships: {
                            create: {
                                schoolId,
                                role: "STUDENT",
                                status: "ACTIVE",
                            },
                        },
                        studentProfile: {
                            create: {
                                firstName: student.firstName,
                                lastName: student.lastName,
                                classroomId,
                            },
                        },
                    },
                });

                const createdParents = [];
                if (parents && parents.length > 0) {
                    for (const p of parents) {
                        const parentUser = await tx.user.create({
                            data: {
                                email: p.email,
                                firstName: p.firstName,
                                lastName: p.lastName,
                                passwordHash: "awaiting_activation",
                                schoolMemberships: {
                                    create: {
                                        schoolId,
                                        role: "PARENT",
                                        status: "ACTIVE",
                                    },
                                },
                            },
                        });

                        // Link parent to student
                        await tx.parentStudent.create({
                            data: {
                                parentId: parentUser.id,
                                studentId: studentUser.id,
                            },
                        });
                        createdParents.push(parentUser.id);
                    }
                }

                return { studentId: studentUser.id, parentIds: createdParents };
            });

            return {
                content: [{ type: "text", text: `Student i rodiče byli úspěšně vytvořeni. Student ID: ${result.studentId}` }],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text", text: `Chyba při vytváření studenta/rodičů: ${error.message}` }],
            };
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// ROOMS (UČEBNY)
// ═══════════════════════════════════════════════════════════════

server.tool(
    "create_room",
    "Vytvoří novou učebnu/místnost v dané škole.",
    {
        schoolId: z.string().describe("ID školy"),
        name: z.string().describe("Název učebny, např. 'A101', 'PC učebna'"),
        capacity: z.number().int().optional().describe("Kapacita (výchozí: 30)"),
        isComputerLab: z.boolean().optional().describe("Je to počítačová učebna?"),
        specialEquipment: z.array(z.string()).optional().describe("Speciální vybavení, např. ['projektor', 'interaktivní tabule']"),
    },
    async ({ schoolId, name, capacity, isComputerLab, specialEquipment }) => {
        try {
            const existing = await prisma.room.findUnique({
                where: { name_schoolId: { name, schoolId } },
            });
            if (existing) {
                return { isError: true, content: [{ type: "text", text: `Místnost '${name}' v této škole již existuje (ID: ${existing.id}).` }] };
            }

            const room = await prisma.room.create({
                data: {
                    name,
                    capacity: capacity || 30,
                    isComputerLab: isComputerLab || false,
                    specialEquipment: specialEquipment || [],
                    schoolId,
                },
            });

            return {
                content: [{
                    type: "text",
                    text: `Učebna '${name}' vytvořena (kapacita: ${room.capacity}${room.isComputerLab ? ', PC učebna' : ''}). ID: ${room.id}`,
                }],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: "text", text: `Chyba: ${error.message}` }] };
        }
    }
);

server.tool(
    "list_rooms",
    "Vypíše všechny učebny/místnosti v dané škole.",
    {
        schoolId: z.string().describe("ID školy"),
    },
    async ({ schoolId }) => {
        try {
            const rooms = await prisma.room.findMany({
                where: { schoolId },
                orderBy: { name: "asc" },
            });

            if (rooms.length === 0) {
                return { content: [{ type: "text", text: "Škola nemá žádné učebny." }] };
            }

            const lines = rooms.map(r => {
                const extras = [];
                if (r.isComputerLab) extras.push("PC");
                if (r.specialEquipment && Array.isArray(r.specialEquipment) && (r.specialEquipment as string[]).length > 0) {
                    extras.push((r.specialEquipment as string[]).join(", "));
                }
                return `- ${r.name} (kapacita: ${r.capacity})${extras.length > 0 ? ` [${extras.join(", ")}]` : ''} | ID: ${r.id}`;
            });

            return { content: [{ type: "text", text: `Učebny (${rooms.length}):\n${lines.join("\n")}` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: "text", text: `Chyba: ${error.message}` }] };
        }
    }
);
