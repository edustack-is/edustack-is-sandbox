/**
 * COMPREHENSIVE fix for corrupted @ApiOperation decorators.
 * Handles ALL patterns where a decorator was injected inside @ApiOperation string.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, '..', 'src');
const files = execSync('find ' + srcDir + ' -name "*.controller.ts"', {
  encoding: 'utf-8',
})
  .trim()
  .split('\n');

let fixed = 0;
for (const f of files) {
  let content = fs.readFileSync(f, 'utf-8');
  const original = content;

  // Fix: Remove duplicate ErrorResponseDto from api.dto import
  if (
    content.includes("from '../common/dto/error-response.dto'") &&
    content.includes("from '../common/dto/api.dto'")
  ) {
    content = content.replace(
      /import \{([^}]*)\} from '\.\.\/common\/dto\/api\.dto'/,
      (match, imports) => {
        const items = imports
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && s !== 'ErrorResponseDto');
        if (items.length === 0) return '// (removed empty import)';
        return `import { ${items.join(', ')} } from '../common/dto/api.dto'`;
      },
    );
  }

  // COMPREHENSIVE FIX: Find any @ApiOperation where the summary string
  // spans multiple lines (unterminated string). Pattern:
  //   @ApiOperation({ summary: 'text that doesn't end with ' })
  // followed by @ApiXxx decorators on subsequent lines, then closing ' })

  // Strategy: find all @ApiOperation and verify they are on a single line
  const lines = content.split('\n');
  const newLines = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check for corrupted @ApiOperation (line has @ApiOperation but no closing ')
    const opMatch = line.match(/^(\s+)@ApiOperation\(\{ summary: '([^']*$)/);
    if (opMatch) {
      // This is a corrupted multi-line @ApiOperation
      const indent = opMatch[1];
      const summary = opMatch[2];

      // Collect all following lines until we find the closing pattern
      const embeddedDecorators = [];
      i++;
      let closingFound = false;
      while (i < lines.length) {
        const nextLine = lines[i].trim();

        // Check for the closing ' }) pattern
        const closeMatch = nextLine.match(/^@Api\w+\(.*\)\}?\)?' ?\}\)/);
        if (closeMatch) {
          // Extract the embedded decorator
          const decoratorPart = nextLine
            .replace(/' ?\}\)$/, '')
            .replace(/\}'\s*\}\)$/, '}');
          if (decoratorPart.startsWith('@Api')) {
            embeddedDecorators.push(indent + decoratorPart);
          }
          closingFound = true;
          i++;
          break;
        }

        // Check if this line is an embedded @ApiXxx decorator
        if (nextLine.startsWith('@Api')) {
          // Clean up - remove any trailing ' }) that got merged
          const cleaned = nextLine.replace(/'\s*\}\)\s*$/, '');
          embeddedDecorators.push(indent + cleaned);
        } else if (nextLine === '') {
          // Skip blank lines
        } else {
          // Something unexpected — give up, output as-is
          break;
        }
        i++;
      }

      if (closingFound) {
        newLines.push(`${indent}@ApiOperation({ summary: '${summary}' })`);
        for (const dec of embeddedDecorators) {
          newLines.push(dec);
        }
        continue;
      }
    }

    newLines.push(line);
    i++;
  }

  content = newLines.join('\n');

  // Clean up excessive blank lines between decorators
  content = content.replace(/(@Api\w+\([^)]*\))\n\n(\s+@Api)/g, '$1\n$2');

  if (content !== original) {
    fs.writeFileSync(f, content, 'utf-8');
    console.log('Fixed: ' + path.relative(srcDir, f));
    fixed++;
  }
}
console.log(`\nTotal fixed: ${fixed}`);
