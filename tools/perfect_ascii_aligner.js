const fs = require('fs');
const path = require('path');

const targetDirs = [
    'c:/Users/vuman/Documents/Obsidian Vault/C++/knowledge_summary/knowledge',
    'c:/Users/vuman/Documents/Obsidian Vault/C++/knowledge_summary'
];

function normalizeDiagramBlock(blockLines) {
    if (blockLines.length < 3) return blockLines;

    // Detect if this is a box diagram
    const firstLine = blockLines[0].trim();
    const isBox = (firstLine.startsWith('┌') && firstLine.endsWith('┐')) ||
                  (firstLine.startsWith('+') && firstLine.endsWith('+'));
    
    if (!isBox) return blockLines;

    // Replace problematic wide emojis / arrows that break monospace font grids
    let processed = blockLines.map(line => {
        return line
            .replace(/⬇/g, '▼')
            .replace(/⬆/g, '▲')
            .replace(/❌/g, '[!]')
            .replace(/⚠️/g, '[!]')
            .replace(/✅/g, '[OK]')
            .replace(/◄──/g, '<──')
            .replace(/◀──/g, '<──');
    });

    // Find the standard width (usually first line length)
    const targetWidth = processed[0].length;

    return processed.map((line, idx) => {
        // Top and bottom borders or horizontal dividers
        if (idx === 0 || idx === processed.length - 1 || 
            (line.startsWith('├') && line.endsWith('┤')) ||
            (line.startsWith('+') && line.endsWith('+') && line.includes('-'))) {
            // If horizontal line has different length, match it
            if (line.length !== targetWidth) {
                const fillChar = line.includes('─') ? '─' : '-';
                const left = line[0];
                const right = line[line.length - 1];
                return left + fillChar.repeat(targetWidth - 2) + right;
            }
            return line;
        }

        // Content lines enclosed by │ ... │ or | ... |
        if ((line.startsWith('│') && line.endsWith('│')) || 
            (line.startsWith('|') && line.endsWith('|'))) {
            const leftChar = line[0];
            const rightChar = line[line.length - 1];
            let inner = line.slice(1, -1);

            const currentWidth = line.length;
            if (currentWidth < targetWidth) {
                // Pad with spaces before right border
                inner = inner + ' '.repeat(targetWidth - currentWidth);
                return leftChar + inner + rightChar;
            } else if (currentWidth > targetWidth) {
                // Trim trailing spaces in inner content if possible
                const excess = currentWidth - targetWidth;
                const trailingSpacesMatch = inner.match(/ +$/);
                if (trailingSpacesMatch && trailingSpacesMatch[0].length >= excess) {
                    inner = inner.slice(0, inner.length - excess);
                    return leftChar + inner + rightChar;
                }
            }
        }
        return line;
    });
}

function processFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');
    let modified = false;
    let newLines = [];
    let inCode = false;
    let codeBlock = [];
    let codeFence = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            if (!inCode) {
                inCode = true;
                codeFence = line;
                codeBlock = [];
            } else {
                inCode = false;
                const normalized = normalizeDiagramBlock(codeBlock);
                if (normalized.join('\n') !== codeBlock.join('\n')) {
                    modified = true;
                }
                newLines.push(codeFence);
                newLines.push(...normalized);
                newLines.push(line);
                codeFence = '';
                codeBlock = [];
            }
        } else if (inCode) {
            codeBlock.push(line);
        } else {
            newLines.push(line);
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
        console.log(`[ALIGNED] ${path.basename(filePath)}`);
    }
}

targetDirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    files.forEach(f => processFile(path.join(dir, f)));
});

console.log('Finished perfect alignment pass.');
