const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../apps/backend/prisma/schema.prisma');
const provider = process.env.DB_PROVIDER || 'sqlite';

if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found at ${schemaPath}`);
  process.exit(1);
}

let content = fs.readFileSync(schemaPath, 'utf8');

// Replace the provider line specifically inside the datasource db block
const updatedContent = content.replace(
  /(datasource\s+db\s+\{[\s\S]*?provider\s*=\s*")[^"]*(")/,
  `$1${provider}$2`
);

if (content !== updatedContent) {
  fs.writeFileSync(schemaPath, updatedContent);
  console.log(`✅ Prisma schema updated to use provider: "${provider}"`);
} else {
  console.log(`ℹ️ Prisma schema already using provider: "${provider}"`);
}
