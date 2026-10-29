const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/vuman/Documents/Obsidian Vault/C++/knowledge_summary/knowledge';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

console.log('Scanning ' + files.length + ' files in ' + dir);

files.forEach(file => {
    const fullPath = path.join(dir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    let inBlock = false;
    let blockLang = '';
    let blockLines = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('```')) {
            if (!inBlock) {
                inBlock = true;
                blockLang = trimmed.slice(3).trim();
                blockLines = [];
                startLine = i + 1;
            } else {
                inBlock = false;
                // Check if this block looks like an ASCII diagram
                const text = blockLines.join('\n');
                const isAscii = blockLines.some(l => l.includes('┌') || l.includes('│') || l.includes('+--') || l.includes('|--') || l.includes('.--'));
                if (isAscii) {
                    // Check if lines have broken lengths or trailing pipes
                    const lengths = blockLines.map(l => l.length);
                    const minLen = Math.min(...lengths);
                    const maxLen = Math.max(...lengths);
                    const hasUnevenBorders = blockLines.some(l => /\|\s*\|\s*\|/.test(l) || /L--+J/.test(l));
                    if (hasUnevenBorders || (maxLen - minLen > 5 && blockLines.some(l => l.endsWith('|') || l.endsWith('│')))) {
                        console.log(`[SUSPICIOUS] ${file}:${startLine} (min=${minLen}, max=${maxLen})`);
                        console.log(blockLines.slice(0, 8).join('\n'));
                        console.log('...\n');
                    }
                }
            }
        } else if (inBlock) {
            blockLines.push(line);
        }
    }
});
