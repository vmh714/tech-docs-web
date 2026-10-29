const fs = require('fs');
const path = require('path');

// Function to calculate visual display width of a string in terminal/monospace
function getDisplayWidth(str) {
    let width = 0;
    for (const ch of str) {
        const cp = ch.codePointAt(0);
        // Emoji / wide symbols (like ❌ U+274C, ⬇ U+2B07, etc)
        if (cp >= 0x1F300 && cp <= 0x1F9FF) width += 2; // emojis
        else if (cp === 0x274C || cp === 0x2705) width += 2; // ❌, ✅
        else if (cp >= 0x2E80 && cp <= 0x9FFF) width += 2; // CJK
        else if (cp >= 0xFE00 && cp <= 0xFE0F) width += 0; // variation selectors
        else width += 1;
    }
    return width;
}

const cppDir = 'c:/Users/vuman/Documents/Obsidian Vault/tech_docs_web/content/cpp';
const files = fs.readdirSync(cppDir).filter(f => f.endsWith('.md'));

console.log('--- AUDITING ALL C++ ASCII MAPS FOR BROKEN BORDERS ---');

files.forEach(file => {
    const fullPath = path.join(cppDir, file);
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
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
                const isAscii = blockLines.some(l => 
                    l.includes('┌') || l.includes('├') || l.includes('└') || 
                    l.includes('+--') || l.includes('|--') || l.includes('──') ||
                    (l.startsWith('|') && l.endsWith('|')) ||
                    (l.startsWith('│') && l.endsWith('│'))
                );
                if (isAscii && blockLines.length > 3) {
                    // Check if block has border characters on left & right
                    const boxedLines = blockLines.filter(l => 
                        (l.startsWith('│') && l.endsWith('│')) || 
                        (l.startsWith('|') && l.endsWith('|')) ||
                        l.startsWith('┌') || l.startsWith('├') || l.startsWith('└') ||
                        l.startsWith('+') || l.startsWith('.-')
                    );
                    if (boxedLines.length > 2) {
                        const widths = boxedLines.map(getDisplayWidth);
                        const minW = Math.min(...widths);
                        const maxW = Math.max(...widths);
                        if (maxW - minW > 0) {
                            console.log(`\n❌ MISALIGNED: ${file}:${startLine} (minW=${minW}, maxW=${maxW})`);
                            boxedLines.slice(0, 8).forEach(l => console.log(`  w=${getDisplayWidth(l)} | ${l}`));
                            if (boxedLines.length > 8) console.log('  ...');
                        }
                    }
                }
            }
        } else if (inBlock) {
            blockLines.push(line);
        }
    }
});
