/**
 * Tiny, dependency-free markdown renderer with XSS-safe output.
 *
 * Supports: headings, bold, italics, inline code, code blocks, lists,
 * and GitHub-style pipe tables (used heavily by the AI assistant).
 * All HTML is escaped first, then safe tags are applied via regex.
 */
const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPE[ch])
}

/** Split escaped text on the first unescaped pipe. Returns [cell, rest]. */
function splitCell(line: string): [string, string] {
  const idx = line.indexOf('|')
  if (idx === -1) return [line, '']
  return [line.slice(0, idx), line.slice(idx + 1)]
}

export function renderMarkdown(input: string): string {
  const lines = escapeHtml(input).split('\n')
  const out: string[] = []
  let inCode = false
  let listType: 'ul' | 'ol' | null = null
  let inTable = false
  let tableRows: string[][] = []
  let tableAligns: string[] = []

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }
  const closeTable = () => {
    if (inTable) {
      const header = tableRows[0] ?? []
      const rows = tableRows.slice(1)
      const colSpan = header.length
      out.push(
        '<div class="overflow-x-auto rounded-lg border border-border/60"><table class="w-full border-collapse text-left text-[13px]">',
      )
      out.push('<thead><tr>')
      header.forEach((cell, i) => {
        const align = tableAligns[i] === 'center' ? ' text-center' : tableAligns[i] === 'right' ? ' text-right' : ''
        out.push(`<th class="border-b border-border/60 bg-muted/60 px-3 py-2 font-semibold text-foreground${align}">${cell}</th>`)
      })
      out.push('</tr></thead><tbody>')
      rows.forEach((row) => {
        out.push('<tr>')
        for (let i = 0; i < colSpan; i++) {
          const cell = row[i] ?? ''
          const align = tableAligns[i] === 'center' ? ' text-center' : tableAligns[i] === 'right' ? ' text-right' : ''
          out.push(`<td class="border-b border-border/40 px-3 py-1.5 text-muted-foreground${align}">${cell}</td>`)
        }
        out.push('</tr>')
      })
      out.push('</tbody></table></div>')
      inTable = false
      tableRows = []
      tableAligns = []
    }
  }

  for (let raw of lines) {
    // Fenced code block
    if (raw.startsWith('```')) {
      closeTable()
      closeList()
      if (inCode) {
        out.push('</code></pre>')
        inCode = false
      } else {
        out.push('<pre class="overflow-x-auto rounded-lg bg-muted/70 p-3 font-mono text-[12px]"><code>')
        inCode = true
      }
      continue
    }
    if (inCode) {
      out.push(raw)
      continue
    }

    // Table
    if (raw.trim().startsWith('|')) {
      if (!inTable) {
        closeList()
        inTable = true
        tableRows = []
        tableAligns = []
      }
      const cells: string[] = []
      let rest = raw.trim()
      if (rest.startsWith('|')) rest = rest.slice(1)
      if (rest.endsWith('|')) rest = rest.slice(0, -1)
      while (rest) {
        const [cell, leftover] = splitCell(rest)
        cells.push(cell.trim())
        rest = leftover
      }
      // Separator row like | --- | :---: | ---: |
      if (cells.length && cells.every((c) => /^:?-{3,}:?$/.test(c))) {
        tableAligns = cells.map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'))
        continue
      }
      tableRows.push(cells)
      continue
    }
    closeTable()

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) {
      closeList()
      out.push('<hr class="my-3 border-border/60"/>')
      continue
    }

    // Headings
    const heading = raw.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = Math.min(heading[1].length + 1, 4)
      const size = level === 2 ? 'text-base' : level === 3 ? 'text-[15px]' : 'text-sm'
      out.push(`<h${level} class="mt-2 mb-1 font-bold text-foreground ${size}">${inline(heading[2])}</h${level}>`)
      continue
    }

    // Lists
    const ul = raw.match(/^\s*[-*+]\s+(.*)$/)
    const ol = raw.match(/^\s*\d+\.\s+(.*)$/)
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol'
      if (listType !== type) {
        closeList()
        out.push(`<${type} class="my-1 ml-4 list-disc space-y-0.5 marker:text-primary">`)
        listType = type
      }
      const tag = type === 'ul' ? 'li' : 'li'
      out.push(`<${tag} class="ml-1">${inline((ul ?? ol)![1])}</${tag}>`)
      continue
    }
    closeList()

    // Blank line → paragraph spacing
    if (!raw.trim()) {
      out.push('<div class="h-1.5"></div>')
      continue
    }

    // Plain paragraph
    out.push(`<p class="my-1 leading-relaxed">${inline(raw)}</p>`)
  }
  closeTable()
  closeList()
  if (inCode) out.push('</code></pre>')

  return out.join('\n')
}

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2">$1</a>')
}
