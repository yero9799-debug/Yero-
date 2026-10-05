let mode = 'login' // ou 'register'

const form = document.getElementById('auth-form')
const toggle = document.getElementById('toggle-mode')
const submitBtn = document.getElementById('submit-btn')
const resultEl = document.getElementById('result')
const emailField = document.getElementById('email-field')

function render() {
  if (mode === 'login') {
    submitBtn.textContent = 'Entrer'
    toggle.textContent = 'Pas encore de compte ? Créer un espace'
    emailField.style.display = 'none'
  } else {
    submitBtn.textContent = 'Créer mon espace'
    toggle.textContent = 'Déjà un compte ? Se connecter'
    emailField.style.display = ''
  }
}

toggle.addEventListener('click', (e) => {
  e.preventDefault()
  mode = mode === 'login' ? 'register' : 'login'
  resultEl.className = ''
  render()
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const username = document.getElementById('username').value.trim()
  const email = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value

  resultEl.className = ''
  submitBtn.disabled = true

  try {
    const endpoint = mode === 'login' ? '/api/login' : '/api/register'
    const body = mode === 'login' ? { username, password } : { username, email, password }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) {
      resultEl.classList.add('show', 'error')
      resultEl.textContent = data.error || 'Une erreur est survenue'
    } else {
      window.location.href = '/galerie.html'
    }
  } catch (err) {
    resultEl.classList.add('show', 'error')
    resultEl.textContent = 'Connexion au serveur impossible'
  } finally {
    submitBtn.disabled = false
  }
})

render()
