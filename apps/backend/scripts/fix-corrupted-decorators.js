/**
 * Fix corrupted @ApiOperation decorators where @ApiBody/@ApiResponse
 * was injected inside the summary string.
 * Also fix duplicate ErrorResponseDto imports.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, '..', 'src');
const files = execSync('find ' + srcDir + ' -name "*.controller.ts"', { encoding: 'utf-8' }).trim().split('\n');

let fixed = 0;
for (const f of files) {
    let content = fs.readFileSync(f, 'utf-8');
    const original = content;

    // Fix 1: Remove duplicate ErrorResponseDto from api.dto import
    if (content.includes("from '../common/dto/error-response.dto'") && content.includes("from '../common/dto/api.dto'")) {
        content = content.replace(
            /import \{([^}]*)\} from '\.\.\/common\/dto\/api\.dto'/,
            (match, imports) => {
                const items = imports.split(',').map(s => s.trim()).filter(s => s && s !== 'ErrorResponseDto');
                if (items.length === 0) return '// (removed empty import)';
                return `import { ${items.join(', ')} } from '../common/dto/api.dto'`;
            }
        );
    }

    // Fix 2: Multi-line corrupted @ApiOperation with embedded @ApiBody
    // e.g. @ApiOperation({ summary: 'Foo (bar)\n\n    @ApiBody({ type: XxxDto })' })
    const corruptedPattern = /@ApiOperation\(\{ summary: '([^'\n]*)\n\n\s+@Api(Body|Response)\(\{ ([^}]+)\}\)' \}\)/g;
    content = content.replace(corruptedPattern, (match, summary, apiType, args) => {
        return `@ApiOperation({ summary: '${summary}' })\n    @Api${apiType}({ ${args}})`;
    });

    // Fix 3: Clean up excessive blank lines between decorators
    content = content.replace(/(@Api\w+\([^)]*\))\n\n(\s+@Api)/g, '$1\n$2');

    if (content !== original) {
        fs.writeFileSync(f, content, 'utf-8');
        console.log('Fixed: ' + path.relative(srcDir, f));
        fixed++;
    }
}
console.log(`\nTotal fixed: ${fixed}`);
