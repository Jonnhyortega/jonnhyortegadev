// Utilidades puras de la pantalla de proyectos.
export const IMAGE_HOSTS = ['res.cloudinary.com', 'upload.wikimedia.org']

// Misma regla que el servidor (que es la autoridad): https, host permitido, sin credenciales.
export function isAllowedImageUrl(value) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001F\u007F]/.test(value)) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.port === '' &&
      IMAGE_HOSTS.includes(url.hostname)
    )
  } catch {
    return false
  }
}

export const emptyProject = () => ({
  title: '',
  descriptionEn: '',
  descriptionEs: '',
  imageUrl: '',
  liveUrl: '',
  githubUrl: '',
  tech: [],
  published: true,
})

// Cuerpo de entrada para la API a partir de un proyecto (o del formulario).
export function toInput(project) {
  const link = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
  return {
    title: project.title,
    descriptionEn: project.descriptionEn,
    descriptionEs: project.descriptionEs,
    imageUrl: project.imageUrl,
    liveUrl: link(project.liveUrl),
    githubUrl: link(project.githubUrl),
    tech: project.tech,
    published: project.published,
  }
}

// Copia con el elemento `index` movido `delta` posiciones; en los bordes no cambia nada.
export function moveItem(list, index, delta) {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
