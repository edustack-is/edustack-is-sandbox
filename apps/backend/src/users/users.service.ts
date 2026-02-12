import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { z } from 'zod';

const CreateUserSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.nativeEnum(UserRole),
});

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({
            data,
        });
    }

    async findAll(params: {
        skip?: number;
        take?: number;
        role?: UserRole;
        status?: UserStatus;
    }): Promise<{ data: User[]; total: number }> {
        const { skip, take, role, status } = params;
        const where: Prisma.UserWhereInput = {
            deletedAt: null,
            ...(role && { role }),
            ...(status && { status }),
        };

        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
                skip,
                take,
                where,
                include: {
                    studentProfile: true,
                    teacherProfile: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { data, total };
    }

    async findOne(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
            include: {
                studentProfile: true,
                teacherProfile: true,
                identities: true,
            },
        });
    }

    async importUsersFromCsv(fileBuffer: Buffer) {
        const results: any[] = [];
        const stream = Readable.from(fileBuffer);

        return new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                    const validUsers = [];
                    const errors = [];

                    for (const row of results) {
                        try {
                            // Map CSV columns to schema (assume headers: email, firstName, lastName, role)
                            const userDto = {
                                email: row.email,
                                firstName: row.firstName,
                                lastName: row.lastName,
                                role: row.role as UserRole,
                            };

                            const validated = CreateUserSchema.parse(userDto);

                            // Check existing
                            const existing = await this.prisma.user.findUnique({ where: { email: validated.email } });
                            if (existing) {
                                errors.push(`Email ${validated.email} already exists`);
                                continue;
                            }

                            validUsers.push({
                                ...validated,
                                status: UserStatus.PENDING,
                                // invitationToken will be generated separately or here?
                                // Prompt: "createMany nevrací ID... Prozatím stačí createMany a pozvánky se vygenerují v druhém kroku"
                            });
                        } catch (e) {
                            errors.push(`Invalid row: ${JSON.stringify(row)} - ${e.message}`);
                        }
                    }

                    if (validUsers.length > 0) {
                        await this.prisma.user.createMany({
                            data: validUsers,
                        });
                        // Ideally we would fetch them back and generate invitations, but createMany doesn't return IDs.
                        // For now, we assume admin will trigger "send invites" later or we iterate.
                    }

                    resolve({
                        imported: validUsers.length,
                        errors,
                    });
                })
                .on('error', (err) => reject(new BadRequestException('Failed to parse CSV')));
        });
    }
}
