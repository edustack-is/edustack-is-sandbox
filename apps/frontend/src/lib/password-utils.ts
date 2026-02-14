export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
    strength: number; // 0-4
}

export const validatePassword = (password: string): PasswordValidationResult => {
    const errors: string[] = [];
    let strength = 0;

    if (password.length < 8) {
        errors.push('Heslo musí mít alespoň 8 znaků.');
    } else {
        strength += 1;
    }

    // BCrypt limit is technically 72 bytes, but 72 characters is a safe limit for UTF-8
    if (password.length > 72) {
        errors.push('Heslo je příliš dlouhé (maximálně 72 znaků).');
    }

    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasLowercase) errors.push('Heslo musí obsahovat alespoň jedno malé písmeno.');
    if (!hasUppercase) errors.push('Heslo musí obsahovat alespoň jedno velké písmeno.');
    if (!hasNumber) errors.push('Heslo musí obsahovat alespoň jednu číslici.');

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
        case 0: return 'bg-gray-200';
        case 1: return 'bg-red-500';
        case 2: return 'bg-orange-500';
        case 3: return 'bg-yellow-500';
        case 4: return 'bg-green-500';
        default: return 'bg-gray-200';
    }
};

export const getStrengthLabel = (strength: number) => {
    switch (strength) {
        case 0: return 'Příliš krátké';
        case 1: return 'Slabé';
        case 2: return 'Průměrné';
        case 3: return 'Dobré';
        case 4: return 'Silné';
        default: return '';
    }
};
