export default function DevNotice() {
  return (
    <main className="min-h-screen bg-ink text-white flex items-center justify-center p-6">
      <p className="max-w-md text-center text-white/80">
        El panel solo funciona en producción; la autenticación está deshabilitada en otros entornos.
      </p>
    </main>
  )
}
