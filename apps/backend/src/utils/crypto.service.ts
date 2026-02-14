import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CryptoService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;

    constructor(private configService: ConfigService) {
        const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') ||
            this.configService.get<string>('SETTINGS_ENCRYPTION_KEY') ||
            'edu-stack-default-key-change-me!!';

        // Ensure key is exactly 32 bytes
        this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    }

    encrypt(text: string): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        // Format: iv:authTag:encryptedContent
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    decrypt(encryptedText: string): string {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted text format');
        }

        const [ivHex, authTagHex, encryptedContent] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}
