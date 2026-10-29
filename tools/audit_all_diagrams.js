const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/vuman/Documents/Obsidian Vault/C++/knowledge_summary/knowledge';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

let totalDiagrams = 0;
let problematicDiagrams = [];

files.forEach(file => {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    let inBlock = false;
    let block = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('```')) {
            if (!inBlock) {
                inBlock = true;
                block = [];
                startLine = i + 1;
            } else {
                inBlock = false;
                const isDiagram = block.some(l => 
                    l.includes('┌') || l.includes('├') || l.includes('└') || 
                    l.includes('│') || l.includes('──') || l.includes('+--') ||
                    (l.includes('|') && l.includes('--'))
                );
                if (isDiagram && block.length >= 3) {
                    totalDiagrams++;
                    // Check for issues:
                    // 1. Double pipes or ragged edges
                    // 2. Mismatched line lengths in boxed diagrams
                    // 3. Mixed characters (e.g. + and │, or L--J)
                    const issues = [];
                    for (let j = 0; j < block.length; j++) {
                        const l = block[j];
                        if (/\|\s*\|\s*\|/.test(l)) issues.push(`Line ${j+1}: Triple pipe '${l.trim()}'`);
                        else if (/\|\s*\|\s*$/.test(l)) issues.push(`Line ${j+1}: Double pipe at end '${l.trim()}'`);
                        if (/L--+J/.test(l)) issues.push(`Line ${j+1}: ASCII L-J corner '${l.trim()}'`);
                    }

                    // Check border alignment if it is a fully boxed diagram
                    const borderLines = block.filter(l => l.startsWith('│') || l.startsWith('┌') || l.startsWith('├') || l.startsWith('└') || l.startsWith('|') || l.startsWith('+'));
                    if (borderLines.length > 3) {
                        const lens = borderLines.map(l => l.length);
                        const min = Math.min(...lens);
                        const max = Math.max(...lens);
                        if (max - min > 1) {
                            issues.push(`Unequal border lengths: min=${min}, max=${max}`);
                        }
                    }

                    if (issues.length > 0) {
                        problematicDiagrams.push({
                            file: file,
                            startLine: startLine,
                            issues: issues,
                            sample: block.slice(0, 10).join('\n')
                        });
                    }
                }
            }
        } else if (inBlock) {
            block.push(line);
        }
    }
});

console.log(`Total diagrams scanned: ${totalDiagrams}`);
console.log(`Diagrams with issues: ${problematicDiagrams.length}`);
problematicDiagrams.forEach((p, idx) => {
    console.log(`\n=== Issue ${idx+1}: ${p.file}:${p.startLine} ===`);
    p.issues.forEach(iss => console.log('  ⚠️ ' + iss));
    console.log('Sample:\n' + p.sample);
});
