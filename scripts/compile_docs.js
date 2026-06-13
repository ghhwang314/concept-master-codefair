import { readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const DOCS = [
  {
    src: "SUBMISSION_DOCS/작품요약서_건호_대상형_초안_20260608.md",
    dest: "SUBMISSION_DOCS/작품요약서_건호_대상형_초안_20260608.html",
    title: "작품요약서 - 오답 DNA 지도(ConceptMaster)",
    activeId: "summary"
  },
  {
    src: "SUBMISSION_DOCS/작품설명서_건호_대상형_초안_20260608.md",
    dest: "SUBMISSION_DOCS/작품설명서_건호_대상형_초안_20260608.html",
    title: "작품설명서 - 오답 DNA 지도(ConceptMaster)",
    activeId: "manual"
  },
  {
    src: "SUBMISSION_DOCS/심사기준_자가점검_건호_20260608.md",
    dest: "SUBMISSION_DOCS/심사기준_자가점검_건호_20260608.html",
    title: "한국코드페어 심사기준 자가점검",
    activeId: "self-check"
  },
  {
    src: "SUBMISSION_DOCS/붙여넣기_가이드_건호_20260608.md",
    dest: "SUBMISSION_DOCS/붙여넣기_가이드_건호_20260608.html",
    title: "붙여넣기 가이드 및 질의응답",
    activeId: "copy-guide"
  },
  {
    src: "GEONHO_HUMAN_TRIAL_CHECKLIST.md",
    dest: "GEONHO_HUMAN_TRIAL_CHECKLIST.html",
    title: "Geonho Human Trial Checklist",
    activeId: "trial-checklist"
  }
];

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineParse(text) {
  let html = escapeHtml(text);
  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline code `code`
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");
  // Links [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  return html;
}

function renderQuote(lines) {
  const content = lines.join("\n").trim();
  const alertMatch = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)/i);
  if (alertMatch) {
    const type = alertMatch[1].toUpperCase();
    const body = alertMatch[2].trim().replace(/\n/g, "<br>");
    return `<div class="alert-box alert-${type.toLowerCase()}"><strong>${type}</strong><p>${inlineParse(body)}</p></div>\n`;
  }
  return `<blockquote>${inlineParse(content).replace(/\n/g, "<br>")}</blockquote>\n`;
}

function mdToHtml(md) {
  let html = "";
  // Normalize line endings
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inList = false;
  let listType = null; // "ul" or "ol"
  let inCode = false;
  let codeBlock = [];
  let inQuote = false;
  let quoteBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code block
    if (line.trim().startsWith("```")) {
      if (inCode) {
        inCode = false;
        html += `<pre><code>${escapeHtml(codeBlock.join("\n"))}</code></pre>\n`;
        codeBlock = [];
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBlock.push(line);
      continue;
    }

    // Handle blockquote
    if (line.trim().startsWith(">")) {
      inQuote = true;
      const quoteLine = line.trim().replace(/^>\s?/, "");
      quoteBlock.push(quoteLine);
      continue;
    } else if (inQuote && line.trim() !== "") {
      const quoteLine = line.trim().replace(/^>\s?/, "");
      quoteBlock.push(quoteLine);
      continue;
    } else if (inQuote && line.trim() === "") {
      inQuote = false;
      html += renderQuote(quoteBlock);
      quoteBlock = [];
      // continue to next line
      continue;
    }

    // Handle lists
    const isUlMatch = line.match(/^(\s*)-\s+(.*)/);
    const isOlMatch = line.match(/^(\s*)\d+\.\s+(.*)/);

    if (isUlMatch || isOlMatch) {
      const type = isUlMatch ? "ul" : "ol";
      const content = isUlMatch ? isUlMatch[2] : isOlMatch[2];

      if (!inList) {
        inList = true;
        listType = type;
        html += `<${listType}>\n`;
      } else if (listType !== type) {
        html += `</${listType}>\n`;
        listType = type;
        html += `<${listType}>\n`;
      }
      html += `  <li>${inlineParse(content)}</li>\n`;
      continue;
    } else {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = null;
      }
    }

    // Handle empty line
    if (line.trim() === "") {
      continue;
    }

    // Handle headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      html += `<h${level}>${inlineParse(content)}</h${level}>\n`;
      continue;
    }

    // Handle horizontal rule
    if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
      html += "<hr />\n";
      continue;
    }

    // Paragraph
    html += `<p>${inlineParse(line)}</p>\n`;
  }

  // Cleanup open tags
  if (inCode) {
    html += `<pre><code>${escapeHtml(codeBlock.join("\n"))}</code></pre>\n`;
  }
  if (inQuote) {
    html += renderQuote(quoteBlock);
  }
  if (inList) {
    html += `</${listType}>\n`;
  }

  return html;
}

const NAV_HTML = `
<nav class="nav-bar">
  <a href="./작품요약서_건호_대상형_초안_20260608.html" class="nav-item {{active_summary}}">작품요약서</a>
  <a href="./작품설명서_건호_대상형_초안_20260608.html" class="nav-item {{active_manual}}">작품설명서</a>
  <a href="./심사기준_자가점검_건호_20260608.html" class="nav-item {{active_self-check}}">심사 자가점검</a>
  <a href="./붙여넣기_가이드_건호_20260608.html" class="nav-item {{active_copy-guide}}">붙여넣기 가이드</a>
  <a href="../GEONHO_HUMAN_TRIAL_CHECKLIST.html" class="nav-item {{active_trial-checklist}}">사용성 테스트 체크리스트</a>
</nav>
`;

const NAV_HTML_ROOT = `
<nav class="nav-bar">
  <a href="./SUBMISSION_DOCS/작품요약서_건호_대상형_초안_20260608.html" class="nav-item {{active_summary}}">작품요약서</a>
  <a href="./SUBMISSION_DOCS/작품설명서_건호_대상형_초안_20260608.html" class="nav-item {{active_manual}}">작품설명서</a>
  <a href="./SUBMISSION_DOCS/심사기준_자가점검_건호_20260608.html" class="nav-item {{active_self-check}}">심사 자가점검</a>
  <a href="./SUBMISSION_DOCS/붙여넣기_가이드_건호_20260608.html" class="nav-item {{active_copy-guide}}">붙여넣기 가이드</a>
  <a href="./GEONHO_HUMAN_TRIAL_CHECKLIST.html" class="nav-item {{active_trial-checklist}}">사용성 테스트 체크리스트</a>
</nav>
`;

async function compileAll() {
  console.log("Compiling Markdown docs to beautiful HTML...");
  
  for (const doc of DOCS) {
    const srcPath = join(ROOT, doc.src);
    const destPath = join(ROOT, doc.dest);
    
    try {
      const mdContent = await readFile(srcPath, "utf8");
      const parsedBody = mdToHtml(mdContent);
      
      // Select appropriate nav depending on whether file is in root or SUBMISSION_DOCS
      const isRootDoc = !doc.src.includes("/");
      let currentNav = isRootDoc ? NAV_HTML_ROOT : NAV_HTML;
      
      // Set active nav item
      currentNav = currentNav
        .replace("{{active_summary}}", doc.activeId === "summary" ? "active" : "")
        .replace("{{active_manual}}", doc.activeId === "manual" ? "active" : "")
        .replace("{{active_self-check}}", doc.activeId === "self-check" ? "active" : "")
        .replace("{{active_copy-guide}}", doc.activeId === "copy-guide" ? "active" : "")
        .replace("{{active_trial-checklist}}", doc.activeId === "trial-checklist" ? "active" : "");

      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title}</title>
  <style>
    body {
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1a1b1f;
      background-color: #f7f9fa;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    .nav-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      background: #ffffff;
      padding: 12px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.02);
      border: 1px solid #eef1f4;
      margin: 20px auto;
      max-width: 850px;
    }
    .nav-item {
      padding: 8px 16px;
      border-radius: 8px;
      color: #4a5568;
      font-weight: 600;
      text-decoration: none;
      font-size: 0.95em;
      transition: all 0.2s;
    }
    .nav-item:hover {
      background: #f1f3f5;
      color: #1a202c;
      text-decoration: none;
    }
    .nav-item.active {
      background: #58cc02;
      color: #ffffff;
    }
    .container {
      max-width: 850px;
      margin: 20px auto 40px auto;
      background: #ffffff;
      padding: 40px 50px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.03);
      border: 1px solid #eef1f4;
      box-sizing: border-box;
    }
    .header-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #eef1f4;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .brand-mark {
      font-size: 1.5em;
      font-weight: 800;
      text-decoration: none;
    }
    .brand-green { color: #58cc02; }
    .brand-dark { color: #2c3e50; }
    .brand-spark { color: #ffc800; margin-left: 4px; }
    .badge {
      background: #eef1f4;
      color: #4a5568;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    h1, h2, h3, h4 {
      color: #0c1017;
      font-weight: 700;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      word-break: keep-all;
    }
    h1 {
      font-size: 2em;
      border-bottom: 3px solid #58cc02;
      padding-bottom: 12px;
      margin-top: 0;
      color: #1b1b1b;
    }
    h2 {
      font-size: 1.5em;
      color: #1f2d3d;
      border-bottom: 1px solid #eef1f4;
      padding-bottom: 8px;
    }
    h3 {
      font-size: 1.2em;
      color: #2c3e50;
    }
    p {
      margin: 0 0 1.2em;
      word-break: keep-all;
    }
    a {
      color: #58cc02;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }
    a:hover {
      color: #46a302;
      text-decoration: underline;
    }
    ul, ol {
      margin: 0 0 1.5em;
      padding-left: 24px;
    }
    li {
      margin-bottom: 0.6em;
      word-break: keep-all;
    }
    pre {
      background: #1e293b;
      color: #f8fafc;
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Fira Code', 'Courier New', Courier, monospace;
      font-size: 0.9em;
      margin: 1.5em 0;
      border: 1px solid #334155;
    }
    code {
      font-family: 'Fira Code', 'Courier New', Courier, monospace;
      background: #f1f3f5;
      color: #d63384;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border-radius: 0;
    }
    blockquote {
      border-left: 4px solid #58cc02;
      background: #f2fbf0;
      margin: 1.5em 0;
      padding: 12px 20px;
      color: #2c3e50;
      border-radius: 0 8px 8px 0;
    }
    .alert-box {
      padding: 16px 20px;
      margin: 1.5em 0;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .alert-note {
      background-color: #f0f7ff;
      border-color: #0070f3;
      color: #004085;
    }
    .alert-note strong { color: #0056b3; }
    .alert-tip {
      background-color: #f2fbf0;
      border-color: #58cc02;
      color: #2b5c00;
    }
    .alert-tip strong { color: #46a302; }
    .alert-important {
      background-color: #fef8f0;
      border-color: #f5a623;
      color: #664d03;
    }
    .alert-important strong { color: #d97706; }
    .alert-warning {
      background-color: #fff5f5;
      border-color: #ff4d4f;
      color: #721c24;
    }
    .alert-warning strong { color: #d9383a; }
    .alert-caution {
      background-color: #fff0f1;
      border-color: #e02424;
      color: #9b1c1c;
    }
    .alert-caution strong { color: #c81e1e; }
    
    @media print {
      body {
        background-color: #ffffff;
      }
      .nav-bar {
        display: none;
      }
      .container {
        box-shadow: none;
        border: none;
        padding: 0;
        margin: 0;
      }
      .badge {
        border: 1px solid #ccc;
      }
    }
  </style>
</head>
<body>
  ${currentNav}
  <main class="container">
    <header class="header-hero">
      <div class="brand-mark">
        <span class="brand-green">ConceptMaster</span>
        <span class="brand-dark">문서</span>
        <span class="brand-spark">✦</span>
      </div>
      <div class="badge">SW공모전 제출 서류</div>
    </header>
    <article>
      ${parsedBody}
    </article>
  </main>
</body>
</html>`;

      await writeFile(destPath, html, "utf8");
      console.log(`Successfully compiled: ${doc.src} -> ${doc.dest}`);
    } catch (error) {
      console.error(`Error compiling ${doc.src}:`, error);
    }
  }
  
  console.log("All documents successfully compiled into HTML!");
}

compileAll();
