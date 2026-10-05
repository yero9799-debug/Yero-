const adminGate = document.getElementById('admin-gate')
const adminContent = document.getElementById('admin-content')

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

async function checkAdminAccess() {
  try {
    const res = await fetch('/api/me')
    if (!res.ok) {
      adminGate.innerHTML = '<p class="hint">Connecte-toi avec un compte administrateur pour accéder à cette page. <a href="/compte.html">Se connecter</a></p>'
      return false
    }
    const data = await res.json()
    if (data.role !== 'admin') {
      adminGate.innerHTML = '<p class="hint">Cette page est réservée à l\'administrateur.</p>'
      return false
    }
    adminGate.style.display = 'none'
    adminContent.style.display = ''
    return true
  } catch (err) {
    adminGate.innerHTML = '<p class="hint">Connexion au serveur impossible.</p>'
    return false
  }
}

async function loadVisitorCount() {
  try {
    const res = await fetch('/api/visit')
    const data = await res.json()
    document.getElementById('visitor-count-hint').textContent = `👥 ${data.total} abonné(s) / visiteur(s) uniques comptabilisés.`
  } catch (err) {}
}

async function loadUsers() {
  const listEl = document.getElementById('users-list')
  listEl.innerHTML = '<p class="hint">Chargement…</p>'
  try {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (!data.users || !data.users.length) {
      listEl.innerHTML = '<p class="hint">Aucun compte.</p>'
      return
    }
    listEl.innerHTML = data.users.map((u) => `
      <div class="user-row" data-id="${u.id}">
        <div>
          <strong>${escapeHtml(u.username)}</strong> ${u.role === 'admin' ? '👑' : ''}
          <div class="user-email">${escapeHtml(u.email || '—')}</div>
        </div>
        <button type="button" class="ban-toggle-btn" data-id="${u.id}" data-banned="${u.is_banned}">
          ${u.is_banned ? 'Débannir' : 'Bannir'}
        </button>
      </div>
    `).join('')

    document.querySelectorAll('.ban-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id
        const isBanned = btn.dataset.banned === 'true'
        const action = isBanned ? 'unban' : 'ban'
        try {
          const res = await fetch(`/api/admin/users/${id}/${action}`, { method: 'POST' })
          if (res.ok) await loadUsers()
        } catch (err) {}
      })
    })
  } catch (err) {
    listEl.innerHTML = '<p class="hint">Erreur de chargement.</p>'
  }
}

const mediaTypeSelect = document.getElementById('announcement-media-type')
const mediaUrlField = document.getElementById('announcement-media-url-field')
if (mediaTypeSelect) {
  mediaTypeSelect.addEventListener('change', () => {
    mediaUrlField.style.display = mediaTypeSelect.value ? '' : 'none'
  })
}

const announcementForm = document.getElementById('announcement-form')
if (announcementForm) {
  announcementForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const text = document.getElementById('announcement-text').value.trim()
    const mediaType = mediaTypeSelect.value || null
    const mediaUrl = document.getElementById('announcement-media-url').value.trim() || null

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, media_type: mediaType, media_url: mediaUrl }),
      })
      const data = await res.json()
      if (res.ok) {
        announcementForm.reset()
        mediaUrlField.style.display = 'none'
        alert('Annonce publiée.')
      } else {
        alert(data.error || 'Erreur lors de la publication')
      }
    } catch (err) {
      alert('Connexion au serveur impossible')
    }
  })
}

checkAdminAccess().then((ok) => {
  if (ok) {
    loadVisitorCount()
    loadUsers()
  }
})
