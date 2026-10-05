// ---------- Fond personnalisé ----------

function applyBackground() {
  const saved = localStorage.getItem('bgImage')
  const bgLayer = document.getElementById('bg-layer')
  if (saved && bgLayer) {
    bgLayer.style.backgroundImage = `url(${saved})`
  }
}
applyBackground()

// ---------- Compteur de visiteurs ----------
// Chaque visiteur est compté une fois via un identifiant anonyme stocké
// localement — pas besoin de compte pour être compté comme abonné.

function getOrCreateVisitorId() {
  let id = localStorage.getItem('visitorId')
  if (!id) {
    id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('visitorId', id)
  }
  return id
}

const visitorCountEl = document.getElementById('visitor-count')
function showVisitorCount(total) {
  if (visitorCountEl && typeof total === 'number') visitorCountEl.textContent = total.toLocaleString('fr-FR')
}

fetch('/api/visit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visitorId: getOrCreateVisitorId() }),
})
  .then((r) => r.json())
  .then((d) => showVisitorCount(d.total))
  .catch(() => {})

// ---------- Message de confirmation (toast) ----------
let toastTimer
function showToast(message, isError) {
  const el = document.getElementById('toast')
  if (!el) return alert(message)
  el.textContent = message
  el.classList.toggle('error', !!isError)
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500)
}

// ---------- Réglages globaux du site (vidéo/audio de fond, textes) ----------
// Chargés au démarrage pour que TOUS les visiteurs voient la même chose,
// définie par l'admin depuis Settings.

const bgVideoEl = document.getElementById('bg-video')
const bgAudioEl = document.getElementById('bg-audio')
const audioToggleBtn = document.getElementById('audio-toggle')
const siteTitleEl = document.querySelector('.site-title')
const checkSubmitBtn = document.querySelector('#check-form button[type="submit"]')
const subtitleJpEl = document.querySelector('.subtitle-jp')
const panelFooterEl = document.querySelector('.panel-footer')

let currentSiteSettings = {}

async function loadSiteSettings() {
  try {
    const res = await fetch('/api/site-settings')
    const data = await res.json()
    currentSiteSettings = data.settings || {}
    applySiteSettings()
  } catch (err) {
    // pas de réglages disponibles, le site garde ses valeurs par défaut
  }
}

function applySiteSettings() {
  const s = currentSiteSettings

  if (s.bgVideoUrl && bgVideoEl) {
    bgVideoEl.src = s.bgVideoUrl
    bgVideoEl.style.display = 'block'
  }
  if (s.bgAudioUrl && bgAudioEl) {
    bgAudioEl.src = s.bgAudioUrl
    audioToggleBtn.style.display = 'flex'
  } else if (audioToggleBtn) {
    audioToggleBtn.style.display = 'none'
  }
  if (s.siteTitle && siteTitleEl) siteTitleEl.textContent = s.siteTitle
  if (s.checkBtnText && checkSubmitBtn) checkSubmitBtn.textContent = s.checkBtnText
  if (s.subtitleText && subtitleJpEl) subtitleJpEl.textContent = s.subtitleText
  if (s.footerText && panelFooterEl) panelFooterEl.textContent = s.footerText
}

loadSiteSettings()

if (audioToggleBtn) {
  audioToggleBtn.addEventListener('click', () => {
    if (bgAudioEl.paused) {
      bgAudioEl.play().catch(() => {})
      audioToggleBtn.textContent = '🔊'
    } else {
      bgAudioEl.pause()
      audioToggleBtn.textContent = '🔇'
    }
  })
}

// ---------- Indicatif pays (saisie libre) ----------

// Recherche du pays par indicatif : on prend le plus long dial qui matche
// (ex: 1 = US/CA par défaut, mais 1809/1849/1829 = République Dominicaine)
function findCountryByDial(dial) {
  const clean = String(dial || '').replace(/\D/g, '')
  if (!clean) return null
  const matches = COUNTRIES.filter((c) => clean.startsWith(c.dial))
  if (!matches.length) return null
  // le match le plus précis = l'indicatif le plus long
  return matches.sort((a, b) => b.dial.length - a.dial.length)[0]
}

const dialInput = document.getElementById('dial-input')
const dialFlag = document.getElementById('dial-flag')
const dialBox = document.getElementById('dial-box')
const validationHint = document.getElementById('validation-hint')
const numberInput = document.getElementById('number-input')

function getSelectedCountry() {
  const dial = dialInput.value.trim()
  const country = findCountryByDial(dial)
  return country || { iso: undefined, dial, flag: '🏳️', name: null }
}

function refreshDialFlag() {
  const dial = dialInput.value.trim()
  if (!dial) {
    dialFlag.textContent = '🏳️'
    dialBox.classList.remove('unknown')
    validationHint.textContent = ''
    return
  }
  const country = findCountryByDial(dial)
  if (country) {
    dialFlag.textContent = country.flag
    dialBox.classList.remove('unknown')
    validationHint.textContent = ''
  } else {
    dialFlag.textContent = '❓'
    dialBox.classList.add('unknown')
    validationHint.textContent = `⚠ Indicatif +${dial} inconnu — aucun pays ne correspond, le numéro sera envoyé tel quel`
    validationHint.style.color = '#c9807e'
  }
}

if (dialInput) {
  dialInput.value = '49'
}

// ---------- Clavier numérique personnalisé ----------
// Les champs #dial-input et #number-input sont en readonly : ce clavier
// custom est la seule façon de taper, pour garder le thème sombre du site
// au lieu du clavier natif blanc du téléphone.

const keypadBackdrop = document.getElementById('keypad-backdrop')
const keypadTarget = document.getElementById('keypad-target')
const keypadDoneBtn = document.getElementById('keypad-done')
let activeKeypadInput = null

function openKeypad(inputEl) {
  activeKeypadInput = inputEl
  updateKeypadTarget()
  keypadBackdrop.classList.add('open')
}

function closeKeypad() {
  keypadBackdrop.classList.remove('open')
  activeKeypadInput = null
}

function updateKeypadTarget() {
  if (!activeKeypadInput) return
  const isDial = activeKeypadInput === dialInput
  keypadTarget.textContent = isDial
    ? `+${activeKeypadInput.value || ''}`
    : (activeKeypadInput.value || '—')
}

function keypadInsert(digit) {
  if (!activeKeypadInput) return
  const max = activeKeypadInput === dialInput ? 4 : 14
  if (activeKeypadInput.value.length >= max) return
  activeKeypadInput.value += digit
  handleKeypadFieldChange()
}

function keypadBackspace() {
  if (!activeKeypadInput) return
  activeKeypadInput.value = activeKeypadInput.value.slice(0, -1)
  handleKeypadFieldChange()
}

function keypadClear() {
  if (!activeKeypadInput) return
  activeKeypadInput.value = ''
  handleKeypadFieldChange()
}

function handleKeypadFieldChange() {
  updateKeypadTarget()
  if (activeKeypadInput === dialInput) {
    refreshDialFlag()
    if (numberInput.value.trim()) validateNumberField()
  } else {
    validateNumberField()
  }
}

function validateNumberField() {
  const country = getSelectedCountry()
  const result = validateNumber(numberInput.value.trim(), country.iso)
  if (numberInput.value.trim() && !result.valid) {
    validationHint.textContent = `⚠ ${result.reason}`
    validationHint.style.color = '#c9807e'
  } else if (!country.iso && dialInput.value.trim()) {
    refreshDialFlag()
  } else {
    validationHint.textContent = ''
  }
}

if (dialInput) dialInput.addEventListener('click', () => openKeypad(dialInput))
if (numberInput) numberInput.addEventListener('click', () => openKeypad(numberInput))
if (keypadDoneBtn) keypadDoneBtn.addEventListener('click', closeKeypad)
if (keypadBackdrop) {
  keypadBackdrop.addEventListener('click', (e) => {
    if (e.target === keypadBackdrop) closeKeypad()
  })
}

document.querySelectorAll('.keypad-key').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key
    if (key === 'back') keypadBackspace()
    else if (key === 'clear') keypadClear()
    else keypadInsert(key)
  })
})

refreshDialFlag()

// ---------- Popup résultat ----------

const resultBackdrop = document.getElementById('result-backdrop')
const resultCard = document.getElementById('result-card')
const resultNumberEl = document.getElementById('result-number')
const resultTitleEl = document.getElementById('result-title')
const resultDetailsEl = document.getElementById('result-details')
const resultNoteEl = document.getElementById('result-note')
const resultCopyBtn = document.getElementById('result-copy-btn')
const resultCloseBtn = document.getElementById('result-close-btn')

function detailRow(key, valueHtml) {
  return `<div class="detail-row"><span class="detail-key">${key}</span><span class="detail-val mono">${valueHtml}</span></div>`
}

function getCustomTitle(kind) {
  // kind: 'banned' | 'clean'
  const stored = localStorage.getItem(kind === 'banned' ? 'bannedText' : 'cleanText')
  if (stored && stored.trim()) return stored.trim()
  return kind === 'banned' ? 'This number is banned' : 'This number is active'
}

function openResultPopup({ variant, numberDisplay, title, icon, detailsHtml, note }) {
  resultCard.className = `result-card ${variant}`
  resultNumberEl.textContent = numberDisplay
  resultTitleEl.innerHTML = `${icon ? icon + ' ' : ''}${title}`
  resultDetailsEl.innerHTML = detailsHtml || ''
  resultDetailsEl.style.display = detailsHtml ? '' : 'none'
  if (note) {
    resultNoteEl.textContent = note
    resultNoteEl.style.display = ''
  } else {
    resultNoteEl.style.display = 'none'
  }
  resultBackdrop.dataset.position = localStorage.getItem('popupPosition') || 'center'
  resultBackdrop.classList.add('open')
}

if (resultCloseBtn) resultCloseBtn.addEventListener('click', () => resultBackdrop.classList.remove('open'))
if (resultBackdrop) {
  resultBackdrop.addEventListener('click', (e) => {
    if (e.target === resultBackdrop) resultBackdrop.classList.remove('open')
  })
}
if (resultCopyBtn) {
  resultCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultNumberEl.textContent.trim())
      resultCopyBtn.textContent = 'Copied ✓'
      setTimeout(() => { resultCopyBtn.textContent = 'Copy' }, 1200)
    } catch (err) {}
  })
}

// ---------- Validation + Check spam ----------

function validateNumber(rawNumber, isoCountry) {
  const digits = String(rawNumber || '').replace(/\D/g, '')
  // Format basique seulement : entre 4 et 14 chiffres après l'indicatif.
  // On ne vérifie plus le plan de numérotation exact du pays (longueur pile,
  // préfixes d'opérateur, etc.) — un numéro qui n'existe pas mais dont le
  // format (indicatif + chiffres) est respecté doit passer.
  if (!digits) return { valid: false, reason: 'Numéro vide' }
  if (digits.length < 4 || digits.length > 14) {
    return { valid: false, reason: 'Longueur de numéro invalide' }
  }
  return { valid: true }
}

async function checkNumber(number) {
  const res = await fetch('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number }),
  })
  return res.json()
}

async function fetchAppealStatus(number) {
  try {
    const res = await fetch(`/api/appeal-status?phone=${encodeURIComponent(number)}`)
    if (!res.ok) {
      // 404 = pas d'appel disponible pour ce numéro, mais le ban_time peut
      // quand même exister dans le corps de la réponse d'erreur — on essaie
      // de le lire avant d'abandonner
      try {
        const body = await res.json()
        return body && (body.ban_time || body.appeal_creation_time) ? body : null
      } catch (e) {
        return null
      }
    }
    return res.json()
  } catch (err) {
    return null
  }
}

// Formate un timestamp ISO 8601 (UTC) en heure locale lisible
function formatTimestamp(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const checkForm = document.getElementById('check-form')

if (checkForm) {
  checkForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const country = getSelectedCountry()
    const rawNumber = numberInput.value.trim()
    const btn = e.target.querySelector('button[type="submit"]')

    const validation = validateNumber(rawNumber, country.iso)
    if (!validation.valid) {
      validationHint.textContent = `⚠ ${validation.reason}`
      validationHint.style.color = '#c9807e'
      return
    }

    const dialForSend = country.dial || dialInput.value.trim()
    const numberToSend = validation.e164 || `+${dialForSend}${rawNumber}`

    btn.disabled = true
    const originalText = btn.textContent
    btn.textContent = 'Vérification...'

    try {
      const result = await checkNumber(numberToSend)

      if (result.error) {
        openResultPopup({
          variant: 'error',
          numberDisplay: numberToSend,
          title: result.error,
          icon: '⚠',
        })
      } else if (result.banned) {
        // On récupère le détail exact (perma ou pas, heures) via appeal-status,
        // seule source fiable pour is_perma — ban_type seul peut induire en erreur
        const appeal = await fetchAppealStatus(numberToSend)
        const isPerma = appeal ? !!appeal.is_perma : (result.ban_type === 'perma_ban')

        const customTitle = getCustomTitle('banned')
        const variant = isPerma ? 'banned perma' : 'banned'
        const icon = isPerma ? '🩸' : '⏳'

        let rows = ''
        rows += detailRow('Phone', numberToSend)
        rows += detailRow('Ban type', isPerma
          ? '<span class="badge danger perma">🩸 perma_ban</span>'
          : `<span class="badge danger">⏳ ${result.ban_type || 'temp_ban'}</span>`)
        if (result.violation_label) rows += detailRow('Violation', result.violation_label)
        if (result.violation_category) rows += detailRow('Category', `<span class="badge neutral">${result.violation_category}</span>`)
        rows += detailRow('Appeal', result.in_app_ban_appeal
          ? '<span class="badge success">● Available</span>'
          : '<span class="badge neutral">Unavailable</span>')
        if (typeof result.is_eu === 'boolean') rows += detailRow('EU', result.is_eu ? 'Yes' : 'No')
        if (appeal) {
          const banTime = formatTimestamp(appeal.ban_time)
          const appealTime = formatTimestamp(appeal.appeal_creation_time)
          if (banTime) rows += detailRow('Banned at', banTime)
          if (appealTime) rows += detailRow('Appeal filed', appealTime)
          if (!banTime && !appealTime) rows += detailRow('Banned at', 'Date non fournie par WhatsApp')
        } else {
          rows += detailRow('Banned at', 'Indisponible pour ce numéro')
        }
        rows += detailRow('Status', isPerma
          ? '<span class="badge danger perma">🩸 Perma — Definitive</span>'
          : '<span class="badge danger">⏳ Temporary</span>')

        // Message "en attente" : si le ban n'est pas définitif et qu'aucun appel
        // n'a encore été déposé (pas de appeal_creation_time), on l'affiche
        // nous-mêmes plutôt que de dépendre d'un texte venant de l'API externe
        const hasAppealFiled = appeal && appeal.appeal_creation_time
        let waitingNote = null
        if (!isPerma && !hasAppealFiled) {
          waitingNote = '⏳ En attente — aucun appel déposé pour le moment.'
        } else if (!isPerma && hasAppealFiled) {
          waitingNote = '⏳ Appel en cours de traitement par WhatsApp.'
        } else if (result.in_app_ban_appeal) {
          waitingNote = "Un appel est possible depuis l'application WhatsApp."
        }

        openResultPopup({
          variant,
          numberDisplay: numberToSend,
          title: customTitle,
          icon,
          detailsHtml: rows,
          note: waitingNote,
        })
      } else {
        const customTitle = getCustomTitle('clean')
        let rows = ''
        rows += detailRow('Phone', numberToSend)
        rows += detailRow('Status', '<span class="badge success">● Active on WhatsApp</span>')

        openResultPopup({
          variant: 'clean',
          numberDisplay: numberToSend,
          title: customTitle,
          icon: '🕊️',
          detailsHtml: rows,
          note: result.message || null,
        })
      }

      if (localStorage.getItem('vibrate') !== 'off' && navigator.vibrate) {
        navigator.vibrate(result.banned ? [80, 40, 80] : 40)
      }
    } catch (err) {
      openResultPopup({
        variant: 'error',
        numberDisplay: numberToSend,
        title: 'Connexion au serveur impossible. Réessayez.',
        icon: '⚠',
      })
    } finally {
      btn.disabled = false
      btn.textContent = originalText
    }
  })
}

// ---------- Autofill depuis le presse-papier ----------

const autofillBtn = document.getElementById('autofill-btn')
if (autofillBtn) {
  autofillBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText()
      const digitsOnly = text.replace(/[^\d+]/g, '')
      if (!digitsOnly) {
        validationHint.textContent = '⚠ Aucun numéro trouvé dans le presse-papier'
        validationHint.style.color = '#c9807e'
        return
      }

      const hadPlus = digitsOnly.startsWith('+')
      const justDigits = digitsOnly.replace(/^\+/, '')

      if (hadPlus) {
        // Le numéro collé contient bien un indicatif (ex: +509...) :
        // on détecte le pays automatiquement et on sépare indicatif / numéro local
        let matched = null
        for (let len = Math.min(4, justDigits.length); len >= 1; len--) {
          const candidateDial = justDigits.slice(0, len)
          const country = COUNTRIES.find((c) => c.dial === candidateDial)
          if (country) { matched = country; break }
        }
        if (matched) {
          dialInput.value = matched.dial
          numberInput.value = justDigits.slice(matched.dial.length)
        } else {
          // Indicatif présent mais inconnu de notre liste : on le met quand même,
          // on ne bloque pas ("si ça passe ça passe")
          const guessedDialLen = justDigits.length > 10 ? justDigits.length - 10 : 1
          dialInput.value = justDigits.slice(0, guessedDialLen)
          numberInput.value = justDigits.slice(guessedDialLen)
        }
      } else {
        // Pas de "+" dans le texte collé : on ne touche pas à l'indicatif déjà choisi,
        // on colle juste le numéro local
        numberInput.value = justDigits
      }

      refreshDialFlag()
      validateNumberField()
    } catch (err) {
      validationHint.textContent = '⚠ Autorisez l\'accès au presse-papier pour utiliser Autofill'
      validationHint.style.color = '#c9807e'
    }
  })
}

// ---------- Menu dropdown ----------

const menuBtn = document.getElementById('menu-btn')
const dropdown = document.getElementById('dropdown')

if (menuBtn) {
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('open')
  })

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== menuBtn) {
      dropdown.classList.remove('open')
    }
  })
}

// ---------- Modales ----------

document.querySelectorAll('[data-modal]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.modal).classList.add('open')
    dropdown.classList.remove('open')
  })
})

document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
  const closeBtn = backdrop.querySelector('.close-modal')
  if (closeBtn) closeBtn.addEventListener('click', () => backdrop.classList.remove('open'))
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.remove('open')
  })
})

// ---------- Actions du menu ----------

const historyBtn = document.getElementById('history-btn')
if (historyBtn) {
  historyBtn.addEventListener('click', () => {
    alert('Historique des vérifications — à venir.')
  })
}

const checkUpdatesBtn = document.getElementById('check-updates-btn')
if (checkUpdatesBtn) {
  checkUpdatesBtn.addEventListener('click', () => {
    alert('Vous utilisez la dernière version : v1.0')
    dropdown.classList.remove('open')
  })
}

const shareBtn = document.getElementById('share-btn')
if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    dropdown.classList.remove('open')
    const shareData = { title: 'YERO-Ban-checker', text: 'Vérifiez si un numéro WhatsApp est signalé spam.', url: window.location.origin }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch (e) {}
    } else {
      await navigator.clipboard.writeText(shareData.url)
      alert('Lien copié dans le presse-papiers.')
    }
  })
}

const telegramBtn = document.getElementById('telegram-btn')
if (telegramBtn) {
  telegramBtn.addEventListener('click', () => {
    window.open('https://t.me/', '_blank')
    dropdown.classList.remove('open')
  })
}

const apiBtn = document.getElementById('api-btn')
if (apiBtn) {
  apiBtn.addEventListener('click', () => {
    alert('Documentation de l\'API BanCheck : https://baron0.com/api/v2/check\n(Nécessite une clé — voir avec l\'administrateur du site.)')
    dropdown.classList.remove('open')
  })
}

// ---------- Pick background image ----------

const pickBgBtn = document.getElementById('pick-bg-btn')
const bgModal = document.getElementById('bg-modal')
const bgFileInput = document.getElementById('bg-file-input')
const bgPreviewBox = document.getElementById('bg-preview-box')

if (pickBgBtn) {
  pickBgBtn.addEventListener('click', () => {
    dropdown.classList.remove('open')
    const saved = localStorage.getItem('bgImage')
    if (saved) bgPreviewBox.style.backgroundImage = `url(${saved})`
    bgModal.classList.add('open')
  })

  bgFileInput.addEventListener('change', () => {
    const file = bgFileInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      bgPreviewBox.style.backgroundImage = `url(${dataUrl})`
      localStorage.setItem('bgImage', dataUrl)
      document.getElementById('bg-layer').style.backgroundImage = `url(${dataUrl})`
    }
    reader.readAsDataURL(file)
  })
}

// ---------- Settings ----------

const vibrateToggle = document.getElementById('vibrate-toggle')
if (vibrateToggle) {
  vibrateToggle.checked = localStorage.getItem('vibrate') !== 'off'
  vibrateToggle.addEventListener('change', () => {
    localStorage.setItem('vibrate', vibrateToggle.checked ? 'on' : 'off')
  })
}

const popupPositionSelect = document.getElementById('popup-position-select')
if (popupPositionSelect) {
  popupPositionSelect.value = localStorage.getItem('popupPosition') || 'center'
  popupPositionSelect.addEventListener('change', () => {
    localStorage.setItem('popupPosition', popupPositionSelect.value)
  })
}

const bannedTextInput = document.getElementById('banned-text-input')
if (bannedTextInput) {
  bannedTextInput.value = localStorage.getItem('bannedText') || ''
  bannedTextInput.addEventListener('input', () => {
    localStorage.setItem('bannedText', bannedTextInput.value)
  })
}

const cleanTextInput = document.getElementById('clean-text-input')
if (cleanTextInput) {
  cleanTextInput.value = localStorage.getItem('cleanText') || ''
  cleanTextInput.addEventListener('input', () => {
    localStorage.setItem('cleanText', cleanTextInput.value)
  })
}

// ---------- Champs settings pour réglages globaux (vidéo/audio/textes) ----------
// Ces champs se remplissent avec les valeurs actuelles à l'ouverture du modal,
// mais ne sont sauvegardés globalement qu'après connexion + clic "Appliquer".

const bgVideoInput = document.getElementById('bg-video-input')
const bgAudioInput = document.getElementById('bg-audio-input')
const siteTitleInput = document.getElementById('site-title-input')
const checkbtnTextInput = document.getElementById('checkbtn-text-input')
const subtitleTextInput = document.getElementById('subtitle-text-input')
const footerTextInput = document.getElementById('footer-text-input')
const settingsModal = document.getElementById('settings-modal')

function fillSettingsFieldsFromCurrent() {
  const s = currentSiteSettings
  if (bgVideoInput) bgVideoInput.value = s.bgVideoUrl || ''
  if (bgAudioInput) bgAudioInput.value = s.bgAudioUrl || ''
  if (siteTitleInput) siteTitleInput.value = s.siteTitle || ''
  if (checkbtnTextInput) checkbtnTextInput.value = s.checkBtnText || ''
  if (subtitleTextInput) subtitleTextInput.value = s.subtitleText || ''
  if (footerTextInput) footerTextInput.value = s.footerText || ''
}

if (settingsModal) {
  // Remplit les champs chaque fois qu'on ouvre Settings (bouton du menu)
  document.querySelectorAll('[data-modal="settings-modal"]').forEach((btn) => {
    btn.addEventListener('click', fillSettingsFieldsFromCurrent)
  })
}

// ---------- Compte requis pour appliquer un changement global ----------

const accountRequiredModal = document.getElementById('account-required-modal')
const accountForm = document.getElementById('account-form')
const accountTabs = document.querySelectorAll('.account-tab')
const accountNameField = document.getElementById('account-name-field')
const accountEmailField = document.getElementById('account-email-field')
const accountLoginField = document.getElementById('account-login-field')
const accountSubmitBtn = document.getElementById('account-submit-btn')
const accountError = document.getElementById('account-error')
let accountMode = 'login'
let currentUser = null // { username, role } une fois connecté

async function refreshCurrentUser() {
  try {
    const res = await fetch('/api/me')
    if (!res.ok) { currentUser = null; return }
    currentUser = await res.json()
    const adminBtn = document.getElementById('goto-admin-btn')
    if (adminBtn) adminBtn.style.display = currentUser.role === 'admin' ? '' : 'none'
  } catch (err) {
    currentUser = null
  }
}
refreshCurrentUser()

function setAccountMode(mode) {
  accountMode = mode
  accountTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === mode))
  const isRegister = mode === 'register'
  accountNameField.style.display = isRegister ? '' : 'none'
  accountEmailField.style.display = isRegister ? '' : 'none'
  accountLoginField.style.display = isRegister ? 'none' : ''
  accountSubmitBtn.textContent = isRegister ? 'Créer mon compte' : 'Se connecter'
  accountError.textContent = ''
}

accountTabs.forEach((tab) => {
  tab.addEventListener('click', () => setAccountMode(tab.dataset.tab))
})

const settingsApplyBtn = document.getElementById('settings-apply-btn')
if (settingsApplyBtn) {
  settingsApplyBtn.addEventListener('click', async () => {
    await refreshCurrentUser()
    if (currentUser) {
      await saveGlobalSettings()
    } else {
      setAccountMode('login')
      accountRequiredModal.classList.add('open')
    }
  })
}

async function saveGlobalSettings() {
  const payload = {
    bgVideoUrl: bgVideoInput.value.trim() || null,
    bgAudioUrl: bgAudioInput.value.trim() || null,
    siteTitle: siteTitleInput.value.trim() || null,
    checkBtnText: checkbtnTextInput.value.trim() || null,
    subtitleText: subtitleTextInput.value.trim() || null,
    footerText: footerTextInput.value.trim() || null,
  }
  try {
    const res = await fetch('/api/site-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json()
      showToast(data.error || "Impossible d'appliquer les changements (réservé à l'admin).", true)
      return
    }
    await loadSiteSettings()
    showToast('✅ Modification réussie')
  } catch (err) {
    showToast('Connexion au serveur impossible.', true)
  }
}

if (accountForm) {
  accountForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    accountError.textContent = ''
    accountSubmitBtn.disabled = true

    try {
      let res
      if (accountMode === 'register') {
        res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('account-name').value.trim(),
            email: document.getElementById('account-email').value.trim(),
            password: document.getElementById('account-password').value,
          }),
        })
      } else {
        res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('account-login-id').value.trim(),
            password: document.getElementById('account-password').value,
          }),
        })
      }
      const data = await res.json()
      if (!res.ok) {
        accountError.textContent = data.error || 'Une erreur est survenue'
        return
      }
      await refreshCurrentUser()
      accountRequiredModal.classList.remove('open')
      await saveGlobalSettings()
    } catch (err) {
      accountError.textContent = 'Connexion au serveur impossible'
    } finally {
      accountSubmitBtn.disabled = false
    }
  })
}

// ---------- Navigation menu : Annonces / Administration ----------

const gotoAnnouncementsBtn = document.getElementById('goto-announcements-btn')
if (gotoAnnouncementsBtn) {
  gotoAnnouncementsBtn.addEventListener('click', () => { window.location.href = '/annonces.html' })
}
const gotoAdminBtn = document.getElementById('goto-admin-btn')
if (gotoAdminBtn) {
  gotoAdminBtn.addEventListener('click', () => { window.location.href = '/admin.html' })
}
