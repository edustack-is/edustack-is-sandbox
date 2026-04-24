export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[]; // i18n keys
    strength: number; // 0-4
}

export const validatePassword = (password: string): PasswordValidationResult => {
    const errors: string[] = [];
    let strength = 0;

    if (password.length < 8) {
        errors.push('password.min_length');
    } else {
        strength += 1;
    }

    // BCrypt limit is technically 72 bytes, but 72 characters is a safe limit for UTF-8
    if (password.length > 72) {
        errors.push('password.max_length');
    }

    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasLowercase) errors.push('password.needs_lowercase');
    if (!hasUppercase) errors.push('password.needs_uppercase');
    if (!hasNumber) errors.push('password.needs_number');

    if (password.length >= 8) {
        if (hasLowercase) strength += 1;
        if (hasUppercase) strength += 1;
        if (hasNumber) strength += 1;
        if (hasSpecial) strength += 1;
    }

    // Cap strength at 4
    const finalStrength = Math.min(strength, 4);

    return {
        isValid: errors.length === 0,
        errors,
        strength: finalStrength,
    };
};

export const getStrengthColor = (strength: number) => {
    switch (strength) {
        case 0:
            return 'bg-gray-200';
        case 1:
            return 'bg-red-500';
        case 2:
            return 'bg-orange-500';
        case 3:
            return 'bg-yellow-500';
        case 4:
            return 'bg-green-500';
        default:
            return 'bg-gray-200';
    }
};

export const getStrengthLabel = (strength: number): string => {
    switch (strength) {
        case 0:
            return 'password.strength_too_short';
        case 1:
            return 'password.strength_weak';
        case 2:
            return 'password.strength_fair';
        case 3:
            return 'password.strength_good';
        case 4:
            return 'password.strength_strong';
        default:
            return '';
    }
};
