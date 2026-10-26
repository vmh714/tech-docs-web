import os
import shutil
import json
import re

VAULT_ROOT = r"c:\Users\vuman\Documents\Obsidian Vault"
WEB_ROOT = os.path.join(VAULT_ROOT, "tech_docs_web")

# Source directories for the 3 Embedded Linux Books + C++
SOURCE_TLPI = os.path.join(VAULT_ROOT, "embedded linux book", "linux_programming_interface_book")
SOURCE_ELDD = os.path.join(VAULT_ROOT, "embedded linux book", "essential_linux_device_drivers_book")
SOURCE_LDD3 = os.path.join(VAULT_ROOT, "embedded linux book", "linux_device_drivers_3rd_book")

CPP_KNOWLEDGE = os.path.join(VAULT_ROOT, "C++", "knowledge_summary", "knowledge")
CPP_SUMMARY = os.path.join(VAULT_ROOT, "C++", "knowledge_summary", "learn_summary.md")

# Web destination directories
DEST_TLPI = os.path.join(WEB_ROOT, "content", "tlpi")
DEST_ELDD = os.path.join(WEB_ROOT, "content", "eldd")
DEST_LDD3 = os.path.join(WEB_ROOT, "content", "ldd3")
DEST_CPP = os.path.join(WEB_ROOT, "content", "cpp")
DEST_JS = os.path.join(WEB_ROOT, "js", "docs_data.js")

def extract_title(content, filename, book_code=""):
    # Special well-known filenames
    if filename.lower() == "index.md":
        return f"Mục Lục & Lộ Trình Sách ({book_code} Index)"
    if "frontmatter" in filename.lower():
        return f"Lời Nói Đầu & Giới Thiệu ({book_code} Frontmatter)"

    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        base = os.path.splitext(filename)[0]
        return base.replace("_", " ").title()

    # Case 1: TLPI style where line 1 is "## Chương X" and line 2 is "# **TÊN CHƯƠNG**"
    if len(lines) >= 2 and lines[0].lower().startswith("## chương"):
        ch_prefix = lines[0].replace("#", "").strip()
        sub_title = lines[1].replace("#", "").replace("*", "").strip()
        return f"{ch_prefix}: {sub_title}"

    # Case 2: Standard header starting with # Chương or #
    for line in lines[:8]:
        if line.startswith("#"):
            cleaned = re.sub(r"^#+\s*", "", line)
            cleaned = cleaned.replace("*", "").strip()
            # Normalize "Chương X." into "Chương X:"
            cleaned = re.sub(r"^(Chương\s+\d+)\.", r"\1:", cleaned, flags=re.IGNORECASE)
            if cleaned:
                return cleaned

    base = os.path.splitext(filename)[0]
    return base.replace("_", " ").title()

def process_book_dir(src_dir, dst_dir, book_id, book_name, book_icon, book_tag, book_desc, skip_files=None):
    if skip_files is None:
        skip_files = []
    
    os.makedirs(dst_dir, exist_ok=True)
    items = []
    content_map = {}

    if not os.path.exists(src_dir):
        print(f"Warning: Directory not found {src_dir}")
        return None, {}

    all_files = os.listdir(src_dir)
    # Sort with INDEX.md at top, followed by chapters in natural order
    md_files = [f for f in all_files if f.endswith(".md") and f not in skip_files]
    
    # Sort: INDEX.md first, ch00, ch01, ...
    def sort_key(fn):
        if fn.lower() == "index.md":
            return -1
        m = re.search(r"ch(\d+)", fn.lower())
        if m:
            return int(m.group(1))
        return 9999

    sorted_files = sorted(md_files, key=sort_key)

    for f in sorted_files:
        src_path = os.path.join(src_dir, f)
        dst_path = os.path.join(dst_dir, f)
        shutil.copy2(src_path, dst_path)

        with open(src_path, "r", encoding="utf-8", errors="replace") as fp:
            text = fp.read()

        doc_id = f"{book_id}_{os.path.splitext(f)[0]}"
        title = extract_title(text, f, book_tag)
        rel_path = os.path.relpath(dst_path, WEB_ROOT).replace("\\", "/")

        items.append({
            "id": doc_id,
            "title": title,
            "file": rel_path,
            "tag": book_tag
        })
        content_map[doc_id] = text

    category_def = {
        "id": book_id,
        "category": book_name,
        "icon": book_icon,
        "desc": book_desc,
        "items": items
    }
    return category_def, content_map

def sync():
    os.makedirs(os.path.join(WEB_ROOT, "content"), exist_ok=True)
    manifest = []
    all_content = {}

    # 1. Book 1: The Linux Programming Interface (TLPI)
    cat_tlpi, content_tlpi = process_book_dir(
        src_dir=SOURCE_TLPI,
        dst_dir=DEST_TLPI,
        book_id="tlpi",
        book_name="1. The Linux Programming Interface (TLPI)",
        book_icon="🐧",
        book_tag="TLPI",
        book_desc="Lập trình hệ thống Linux chuyên sâu (Michael Kerrisk)"
    )
    if cat_tlpi:
        manifest.append(cat_tlpi)
        all_content.update(content_tlpi)
        print(f"Ingested TLPI: {len(cat_tlpi['items'])} chapters")

    # 2. Book 2: Essential Linux Device Drivers (ELDD)
    # Skip EssentialLinuxDeviceDrivers.md (concatenated single book file)
    cat_eldd, content_eldd = process_book_dir(
        src_dir=SOURCE_ELDD,
        dst_dir=DEST_ELDD,
        book_id="eldd",
        book_name="2. Essential Linux Device Drivers (ELDD)",
        book_icon="🔌",
        book_tag="ELDD",
        book_desc="Kiến trúc & Lập trình Driver Thiết bị Linux (Sreekrishnan Venkateswaran)",
        skip_files=["EssentialLinuxDeviceDrivers.md"]
    )
    if cat_eldd:
        manifest.append(cat_eldd)
        all_content.update(content_eldd)
        print(f"Ingested ELDD: {len(cat_eldd['items'])} chapters")

    # 3. Book 3: Linux Device Drivers 3rd Edition (LDD3)
    cat_ldd3, content_ldd3 = process_book_dir(
        src_dir=SOURCE_LDD3,
        dst_dir=DEST_LDD3,
        book_id="ldd3",
        book_name="3. Linux Device Drivers 3rd Edition (LDD3)",
        book_icon="🛠️",
        book_tag="LDD3",
        book_desc="Kinh điển Nhân & Driver Linux (Jonathan Corbet, Greg KH)"
    )
    if cat_ldd3:
        manifest.append(cat_ldd3)
        all_content.update(content_ldd3)
        print(f"Ingested LDD3: {len(cat_ldd3['items'])} chapters")

    # 4. Category 4: C++ Core & Embedded Architecture
    os.makedirs(DEST_CPP, exist_ok=True)
    cpp_items = []
    
    # 4.1 Summary
    if os.path.exists(CPP_SUMMARY):
        dst_summary = os.path.join(DEST_CPP, "learn_summary.md")
        shutil.copy2(CPP_SUMMARY, dst_summary)
        with open(CPP_SUMMARY, "r", encoding="utf-8", errors="replace") as fp:
            text = fp.read()
        doc_id = "cpp_summary"
        title = extract_title(text, "learn_summary.md", "C++")
        cpp_items.append({
            "id": doc_id,
            "title": title,
            "file": "content/cpp/learn_summary.md",
            "tag": "C++ Master"
        })
        all_content[doc_id] = text

    # 4.2 Knowledge modules
    if os.path.exists(CPP_KNOWLEDGE):
        def cpp_sort_key(fn):
            m = re.match(r"^(\d+)", fn)
            return int(m.group(1)) if m else 9999

        sorted_cpp = sorted([f for f in os.listdir(CPP_KNOWLEDGE) if f.endswith(".md")], key=cpp_sort_key)
        for f in sorted_cpp:
            src_file = os.path.join(CPP_KNOWLEDGE, f)
            dst_file = os.path.join(DEST_CPP, f)
            shutil.copy2(src_file, dst_file)
            with open(src_file, "r", encoding="utf-8", errors="replace") as fp:
                text = fp.read()
            doc_id = f"cpp_{os.path.splitext(f)[0]}"
            title = extract_title(text, f, "C++")
            cpp_items.append({
                "id": doc_id,
                "title": title,
                "file": f"content/cpp/{f}",
                "tag": "C++ Core"
            })
            all_content[doc_id] = text

    manifest.append({
        "id": "cpp",
        "category": "4. C++ Core & Embedded Architecture",
        "icon": "⚡",
        "desc": "C++11/14/17/20, Modern Memory Model, Concurrency, Automotive ECU",
        "items": cpp_items
    })
    print(f"Ingested C++: {len(cpp_items)} documents")

    # Write output to docs_data.js
    with open(DEST_JS, "w", encoding="utf-8") as fp:
        fp.write("// AUTO-GENERATED BY sync.py - DO NOT EDIT DIRECTLY\n")
        fp.write("const DOCS_MANIFEST = ")
        json.dump(manifest, fp, ensure_ascii=False, indent=2)
        fp.write(";\n\n")
        fp.write("const DOCS_CONTENT = ")
        json.dump(all_content, fp, ensure_ascii=False)
        fp.write(";\n")

    total_docs = sum(len(c["items"]) for c in manifest)
    print("=" * 60)
    print(f"COMPLETE! Ingested total {total_docs} documents across 4 master collections:")
    for cat in manifest:
        print(f"  - {cat['category']}: {len(cat['items'])} chapters")
    print(f"Output saved to: {DEST_JS}")
    print("=" * 60)

if __name__ == "__main__":
    sync()
