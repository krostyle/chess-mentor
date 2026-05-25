import type { ReactNode } from 'react'

interface Props {
  text: string
  onMoveClick?: (notation: string) => void
}

// Matches chess move notation: 12.Nf3 / 12...Nd4 / 12.O-O / 12.exd5+
const MOVE_RE = /\b(\d+(?:\.\.\.|\.)(?:[KQRBN][a-zA-Z0-9x+#=\-]*|[a-h][a-zA-Z0-9x+#=]*|O-O(?:-O)?))/g

export function MarkdownText({ text, onMoveClick }: Props) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### '))
          return <p key={i} className="font-semibold text-white mt-2">{renderInline(line.slice(4), onMoveClick)}</p>
        if (line.startsWith('## '))
          return <p key={i} className="font-semibold text-white mt-2">{renderInline(line.slice(3), onMoveClick)}</p>
        if (line.startsWith('# '))
          return <p key={i} className="font-bold text-white mt-3">{renderInline(line.slice(2), onMoveClick)}</p>
        if (line.startsWith('- ') || line.startsWith('• '))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-gray-500 shrink-0">•</span>
              <span>{renderInline(line.slice(2), onMoveClick)}</span>
            </div>
          )
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i}>{renderInline(line, onMoveClick)}</p>
      })}
    </div>
  )
}

function renderInline(text: string, onMoveClick?: (n: string) => void): ReactNode[] {
  // Split on bold, italic, and chess move notation
  const SPLIT_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|\b\d+(?:\.\.\.|\.)(?:[KQRBN][a-zA-Z0-9x+#=\-]*|[a-h][a-zA-Z0-9x+#=]*|O-O(?:-O)?))/g
  const parts = text.split(SPLIT_RE)

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>
    if (onMoveClick && MOVE_RE.test(part)) {
      MOVE_RE.lastIndex = 0
      return (
        <button
          key={i}
          onClick={() => onMoveClick(part)}
          className="font-mono text-indigo-400 hover:text-indigo-300 hover:underline transition"
        >
          {part}
        </button>
      )
    }
    return part
  })
}
