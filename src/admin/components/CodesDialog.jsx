import { useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'

// Muestra los códigos de recuperación UNA vez. Solo viven en el estado del padre:
// nunca se guardan en storage ni se registran en consola.
export default function CodesDialog({ codes, onClose }) {
  const [copied, setCopied] = useState(false)
  const text = codes.join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'codigos-de-recuperacion.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/70" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-purple-500/30 bg-ink-800 p-6 text-white">
          <AlertDialog.Title className="text-lg font-semibold">
            Códigos de recuperación
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-yellow-300">
            No vas a poder volver a verlos. Guardalos en un lugar seguro.
          </AlertDialog.Description>
          <ul className="space-y-1 font-mono text-sm">
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10"
            >
              Descargar .txt
            </button>
            <AlertDialog.Cancel className="ml-auto rounded-lg bg-purple-600 px-4 py-2 text-sm hover:bg-purple-500">
              Listo
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
