const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(process.cwd(), 'data');
const dirs = [dataDir];
const results = [];

for (const dir of dirs) {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
        for (const file of files) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
                results.push({ filename: file, name: content.meta?.name || file });
            } catch (e) {
                console.error('Error parsing', file, e);
            }
        }
    }
}
console.log(results);
