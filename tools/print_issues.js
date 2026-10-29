const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/vuman/Documents/Obsidian Vault/tech_docs_web/content/cpp';

function inspectBlock(file, startLine, count) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    console.log(`\n================= ${file} around line ${startLine} =================`);
    for (let i = Math.max(0, startLine - 2); i < Math.min(lines.length, startLine + count); i++) {
        console.log(`${i+1} (len=${lines[i].length}): ${lines[i]}`);
    }
}

inspectBlock('02_oop_deep.md', 673, 22);
inspectBlock('06b_library_fundamentals.md', 270, 16);
inspectBlock('06d_ninja_build_system.md', 88, 16);
inspectBlock('07_debugging_profiling.md', 383, 18);
inspectBlock('10_exception_handling_ecu.md', 142, 16);
inspectBlock('11_multithreading_concurrency.md', 157, 18);
inspectBlock('11_multithreading_concurrency.md', 239, 20);
inspectBlock('11_multithreading_concurrency.md', 455, 18);
inspectBlock('11_multithreading_concurrency.md', 510, 18);
inspectBlock('16_gtest_gmock_embedded_testing.md', 39, 18);
