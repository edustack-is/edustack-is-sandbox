import { BadRequestException } from '@nestjs/common';

/**
 * Server-side password policy enforcement.
 * Mirrors the frontend validations in password-utils.ts.
 *
 * Rules:
 *  - Minimum 8 characters
 *  - Maximum 72 characters (bcrypt limit)
 *  - At least 1 lowercase letter
 *  - At least 1 uppercase letter
 *  - At least 1 number
 */
export function validatePasswordStrength(password: string): void {
    const errors: string[] = [];

    if (!password || password.length < 8) {
        errors.push('Password must be at least 8 characters long.');
    }

    if (password && password.length > 72) {
        errors.push('Password must not exceed 72 characters (bcrypt limit).');
    }

    if (password && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter.');
    }

    if (password && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter.');
    }

    if (password && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number.');
    }

    if (errors.length > 0) {
        throw new BadRequestException(errors);
    }
}
