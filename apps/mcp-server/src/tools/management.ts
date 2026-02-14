import { server } from "../server.js";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

server.tool(
    "create_school",
    "Vytvoří novou školu v systému EduStack.",
    {
        name: z.string().describe("Název školy"),
        address: z.string().optional().describe("Adresa školy"),
    },
    async ({ name, address }: { name: string; address?: string }) => {
        try {
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
