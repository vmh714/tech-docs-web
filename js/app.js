/* ==========================================================================
   TECHNICAL DOCS READER - MOBILE ENGINE (app.js)
   Zero-Dependency, Pure Vanilla JS, Mobile-First Performance
   ========================================================================== */

let currentDocId = null;
let currentDocList = []; // Flattened list of all documents for prev/next
let headingsList = []; // TOC headings for current document

/* ==========================================================================
   1. UTILITIES & HTML ESCAPING
   ========================================================================== */
function escapeHtml(str)
{
    if (!str)
    {
        return '';
    }
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function slugify(text)
{
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u00C0-\u024F\u1EA0-\u1EF9\-]+/g, '') // Giữ ký tự tiếng Việt
        .replace(/\-\-+/g, '-');
}

/* ==========================================================================
   2. SYNTAX HIGHLIGHTER (C++, BASH, TERMINAL)
   ========================================================================== */
function highlightCpp(code)
{
    if (!code)
    {
        return '';
    }
    let s = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const tokens = [];
    const save = (cls, content) =>
    {
        const idx = tokens.length;
        tokens.push('<span class="' + cls + '">' + content + '</span>');
        return '___TOK_' + idx + '___';
    };

    // 1. Comments
    s = s.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, m => save('tok-comment', m));
    // 2. Strings & Characters
    s = s.replace(/(".*?"|'(\\.|[^\\'])*?')/g, m => save('tok-string', m));
    // 3. Preprocessor (#include, #define, #pragma...)
    s = s.replace(/(#[a-zA-Z_]+[^\n]*)/g, m => save('tok-preproc', m));
    // 4. Numbers (Hex, float, int)
    s = s.replace(/\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:f|u|l|ul|ll)?)\b/gi, m => save('tok-num', m));
    // 5. C++ Keywords
    const kwRegex = /\b(alignas|alignof|auto|bool|break|case|catch|class|concept|const|constexpr|consteval|constinit|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|nullptr|operator|override|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/g;
    s = s.replace(kwRegex, m => save('tok-kw', m));
    // 6. Types / std
    const typeRegex = /\b(std::[a-zA-Z0-9_:]+|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t|ssize_t|intptr_t|uintptr_t)\b/g;
    s = s.replace(typeRegex, m => save('tok-type', m));

    for (let i = 0; i < tokens.length; i++)
    {
        s = s.replace('___TOK_' + i + '___', tokens[i]);
    }
    return s;
}

function highlightBash(code)
{
    if (!code)
    {
        return '';
    }
    let s = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const tokens = [];
    const save = (cls, content) =>
    {
        const idx = tokens.length;
        tokens.push('<span class="' + cls + '">' + content + '</span>');
        return '___TOK_' + idx + '___';
    };

    // Comments
    s = s.replace(/(#[^\n]*)/g, m => save('tok-comment', m));
    // Strings
    s = s.replace(/(".*?"|'.*?')/g, m => save('tok-string', m));
    // Commands & Tools
    const cmdRegex = /\b(sudo|apt|apt-get|git|make|cmake|ninja|gcc|g\+\+|clang|clang\+\+|ls|cd|pwd|mkdir|rm|cp|mv|chmod|chown|cat|grep|find|sed|awk|tar|ssh|gdb|valgrind|strace|systemctl|dmesg|uname|echo|export|source)\b/g;
    s = s.replace(cmdRegex, m => save('tok-kw', m));
    // Flags
    s = s.replace(/(\s-[a-zA-Z0-9_\-]+|\s--[a-zA-Z0-9_\-]+)/g, m => save('tok-type', m));

    for (let i = 0; i < tokens.length; i++)
    {
        s = s.replace('___TOK_' + i + '___', tokens[i]);
    }
    return s;
}

/* ==========================================================================
   3. INLINE MARKDOWN PARSER
   ========================================================================== */
function renderInline(str)
{
    if (!str)
    {
        return '';
    }
    let s = escapeHtml(str);

    // Markdown Links [Text](URL)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, text, url)
    {
        // Handle internal doc jump
        if (url.endsWith('.md'))
        {
            const cleanTarget = url.split('/').pop().replace('.md', '');
            return `<a href="javascript:void(0)" onclick="handleInternalLink('${cleanTarget}')" class="doc-internal-link">📄 ${text}</a>`;
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // Auto-link standalone markdown file references (e.g. ch01_history_and_standards.md)
    s = s.replace(/\b(ch\d+_[a-zA-Z0-9_\-]+\.md)\b/g, function(match, filename)
    {
        const cleanTarget = filename.replace('.md', '');
        return `<a href="javascript:void(0)" onclick="handleInternalLink('${cleanTarget}')" class="doc-internal-link">📄 ${filename}</a>`;
    });

    s = s.replace(/\b(\d{2}_[a-zA-Z0-9_\-]+\.md)\b/g, function(match, filename)
    {
        const cleanTarget = filename.replace('.md', '');
        return `<a href="javascript:void(0)" onclick="handleInternalLink('${cleanTarget}')" class="doc-internal-link">📄 ${filename}</a>`;
    });

    // Inline Code `code`
    s = s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold **text** or __text__
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic *text* or _text_
    s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // Complexity badges $O(1)$, $O(N)$
    s = s.replace(/\$(O\([^)]*\))\$/g, '<span class="complexity-badge">$1</span>');

    // Arrows
    s = s.replace(/\s*--&gt;\s*/g, ' ➔ ').replace(/\s*-&gt;\s*/g, ' ➔ ');
    s = s.replace(/\s*==&gt;\s*/g, ' ➔ ').replace(/\s*=&gt;\s*/g, ' ➔ ');

    return s;
}

/* ==========================================================================
   4. FULL BLOCK MARKDOWN PARSER (TABLES, CARDS, CALLOUTS, TOC)
   ========================================================================== */
function renderMarkdown(mdText)
{
    if (!mdText)
    {
        return '';
    }

    headingsList = [];
    const lines = mdText.replace(/\r\n/g, '\n').split('\n');
    const output = [];

    let inUl = false;
    let inOl = false;
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines = [];

    let inTable = false;
    let tableRows = [];

    let inCallout = false;
    let calloutType = '';
    let calloutLines = [];

    const closeLists = () =>
    {
        if (inUl) { output.push('</ul>'); inUl = false; }
        if (inOl) { output.push('</ol>'); inOl = false; }
    };

    const flushTable = () =>
    {
        if (!inTable || tableRows.length === 0)
        {
            inTable = false;
            tableRows = [];
            return;
        }

        let html = '<div class="table-wrapper"><table class="md-table">';
        // Header
        const headerCells = tableRows[0].split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        html += '<thead><tr>';
        headerCells.forEach(cell =>
        {
            html += `<th>${renderInline(cell)}</th>`;
        });
        html += '</tr></thead><tbody>';

        // Skip separator row (idx 1), parse body rows
        for (let r = 2; r < tableRows.length; r++)
        {
            const cells = tableRows[r].split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (cells.length > 0)
            {
                html += '<tr>';
                cells.forEach(cell =>
                {
                    html += `<td>${renderInline(cell)}</td>`;
                });
                html += '</tr>';
            }
        }
        html += '</tbody></table></div>';
        output.push(html);

        inTable = false;
        tableRows = [];
    };

    const flushCallout = () =>
    {
        if (!inCallout)
        {
            return;
        }
        const titleMap = {
            'note': 'GHI CHÚ / NOTE',
            'important': 'ĐIỂM NEO TƯ DUY / IMPORTANT',
            'caution': 'CẢNH BÁO BẪY / CAUTION',
            'warning': 'CẢNH BÁO / WARNING',
            'tip': 'MẸO THỰC CHIẾN / TIP'
        };
        const iconMap = {
            'note': 'ℹ️',
            'important': '⭐',
            'caution': '⚠️',
            'warning': '🚨',
            'tip': '💡'
        };
        const titleText = titleMap[calloutType] || calloutType.toUpperCase();
        const icon = iconMap[calloutType] || '📌';

        let innerMd = calloutLines.join('\n');
        // Render callout content recursively or inline
        let renderedBody = calloutLines.map(l => `<p>${renderInline(l)}</p>`).join('');

        output.push(`
            <div class="callout-box callout-${calloutType}">
                <div class="callout-header">${icon} ${titleText}</div>
                <div class="callout-content">${renderedBody}</div>
            </div>
        `);

        inCallout = false;
        calloutType = '';
        calloutLines = [];
    };

    for (let i = 0; i < lines.length; i++)
    {
        const line = lines[i];
        const trimmed = line.trim();

        // 1. Code Fence (```)
        if (trimmed.startsWith('```'))
        {
            closeLists();
            flushTable();
            flushCallout();

            if (!inCodeBlock)
            {
                inCodeBlock = true;
                codeBlockLang = trimmed.slice(3).trim().toLowerCase();
                codeBlockLines = [];
                continue;
            }
            else
            {
                inCodeBlock = false;
                const codeContent = codeBlockLines.join('\n');
                const snippetId = 'code-snip-' + Math.random().toString(36).substr(2, 8);

                if (codeBlockLang === 'cpp' || codeBlockLang === 'c++' || codeBlockLang === 'c')
                {
                    output.push(`
                        <div class="code-editor-card">
                            <div class="code-editor-header">
                                <span>[ C++ SOURCE ]</span>
                                <button class="btn-copy-code" onclick="copyCode('${snippetId}', this)">Sao chép</button>
                            </div>
                            <pre><code id="${snippetId}">${highlightCpp(codeContent)}</code></pre>
                        </div>
                    `);
                }
                else if (codeBlockLang === 'bash' || codeBlockLang === 'sh' || codeBlockLang === 'shell')
                {
                    output.push(`
                        <div class="code-editor-card">
                            <div class="code-editor-header">
                                <span>[ TERMINAL / BASH ]</span>
                                <button class="btn-copy-code" onclick="copyCode('${snippetId}', this)">Sao chép</button>
                            </div>
                            <pre><code id="${snippetId}">${highlightBash(codeContent)}</code></pre>
                        </div>
                    `);
                }
                else
                {
                    // ASCII Memory Diagram / Topology
                    output.push(`
                        <div class="ascii-diagram-card">
                            <div class="ascii-diagram-header">
                                <span>[ SƠ ĐỒ BỘ NHỚ / TOPOLOGY ]</span>
                                <button class="btn-copy-code" onclick="copyCode('${snippetId}', this)">Sao chép sơ đồ</button>
                            </div>
                            <pre class="ascii-art"><code id="${snippetId}">${escapeHtml(codeContent)}</code></pre>
                        </div>
                    `);
                }
                continue;
            }
        }

        if (inCodeBlock)
        {
            codeBlockLines.push(line);
            continue;
        }

        // 2. Callouts / Obsidian Alerts (> [!NOTE])
        const calloutMatch = trimmed.match(/^>\s*\[!(NOTE|IMPORTANT|CAUTION|WARNING|TIP)\]\s*(.*)$/i);
        if (calloutMatch)
        {
            closeLists();
            flushTable();
            flushCallout();
            inCallout = true;
            calloutType = calloutMatch[1].toLowerCase();
            calloutLines = [];
            if (calloutMatch[2].trim())
            {
                calloutLines.push(calloutMatch[2].trim());
            }
            continue;
        }

        if (inCallout)
        {
            if (trimmed.startsWith('>'))
            {
                calloutLines.push(trimmed.slice(1).trim());
                continue;
            }
            else
            {
                flushCallout();
            }
        }

        // 3. Tables (| Col | Col |)
        if (trimmed.startsWith('|') && trimmed.endsWith('|'))
        {
            closeLists();
            inTable = true;
            tableRows.push(trimmed);
            continue;
        }
        else if (inTable)
        {
            flushTable();
        }

        // Blank Line
        if (!trimmed)
        {
            closeLists();
            continue;
        }

        // 4. Headings (#, ##, ###, ####)
        const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch)
        {
            closeLists();
            const level = headingMatch[1].length;
            const rawTitle = headingMatch[2].replace(/\*/g, '').trim();
            const id = 'sec-' + slugify(rawTitle) + '-' + (headingsList.length + 1);

            headingsList.push({
                level: level,
                title: rawTitle,
                id: id
            });

            output.push(`<h${level} id="${id}">${renderInline(rawTitle)}</h${level}>`);
            continue;
        }

        // 5. Horizontal Rule (---)
        if (trimmed === '---' || trimmed === '***' || trimmed === '___')
        {
            closeLists();
            output.push('<hr>');
            continue;
        }

        // 6. Blockquote standard (>)
        if (trimmed.startsWith('>'))
        {
            closeLists();
            const quoteContent = trimmed.slice(1).trim();
            output.push(`<blockquote class="md-quote">${renderInline(quoteContent)}</blockquote>`);
            continue;
        }

        // 7. Bullet Lists (- or *)
        const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
        if (bulletMatch)
        {
            if (inOl) { output.push('</ol>'); inOl = false; }
            if (!inUl) { output.push('<ul class="md-list">'); inUl = true; }
            output.push(`<li>${renderInline(bulletMatch[1])}</li>`);
            continue;
        }

        // 8. Numbered Lists (1., 2.)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch)
        {
            if (inUl) { output.push('</ul>'); inUl = false; }
            if (!inOl) { output.push('<ol class="md-ol">'); inOl = true; }
            output.push(`<li>${renderInline(numMatch[2])}</li>`);
            continue;
        }

        // Non-list line
        closeLists();
        output.push(`<p>${renderInline(trimmed)}</p>`);
    }

    closeLists();
    flushTable();
    flushCallout();

    return output.join('\n');
}

/* ==========================================================================
   5. DOCUMENT LOADER & VIEW CONTROLLER
   ========================================================================== */
function loadDocument(docId)
{
    const targetItem = currentDocList.find(d => d.id === docId);
    if (!targetItem)
    {
        console.warn("Document not found:", docId);
        return;
    }

    currentDocId = docId;

    // Update active book card in sidebar if search is not active
    const searchInput = document.getElementById('sidebar-filter-input');
    if (!searchInput || !searchInput.value.trim())
    {
        renderBookCards();
    }

    // Content retrieval (from embedded DOCS_CONTENT or fetch fallback)
    let rawText = (typeof DOCS_CONTENT !== 'undefined' && DOCS_CONTENT[docId]) ? DOCS_CONTENT[docId] : null;

    if (rawText)
    {
        renderDocumentView(targetItem, rawText);
    }
    else
    {
        // Fallback fetch
        fetch(targetItem.file)
            .then(res => res.text())
            .then(text => renderDocumentView(targetItem, text))
            .catch(err =>
            {
                document.getElementById('markdown-body').innerHTML = `
                    <div class="callout-box callout-caution">
                        <div class="callout-header">⚠️ LỖI NẠP TÀI LIỆU</div>
                        <p>Không thể tải file: <code>${targetItem.file}</code>. Vui lòng kiểm tra lại kết nối hoặc chạy lại sync.py.</p>
                    </div>
                `;
            });
    }

    // Close Mobile Drawer upon selection
    closeSidebar();
    closeTocModal();

    // Update URL hash without reload
    window.location.hash = '#/doc/' + docId;
    localStorage.setItem('techdocs_last_doc', docId);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDocumentView(meta, rawMarkdown)
{
    // Tag styling
    const tagClass = meta.tag.toLowerCase().includes('linux') ? 'tag-linux' : 'tag-cpp';
    document.getElementById('doc-tag').className = 'doc-tag ' + tagClass;
    document.getElementById('doc-tag').textContent = meta.tag;

    // Word count & Read time calculation
    const wordCount = rawMarkdown.trim().split(/\s+/).length;
    const readMinutes = Math.max(1, Math.ceil(wordCount / 180));
    document.getElementById('doc-read-time').textContent = `⏱️ ~${readMinutes} phút đọc (${wordCount.toLocaleString()} từ)`;

    // Main Title
    document.getElementById('doc-main-title').textContent = meta.title;

    // Body Render
    const bodyContainer = document.getElementById('markdown-body');
    let bodyHtml = renderMarkdown(rawMarkdown);

    // If viewing an INDEX page or summary, prepend Quick Chapter Number Grid
    const ctx = getCurrentBookContext(meta.id);
    if (ctx && (meta.id.endsWith('_INDEX') || meta.id === 'cpp_summary'))
    {
        let gridHtml = `
            <div class="index-quick-grid-card">
                <div class="index-quick-grid-title">🔢 Bàn Phím Số Chọn Chương Nhanh</div>
                <div class="chapter-grid">
        `;
        ctx.items.forEach((item, idx) =>
        {
            const fn = item.file.toLowerCase();
            let btnText = '';
            let isSpecial = false;

            if (fn.includes('index.md')) { btnText = 'Mục Lục'; isSpecial = true; }
            else if (fn.includes('learn_summary')) { btnText = 'Tổng Quan'; isSpecial = true; }
            else if (fn.includes('frontmatter')) { btnText = 'Lời Tựa'; isSpecial = true; }
            else
            {
                const m = fn.match(/ch(\d+)/) || fn.match(/(\d{2})_/);
                btnText = m ? m[1] : String(idx + 1).padStart(2, '0');
            }

            const activeClass = item.id === meta.id ? 'active' : '';
            const specialClass = isSpecial ? 'special-btn' : '';
            gridHtml += `
                <button class="chap-grid-btn ${specialClass} ${activeClass}" 
                        title="${escapeHtml(item.title)}" 
                        onclick="loadDocument('${item.id}')">
                    ${btnText}
                </button>
            `;
        });
        gridHtml += `</div></div>`;
        bodyHtml = gridHtml + bodyHtml;
    }

    bodyContainer.innerHTML = bodyHtml;

    // Build Table of Contents
    buildToc();

    // Update Top & Bottom Chapter Navigator Controls
    updateChapterNav(meta.id);

    // Render Bottom Prev / Next Navigation
    renderFooterNav(meta.id);
}

/* ==========================================================================
   CHAPTER NAVIGATION CONTROLLER & NUMBER PALETTE
   ========================================================================== */
function getCurrentBookContext(docId)
{
    if (typeof DOCS_MANIFEST === 'undefined')
    {
        return null;
    }

    for (let c = 0; c < DOCS_MANIFEST.length; c++)
    {
        const cat = DOCS_MANIFEST[c];
        const idx = cat.items.findIndex(item => item.id === docId);
        if (idx !== -1)
        {
            return {
                category: cat,
                items: cat.items,
                currentIndex: idx,
                currentItem: cat.items[idx]
            };
        }
    }
    return null;
}

function extractShortChapterLabel(item)
{
    if (!item)
    {
        return '';
    }
    const fn = item.file.toLowerCase();
    if (fn.includes('index.md'))
    {
        return 'Mục Lục (Index)';
    }
    if (fn.includes('learn_summary'))
    {
        return 'Tóm Tắt (Summary)';
    }
    if (fn.includes('frontmatter'))
    {
        return 'Lời Mở Đầu';
    }

    const m = fn.match(/ch(\d+)/);
    if (m)
    {
        return `Chương ${parseInt(m[1], 10)}`;
    }
    const m2 = fn.match(/(\d{2})_/);
    if (m2)
    {
        return `Module ${parseInt(m2[1], 10)}`;
    }
    return item.title;
}

function updateChapterNav(docId)
{
    const ctx = getCurrentBookContext(docId);
    if (!ctx)
    {
        return;
    }

    const shortLabel = extractShortChapterLabel(ctx.currentItem);
    const totalItems = ctx.items.length;
    const currentNum = ctx.currentIndex + 1;
    const labelText = `${shortLabel} (${currentNum}/${totalItems})`;

    ['current-chap-label', 'current-chap-label-b'].forEach(id =>
    {
        const el = document.getElementById(id);
        if (el)
        {
            el.textContent = labelText;
        }
    });

    const isFirst = ctx.currentIndex === 0;
    const isLast = ctx.currentIndex === totalItems - 1;

    ['btn-chap-prev', 'btn-chap-prev-b'].forEach(id =>
    {
        const el = document.getElementById(id);
        if (el)
        {
            el.disabled = isFirst;
        }
    });

    ['btn-chap-next', 'btn-chap-next-b'].forEach(id =>
    {
        const el = document.getElementById(id);
        if (el)
        {
            el.disabled = isLast;
        }
    });
}

function navigateChapter(delta, isSwipe = false)
{
    const ctx = getCurrentBookContext(currentDocId);
    if (!ctx)
    {
        return;
    }

    const targetIndex = ctx.currentIndex + delta;
    if (targetIndex >= 0 && targetIndex < ctx.items.length)
    {
        const targetDoc = ctx.items[targetIndex];
        const reader = document.querySelector('.reader-container');
        if (reader)
        {
            const animOut = delta > 0 ? 'slide-next-out' : 'slide-prev-out';
            const animIn = delta > 0 ? 'slide-next-in' : 'slide-prev-in';
            reader.classList.add(animOut);
            setTimeout(() =>
            {
                reader.classList.remove(animOut);
                reader.classList.add(animIn);
                setTimeout(() =>
                {
                    reader.classList.remove(animIn);
                }, 280);
            }, 100);
        }

        if (isSwipe)
        {
            const arrow = delta > 0 ? '➔' : '←';
            showSwipeToast(`${arrow} ${extractShortChapterLabel(targetDoc)}`);
        }
        loadDocument(targetDoc.id);
    }
    else
    {
        if (isSwipe)
        {
            showSwipeToast(delta > 0 ? "Đã ở chương cuối cuốn sách" : "Đã ở chương đầu cuốn sách");
        }
    }
}

function toggleChapterModal()
{
    const modal = document.getElementById('chapter-modal');
    const backdrop = document.getElementById('chapter-backdrop');
    if (!modal)
    {
        return;
    }

    const isOpen = modal.classList.contains('open');
    if (isOpen)
    {
        closeChapterModal();
    }
    else
    {
        renderChapterGrid();
        modal.classList.add('open');
        if (backdrop)
        {
            backdrop.classList.add('active');
        }
        document.body.style.overflow = 'hidden';
    }
}

function closeChapterModal()
{
    const modal = document.getElementById('chapter-modal');
    const backdrop = document.getElementById('chapter-backdrop');
    if (modal)
    {
        modal.classList.remove('open');
    }
    if (backdrop)
    {
        backdrop.classList.remove('active');
    }
    document.body.style.overflow = '';
}

function renderChapterGrid()
{
    const container = document.getElementById('chapter-grid-container');
    const tagEl = document.getElementById('chapter-modal-book-tag');
    if (!container)
    {
        return;
    }

    const ctx = getCurrentBookContext(currentDocId);
    if (!ctx)
    {
        return;
    }

    if (tagEl)
    {
        tagEl.textContent = ctx.category.category.replace(/^\d+\.\s*/, '');
    }

    let html = '';
    ctx.items.forEach((item, idx) =>
    {
        const fn = item.file.toLowerCase();
        let btnText = '';
        let isSpecial = false;

        if (fn.includes('index.md'))
        {
            btnText = 'Mục Lục';
            isSpecial = true;
        }
        else if (fn.includes('learn_summary'))
        {
            btnText = 'Tổng Quan';
            isSpecial = true;
        }
        else if (fn.includes('frontmatter'))
        {
            btnText = 'Lời Tựa';
            isSpecial = true;
        }
        else
        {
            const m = fn.match(/ch(\d+)/) || fn.match(/(\d{2})_/);
            if (m)
            {
                btnText = m[1];
            }
            else
            {
                btnText = String(idx + 1).padStart(2, '0');
            }
        }

        const isActive = item.id === currentDocId;
        const specialClass = isSpecial ? 'special-btn' : '';
        const activeClass = isActive ? 'active' : '';

        html += `
            <button class="chap-grid-btn ${specialClass} ${activeClass}" 
                    title="${escapeHtml(item.title)}" 
                    onclick="selectChapterFromGrid('${item.id}')">
                ${btnText}
            </button>
        `;
    });

    container.innerHTML = html;
}

function selectChapterFromGrid(docId)
{
    closeChapterModal();
    loadDocument(docId);
}

/* ==========================================================================
   MOBILE SWIPE GESTURE HANDLER (VUỐT TRÁI / PHẢI CHUYỂN CHƯƠNG)
   ========================================================================== */
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

function initSwipeGestures()
{
    window.addEventListener('touchstart', (e) =>
    {
        if (e.touches.length !== 1)
        {
            return;
        }
        const target = e.target;
        // Bỏ qua cử chỉ vuốt nếu thao tác trong vùng cuộn ngang, modal hoặc phần tử tương tác
        if (target.closest('pre, code, .ascii-art, .table-wrapper, .chapter-modal, .sidebar, .toc-modal, button, a, input, select, textarea'))
        {
            touchStartX = 0;
            return;
        }

        const touch = e.touches[0];
        // Bỏ qua nếu chạm sát mép màn hình (tránh xung đột cử chỉ Back/Forward của Android MIUI trên Redmi 10)
        if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24)
        {
            touchStartX = 0;
            return;
        }

        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    window.addEventListener('touchend', (e) =>
    {
        if (touchStartX === 0 || touchStartTime === 0)
        {
            return;
        }
        const touch = e.changedTouches[0];
        const touchEndX = touch.clientX;
        const touchEndY = touch.clientY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        const elapsed = Date.now() - touchStartTime;

        // Reset tracking state
        touchStartX = 0;
        touchStartY = 0;
        touchStartTime = 0;

        // Cử chỉ vuốt hợp lệ:
        // 1. Thời gian vuốt dứt khoát (< 600ms)
        // 2. Quãng đường ngang tối thiểu 50px (tối ưu cho màn hình 393px của Redmi 10)
        // 3. Góc vuốt dứt khoát theo trục hoành (diffX > diffY * 1.3)
        if (elapsed > 600)
        {
            return;
        }
        if (Math.abs(diffX) < 50)
        {
            return;
        }
        if (Math.abs(diffX) <= Math.abs(diffY) * 1.3)
        {
            return;
        }

        if (diffX < 0)
        {
            // Vuốt từ Phải sang Trái (Swipe Left) ➔ Chương Kế Tiếp
            navigateChapter(1, true);
        }
        else
        {
            // Vuốt từ Trái sang Phải (Swipe Right) ➔ Chương Trước Đó
            navigateChapter(-1, true);
        }
    }, { passive: true });

    // Hỗ trợ phím mũi tên Trái / Phải trên Desktop Web
    window.addEventListener('keydown', (e) =>
    {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select')
        {
            return;
        }
        const chapterModal = document.getElementById('chapter-modal');
        if (chapterModal && chapterModal.classList.contains('open'))
        {
            if (e.key === 'Escape')
            {
                closeChapterModal();
            }
            return;
        }

        if (e.key === 'ArrowLeft')
        {
            navigateChapter(-1, false);
        }
        else if (e.key === 'ArrowRight')
        {
            navigateChapter(1, false);
        }
    });
}

function showSwipeToast(message)
{
    let toast = document.getElementById('swipe-toast');
    if (!toast)
    {
        toast = document.createElement('div');
        toast.id = 'swipe-toast';
        toast.className = 'swipe-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');

    if (window.swipeToastTimeout)
    {
        clearTimeout(window.swipeToastTimeout);
    }
    window.swipeToastTimeout = setTimeout(() =>
    {
        toast.classList.remove('visible');
    }, 1500);
}

/* Build dynamic TOC for Mobile Modal */
function buildToc()
{
    const tocContainer = document.getElementById('toc-list');
    if (!tocContainer)
    {
        return;
    }

    if (headingsList.length === 0)
    {
        tocContainer.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.85rem; padding: 10px;">Không có đề mục con.</p>';
        return;
    }

    let html = '';
    headingsList.forEach(h =>
    {
        const depthClass = h.level === 1 ? 'depth-1' : (h.level === 2 ? 'depth-2' : 'depth-3');
        html += `<a href="#${h.id}" class="toc-link ${depthClass}" onclick="scrollToHeading('${h.id}')">${h.title}</a>`;
    });
    tocContainer.innerHTML = html;
}

function scrollToHeading(id)
{
    const target = document.getElementById(id);
    if (target)
    {
        closeTocModal();
        target.scrollIntoView({ behavior: 'smooth' });
    }
}

/* Render Prev & Next buttons for thumb-friendly mobile reading */
function renderFooterNav(docId)
{
    const currentIndex = currentDocList.findIndex(d => d.id === docId);
    const container = document.getElementById('doc-footer-nav');
    if (!container || currentIndex === -1)
    {
        return;
    }

    let prevHtml = '';
    let nextHtml = '';

    if (currentIndex > 0)
    {
        const prevDoc = currentDocList[currentIndex - 1];
        prevHtml = `
            <a class="btn-nav-page" onclick="loadDocument('${prevDoc.id}')">
                <span class="dir">‹ Bài trước</span>
                <span class="title">${prevDoc.title}</span>
            </a>
        `;
    }
    else
    {
        prevHtml = '<div></div>';
    }

    if (currentIndex < currentDocList.length - 1)
    {
        const nextDoc = currentDocList[currentIndex + 1];
        nextHtml = `
            <a class="btn-nav-page" style="text-align: right;" onclick="loadDocument('${nextDoc.id}')">
                <span class="dir">Bài kế tiếp ›</span>
                <span class="title">${nextDoc.title}</span>
            </a>
        `;
    }
    else
    {
        nextHtml = '<div></div>';
    }

    container.innerHTML = prevHtml + nextHtml;
}

function handleInternalLink(targetCleanName)
{
    const found = currentDocList.find(d => d.id.includes(targetCleanName) || d.file.includes(targetCleanName));
    if (found)
    {
        loadDocument(found.id);
    }
    else
    {
        console.warn("Internal doc link not found:", targetCleanName);
    }
}

function copyCode(elemId, btn)
{
    const elem = document.getElementById(elemId);
    if (!elem)
    {
        return;
    }
    navigator.clipboard.writeText(elem.innerText).then(() =>
    {
        const origText = btn.textContent;
        btn.textContent = 'Đã Copy!';
        btn.style.color = 'var(--accent-emerald)';
        setTimeout(() =>
        {
            btn.textContent = origText;
            btn.style.color = '';
        }, 1800);
    });
}

/* ==========================================================================
   6. SIDEBAR NAVIGATION TREE & SEARCH
   ========================================================================== */
function initSidebar()
{
    const navContent = document.getElementById('sidebar-content');
    if (!navContent || typeof DOCS_MANIFEST === 'undefined')
    {
        return;
    }

    currentDocList = [];
    DOCS_MANIFEST.forEach(cat =>
    {
        cat.items.forEach(item =>
        {
            currentDocList.push(item);
        });
    });

    renderBookCards();
}

function renderBookCards()
{
    const navContent = document.getElementById('sidebar-content');
    if (!navContent || typeof DOCS_MANIFEST === 'undefined')
    {
        return;
    }

    let html = `
        <div class="sidebar-section-title">📚 TỦ SÁCH & TÀI LIỆU</div>
        <div class="book-menu-list">
    `;

    DOCS_MANIFEST.forEach(cat =>
    {
        const totalItems = cat.items.length;
        const isActive = isCurrentDocInBook(cat.id);

        html += `
            <div class="book-menu-card ${isActive ? 'active' : ''}" onclick="selectBook('${cat.id}')">
                <div class="book-card-header">
                    <span class="book-card-icon">${cat.icon}</span>
                    <span class="book-card-badge">${totalItems} ${cat.id === 'cpp' ? 'tài liệu' : 'chương'}</span>
                </div>
                <div class="book-card-title">${cat.category}</div>
                <div class="book-card-desc">${cat.desc}</div>
                <div class="book-card-action">
                    <span>📖 Mở Mục Lục Sách</span>
                    <span class="action-arrow">›</span>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    navContent.innerHTML = html;
}

function isCurrentDocInBook(catId)
{
    if (!currentDocId || typeof DOCS_MANIFEST === 'undefined')
    {
        return false;
    }
    const cat = DOCS_MANIFEST.find(c => c.id === catId);
    return cat && cat.items.some(item => item.id === currentDocId);
}

function selectBook(catId)
{
    const cat = DOCS_MANIFEST.find(c => c.id === catId);
    if (!cat || cat.items.length === 0)
    {
        return;
    }

    // Default to the first item (INDEX or Roadmap)
    const targetDoc = cat.items[0];
    loadDocument(targetDoc.id);
    closeSidebar();
    renderBookCards();
}

function filterDocs(query)
{
    const q = query.toLowerCase().trim();
    const navContent = document.getElementById('sidebar-content');
    if (!navContent)
    {
        return;
    }

    if (!q)
    {
        renderBookCards();
        return;
    }

    const matches = currentDocList.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q)
    );

    let html = `
        <div class="sidebar-section-title">🔍 KẾT QUẢ TÌM KIẾM (${matches.length})</div>
        <div class="search-results-list">
    `;

    if (matches.length === 0)
    {
        html += `<p style="padding: 16px; color: var(--text-tertiary); font-size: 0.86rem;">Không tìm thấy chương nào khớp với "${escapeHtml(query)}".</p>`;
    }
    else
    {
        matches.forEach(item =>
        {
            html += `
                <a class="nav-item" data-id="${item.id}" onclick="loadDocument('${item.id}')">
                    <span class="item-title">${item.title}</span>
                    <span class="item-badge">${item.tag}</span>
                </a>
            `;
        });
    }

    html += `</div>`;
    navContent.innerHTML = html;
}

/* ==========================================================================
   7. UI CONTROLLERS (MOBILE DRAWER, TOC BOTTOM SHEET, THEMES, FONT SIZING)
   ========================================================================== */
function toggleSidebar()
{
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen)
    {
        closeSidebar();
    }
    else
    {
        sidebar.classList.add('open');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden'; // Ngăn cuộn trang ngầm
    }
}

function closeSidebar()
{
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
}

function toggleTocModal()
{
    const tocModal = document.getElementById('toc-modal');
    const isOpen = tocModal.classList.contains('open');
    if (isOpen)
    {
        closeTocModal();
    }
    else
    {
        tocModal.classList.add('open');
    }
}

function closeTocModal()
{
    const tocModal = document.getElementById('toc-modal');
    if (tocModal)
    {
        tocModal.classList.remove('open');
    }
}

/* Font Size Scaling (Mobile Reading Comfort) */
let currentFontSizeIndex = 1;
const FONT_SIZES = ['14px', '16px', '18px', '20px'];

function changeFontSize(delta)
{
    currentFontSizeIndex = Math.max(0, Math.min(FONT_SIZES.length - 1, currentFontSizeIndex + delta));
    const size = FONT_SIZES[currentFontSizeIndex];
    document.documentElement.style.fontSize = size;
    localStorage.setItem('techdocs_font_size', currentFontSizeIndex);
}

/* Theme Switching */
function toggleTheme()
{
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('techdocs_theme', newTheme);

    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn)
    {
        themeBtn.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    }
}

/* Reading Progress Bar */
window.addEventListener('scroll', () =>
{
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0)
    {
        const scrolled = (window.scrollY / docHeight) * 100;
        document.getElementById('progress-bar').style.width = Math.min(100, Math.max(0, scrolled)) + '%';
    }
}, { passive: true });

/* ==========================================================================
   8. APPLICATION INITIALIZATION
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () =>
{
    // 1. Khởi tạo cây danh mục
    initSidebar();

    // 2. Phục hồi Theme đã lưu
    const savedTheme = localStorage.getItem('techdocs_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn)
    {
        themeBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    }

    // 3. Phục hồi Font Size
    const savedFontSize = localStorage.getItem('techdocs_font_size');
    if (savedFontSize !== null)
    {
        currentFontSizeIndex = parseInt(savedFontSize, 10);
        document.documentElement.style.fontSize = FONT_SIZES[currentFontSizeIndex];
    }

    // 4. Định tuyến theo Hash hoặc phục hồi bài đọc gần nhất
    const hash = window.location.hash;
    let initialDocId = null;

    if (hash && hash.startsWith('#/doc/'))
    {
        initialDocId = hash.replace('#/doc/', '');
    }
    else
    {
        initialDocId = localStorage.getItem('techdocs_last_doc');
    }

    // Mặc định nạp bài đầu tiên nếu không có hash
    if (!initialDocId || !currentDocList.some(d => d.id === initialDocId))
    {
        initialDocId = currentDocList[0] ? currentDocList[0].id : null;
    }

    if (initialDocId)
    {
        loadDocument(initialDocId);
    }

    // 5. Khởi tạo cử chỉ vuốt chuyển chương trên Mobile (Swipe Left/Right)
    initSwipeGestures();

    // Listen to hash changes (Browser Back / Forward buttons)
    window.addEventListener('hashchange', () =>
    {
        const newHash = window.location.hash;
        if (newHash.startsWith('#/doc/'))
        {
            const targetId = newHash.replace('#/doc/', '');
            if (targetId !== currentDocId)
            {
                loadDocument(targetId);
            }
        }
    });
});
