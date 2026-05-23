import type { ReactNode } from 'react'

export function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### '))
          return <p key={i} className="font-semibold text-white mt-2">{renderInline(line.slice(4))}</p>
        if (line.startsWith('## '))
          return <p key={i} className="font-semibold text-white mt-2">{renderInline(line.slice(3))}</p>
        if (line.startsWith('# '))
          return <p key={i} className="font-bold text-white mt-3">{renderInline(line.slice(2))}</p>
        if (line.startsWith('- ') || line.startsWith('• '))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-gray-500 shrink-0">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          )
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}
