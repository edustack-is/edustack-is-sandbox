export interface ExistingAdminDto {
    type: 'EXISTING';
    userId: string;
}

export interface NewAdminDto {
    type: 'NEW';
    firstName: string;
    lastName: string;
    email: string;
}

export type AdminDto = ExistingAdminDto | NewAdminDto;

export interface CreateSchoolDto {
    schoolName: string;
    address?: string;
    admin: AdminDto;
}

export function validateCreateSchoolDto(body: any): CreateSchoolDto {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body is required');
    }
    if (!body.schoolName || typeof body.schoolName !== 'string') {
        throw new Error('schoolName is required and must be a string');
    }
    if (!body.admin || typeof body.admin !== 'object') {
        throw new Error('admin object is required');
    }

    const admin = body.admin;

    if (admin.type === 'EXISTING') {
        if (!admin.userId || typeof admin.userId !== 'string') {
            throw new Error('admin.userId is required when type is EXISTING');
        }
        return {
            schoolName: body.schoolName,
            address: body.address,
            admin: { type: 'EXISTING', userId: admin.userId },
        };
    }

    if (admin.type === 'NEW') {
        if (!admin.firstName || typeof admin.firstName !== 'string') {
            throw new Error('admin.firstName is required when type is NEW');
        }
        if (!admin.lastName || typeof admin.lastName !== 'string') {
            throw new Error('admin.lastName is required when type is NEW');
        }
        if (!admin.email || typeof admin.email !== 'string') {
            throw new Error('admin.email is required when type is NEW');
        }
        return {
            schoolName: body.schoolName,
            address: body.address,
            admin: {
                type: 'NEW',
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
            },
        };
    }

    throw new Error("admin.type must be 'EXISTING' or 'NEW'");
}
