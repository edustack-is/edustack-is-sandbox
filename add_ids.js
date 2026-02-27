const fs = require('fs');
const file = './docs/funkcni-analyza.md';
let content = fs.readFileSync(file, 'utf8');

let counter = 1;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('| Funkce | Stav | Poznámka |')) {
    lines[i] = '| ID | Funkce | Stav | Poznámka |';
  } else if (line.startsWith('|--------|:----:|----------|')) {
    lines[i] = '|:---|--------|:----:|----------|';
  } else if (line.startsWith('| ') && !line.startsWith('| Funkce |') && !line.startsWith('| Oblast |') && !line.startsWith('|--------') && !line.includes('Celkem funkcí') && !line.includes('**Celkem**') && !line.startsWith('| Method | Path |')) {
    // This looks like a feature row
    const id = `F${counter.toString().padStart(3, '0')}`;
    lines[i] = `| ${id} ` + line;
    counter++;
  } else if (line.startsWith('| Oblast | Celkem funkcí |')) {
    // skip the summary table
  }
}

fs.writeFileSync(file, lines.join('\n'));
console.log(`Added IDs up to F${counter - 1}`);
