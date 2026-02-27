const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'apps/backend/test');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.e2e-spec.ts') && f !== 'app.e2e-spec.ts');

for (const file of files) {
    const fp = path.join(dir, file);
    let content = fs.readFileSync(fp, 'utf8');
    content = content.replace(/try \{ await app\.get\(PrismaService\)\.\(\); \} catch\(e\)\{\}/g, 'try { await app.get(PrismaService).$disconnect(); } catch(e){}');
    fs.writeFileSync(fp, content);
}
