export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAmount(value: string | number, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseMarkdown(text: string): string {
  // Process block-level elements line by line
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line → paragraph break
    if (line.trim() === "") {
      out.push('<div class="h-2"></div>');
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      out.push('<hr class="border-glass-border my-3" />');
      i++;
      continue;
    }

    // Headers
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = ["", "text-lg font-bold", "text-base font-semibold", "text-sm font-semibold", "text-sm font-medium"];
      out.push(`<div class="${sizes[level]} text-text-primary mt-3 mb-1">${inlineFormat(hMatch[2])}</div>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      out.push(`<div class="border-l-2 border-gold-dim/40 pl-3 my-2 text-text-muted italic">${quoteLines.map(l => inlineFormat(l)).join("<br />")}</div>`);
      continue;
    }

    // Table — detect header row with pipes
    if (line.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+[-| :]*$/.test(lines[i + 1].trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(renderTable(tableLines));
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(`<ul class="my-1 space-y-0.5">${items.map(it => `<li class="flex gap-2 items-start"><span class="text-gold-dim mt-1.5 text-[6px]">●</span><span>${inlineFormat(it)}</span></li>`).join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      out.push(`<ol class="my-1 space-y-0.5">${items.map((it, idx) => `<li class="flex gap-2 items-start"><span class="text-gold-dim text-xs font-mono w-4 shrink-0">${idx + 1}.</span><span>${inlineFormat(it)}</span></li>`).join("")}</ol>`);
      continue;
    }

    // Normal paragraph line
    out.push(`<p class="my-0.5">${inlineFormat(line)}</p>`);
    i++;
  }

  return out.join("");
}

function inlineFormat(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-white/5 text-gold-light px-1.5 py-0.5 rounded font-mono text-xs">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-gold underline underline-offset-2 hover:text-gold-light">$1</a>');
}

function renderTable(lines: string[]): string {
  const parseRow = (row: string): string[] =>
    row.split("|").map(c => c.trim()).filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""));

  // Filter out separator rows
  const dataRows = lines.filter(l => !/^\|?\s*[-:]+[-| :]*$/.test(l.trim()));
  if (dataRows.length === 0) return "";

  const headerCells = parseRow(dataRows[0]);
  const bodyRows = dataRows.slice(1);

  let html = '<div class="my-2 rounded-lg overflow-hidden border border-glass-border">';
  html += '<table class="w-full text-xs">';

  // Header
  html += '<thead><tr class="bg-white/[0.03]">';
  for (const cell of headerCells) {
    html += `<th class="px-3 py-2 text-left text-text-muted font-medium">${inlineFormat(cell)}</th>`;
  }
  html += "</tr></thead>";

  // Body
  if (bodyRows.length > 0) {
    html += "<tbody>";
    for (const row of bodyRows) {
      const cells = parseRow(row);
      html += '<tr class="border-t border-glass-border">';
      for (const cell of cells) {
        html += `<td class="px-3 py-1.5 text-text-secondary">${inlineFormat(cell)}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody>";
  }

  html += "</table></div>";
  return html;
}
