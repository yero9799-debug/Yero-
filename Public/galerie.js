const grid = document.getElementById('grid')
const emptyEl = document.getElementById('empty')
const resultEl = document.getElementById('result')
const fileInput = document.getElementById('file-input')
const welcome = document.getElementById('welcome')

async function checkAuth() {
  const res = await fetch('/api/me')
  if (!res.ok) {
    window.location.href = '/compte.html'
    return null
  }
  return res.json()
}

async function loadGallery() {
  const res = await fetch('/api/gallery')
  const data = await res.json()
  grid.innerHTML = ''

  if (!data.items || data.items.length === 0) {
    emptyEl.style.display = 'block'
    return
  }
  emptyEl.style.display = 'none'

  for (const item of data.items) {
    const div = document.createElement('div')
    div.className = 'item'
    const isVideo = item.mime_type.startsWith('video')
    div.innerHTML = isVideo
      ? `<video src="/uploads/${item.filename}" muted></video>`
      : `<img src="/uploads/${item.filename}" alt="" />`
    const delBtn = document.createElement('button')
    delBtn.className = 'del'
    delBtn.textContent = '✕'
    delBtn.addEventListener('click', () => deleteItem(item.id))
    div.appendChild(delBtn)
    grid.appendChild(div)
  }
}

async function deleteItem(id) {
  await fetch(`/api/gallery/${id}`, { method: 'DELETE' })
  loadGallery()
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0]
  if (!file) return

  resultEl.className = ''
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch('/api/gallery/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) {
      resultEl.classList.add('show', 'error')
      resultEl.textContent = data.error || 'Échec de l\'envoi'
    } else {
      fileInput.value = ''
      loadGallery()
    }
  } catch (err) {
    resultEl.classList.add('show', 'error')
    resultEl.textContent = 'Connexion au serveur impossible'
  }
})

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' })
  window.location.href = '/compte.html'
})

;(async () => {
  const me = await checkAuth()
  if (me) {
    welcome.textContent = me.username
    loadGallery()
  }
})()
