import * as AlertDialog from '@radix-ui/react-alert-dialog'

// Confirmación modal para acciones destructivas. `open` y `onOpenChange` controlan el diálogo.
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/70" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-purple-500/30 bg-ink-800 p-6 text-white">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-white/70">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-3">
            <AlertDialog.Cancel className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10">
              Cancelar
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500"
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
