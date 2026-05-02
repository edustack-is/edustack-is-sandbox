import { GoogleGenerativeAI } from '@google/generative-ai';
import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function decrypt(text: string): string {
  const ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function main() {
  let dbPath = null;
  const wranglerDir = path.join(
    __dirname,
    '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
  );
  if (fs.existsSync(wranglerDir)) {
    const dbFile = fs
      .readdirSync(wranglerDir)
      .find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
    if (dbFile) dbPath = path.join(wranglerDir, dbFile);
  }

  if (!dbPath) {
    console.error('❌ Database not found');
    return;
  }

  console.log(`📂 Using database: \${dbPath}`);
  const db = new Database(dbPath);

  const secret = db
    .prepare(
      "SELECT value FROM SystemSecret WHERE type = 'AI' AND service = 'google' AND key = 'API_KEY'",
    )
    .get() as any;

  if (!secret) {
    console.error('❌ No API key found in database');
    db.close();
    return;
  }

  const apiKey = decrypt(secret.value);
  console.log('🔍 Fetching available models...');
  const genAI = new GoogleGenerativeAI(apiKey);

  const testModel = async (name: string) => {
    try {
      const model = genAI.getGenerativeModel({ model: name });
      await model.generateContent('hi');
      console.log(`✅ \${name} is AVAILABLE`);
      return true;
    } catch (e: any) {
      console.log(`❌ \${name} is NOT available: \${e.message}`);
      return false;
    }
  };

  await testModel('gemini-1.5-flash');
  await testModel('gemini-1.5-flash-latest');
  await testModel('gemini-pro');
  await testModel('gemini-1.0-pro');
  await testModel('gemini-2.0-flash-exp');

  db.close();
}

main();
