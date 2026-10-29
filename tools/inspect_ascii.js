const fs = require('fs');
const code = fs.readFileSync('c:/Users/vuman/Documents/Obsidian Vault/tech_docs_web/js/docs_data.js', 'utf8');
const manifestMatch = code.match(/const DOCS_MANIFEST = (\[[\s\S]*?\]);\s*(?:const|var|let) DOCS_CONTENT/);
if (manifestMatch) {
    const manifest = JSON.parse(manifestMatch[1]);
    for (const cat of manifest) {
        for (const item of cat.items) {
            if (item.id === 'cpp_01_memory_model_pointers') {
                console.log('Found item:', item);
            }
        }
    }
} else {
    console.log('Manifest not parsed');
}
