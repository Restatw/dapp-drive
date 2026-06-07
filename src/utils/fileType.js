const TYPES = {
  image:   ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif'],
  video:   ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv'],
  audio:   ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus'],
  pdf:     ['pdf'],
  text:    ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini'],
  code:    ['js', 'ts', 'vue', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'sh', 'bash'],
  archive: ['zip', 'tar', 'gz', 'rar', '7z', 'bz2'],
}

const ICONS = {
  image: '🖼️', video: '🎬', audio: '🎵', pdf: '📕',
  text: '📝', code: '💻', archive: '🗜️', other: '📎',
}

export function getFileType(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  for (const [type, exts] of Object.entries(TYPES)) {
    if (exts.includes(ext)) return type
  }
  return 'other'
}

export function getFileIcon(entry) {
  if (entry.Type === 1) return '📁'
  return ICONS[getFileType(entry.Name)] || '📎'
}

export function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function isPreviewable(entry) {
  if (entry.Type === 1) return false
  return ['image', 'video', 'audio', 'text', 'code', 'pdf'].includes(getFileType(entry.Name))
}
