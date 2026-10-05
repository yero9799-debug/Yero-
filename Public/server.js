require('dotenv').config()
const express = require('express')
const session = require('express-session')
const bcrypt = require('bcrypt')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { pool, initDb } = require('./db')

const app = express()
app.use(express.json())
app.use(express.static('public'))
app.use('/uploads', express.static('uploads'))

const BANCHECK_KEY = process.env.BANCHECK_API_KEY
const SESSION_SECRET = process.env.SESSION_SECRET

if (!SESSION_SECRET) {
  console.error('❌ SESSION_SECRET manquante dans les variables d\'environnement.')
  process.exit(1)
}

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
  },
}))

// ---------- Check spam (BanCheck API v2) ----------

const BANCHECK_BASE = 'https://baron0.com/api/v2'

// Relaie les headers de rate-limit de BanCheck vers notre propre réponse,
// utile si le frontend veut un jour afficher "X vérifications restantes"
function forwardRateLimitHeaders(bcRes, res) {
  ;['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'].forEach((h) => {
    const v = bcRes.headers.get(h)
    if (v) res.set(h, v)
  })
}

app.post('/check', async (req, res) => {
  const { number } = req.body || {}
  if (!number) return res.status(400).json({ error: 'Numéro requis' })
  if (!BANCHECK_KEY) return res.status(500).json({ error: 'Service de vérification non configuré' })

  try {
    const bcRes = await fetch(`${BANCHECK_BASE}/check`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BANCHECK_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number }),
    })
    const body = await bcRes.json()
    forwardRateLimitHeaders(bcRes, res)

    if (!bcRes.ok) {
      // Erreur au format RFC 7807 renvoyée par BanCheck (ex: invalid-key)
      return res.status(bcRes.status).json({ error: body.detail || body.title || 'Erreur du service de vérification' })
    }

    // On transmet tous les champs utiles au frontend
    res.status(bcRes.status).json({
      banned: body.banned,
      status: body.status,
      message: body.message,
      mod_ban: body.mod_ban,
      ban_type: body.ban_type,
      violation_label: body.violation_label,
      violation_category: body.violation_category,
      violation_reason: body.violation_reason,
      in_app_ban_appeal: body.in_app_ban_appeal,
      is_eu: body.is_eu,
    })
  } catch (err) {
    console.error('Erreur BanCheck /check:', err.message)
    res.status(502).json({ error: 'Impossible de contacter le service de vérification' })
  }
})

// ---------- Vérification en masse ----------

app.post('/api/bulk-check', async (req, res) => {
  const { numbers } = req.body || {}
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'Un tableau de numéros est requis' })
  }
  if (!BANCHECK_KEY) return res.status(500).json({ error: 'Service de vérification non configuré' })

  try {
    const bcRes = await fetch(`${BANCHECK_BASE}/bulk-check`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BANCHECK_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ numbers }),
    })
    const body = await bcRes.json()
    forwardRateLimitHeaders(bcRes, res)

    if (!bcRes.ok) {
      return res.status(bcRes.status).json({ error: body.detail || body.title || 'Erreur du service de vérification' })
    }

    res.status(bcRes.status).json({ results: body.results })
  } catch (err) {
    console.error('Erreur BanCheck /bulk-check:', err.message)
    res.status(502).json({ error: 'Impossible de contacter le service de vérification' })
  }
})

// ---------- Statut d'appel (ban appeal) ----------

app.get('/api/appeal-status', async (req, res) => {
  const { phone } = req.query || {}
  if (!phone) return res.status(400).json({ error: 'Paramètre phone requis' })
  if (!BANCHECK_KEY) return res.status(500).json({ error: 'Service de vérification non configuré' })

  try {
    const bcRes = await fetch(`${BANCHECK_BASE}/appeal-status?phone=${encodeURIComponent(phone)}`, {
      headers: { Authorization: `Bearer ${BANCHECK_KEY}` },
    })
    const body = await bcRes.json()

    if (!bcRes.ok) {
      // 404 = pas banni / pas d'appel possible ; on transmet tel quel
      return res.status(bcRes.status).json({ error: body.error || body.detail || 'Statut indisponible' })
    }

    res.status(bcRes.status).json(body)
  } catch (err) {
    console.error('Erreur BanCheck /appeal-status:', err.message)
    res.status(502).json({ error: 'Impossible de contacter le service de vérification' })
  }
})

// ---------- Soumission d'un appel ----------

app.post('/api/appeal-submit', async (req, res) => {
  const { phone, text, isEu } = req.body || {}
  if (!phone || !text) return res.status(400).json({ error: 'phone et text sont requis' })
  if (text.trim().length < 10) return res.status(400).json({ error: "Le texte de l'appel doit contenir au moins 10 caractères" })
  if (!BANCHECK_KEY) return res.status(500).json({ error: 'Service de vérification non configuré' })

  try {
    const bcRes = await fetch(`${BANCHECK_BASE}/appeal-submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BANCHECK_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, text, isEu: !!isEu }),
    })
    const body = await bcRes.json()

    if (!bcRes.ok) {
      // 403 attendu en sandbox (appeal:submit touche le vrai WhatsApp)
      return res.status(bcRes.status).json({ error: body.error || body.detail || "Échec de l'envoi de l'appel" })
    }

    res.status(bcRes.status).json(body)
  } catch (err) {
    console.error('Erreur BanCheck /appeal-submit:', err.message)
    res.status(502).json({ error: 'Impossible de contacter le service de vérification' })
  }
})

// ---------- Comptes (phrase de passe 3+ mots) ----------

function isValidPassphrase(pw) {
  if (typeof pw !== 'string') return false
  const words = pw.trim().split(/\s+/).filter(Boolean)
  return words.length >= 3
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Nom d\'utilisateur requis' })
  }
  if (!isValidPassphrase(password)) {
    return res.status(400).json({ error: 'La phrase de passe doit contenir au moins 3 mots' })
  }

  try {
    const hash = await bcrypt.hash(password, 12)
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.trim(), hash]
    )
    req.session.userId = result.rows[0].id
    req.session.username = result.rows[0].username
    res.json({ ok: true, username: result.rows[0].username })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' })
    }
    console.error('Erreur inscription:', err.message)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants requis' })
  }

  try {
    const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username.trim()])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' })

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) return res.status(401).json({ error: 'Identifiants invalides' })

    req.session.userId = user.id
    req.session.username = user.username
    res.json({ ok: true, username: user.username })
  } catch (err) {
    console.error('Erreur connexion:', err.message)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Non connecté' })
  res.json({ username: req.session.username })
})

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Non connecté' })
  next()
}

// ---------- Galerie perso ----------

const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = `${req.session.userId}-${Date.now()}${path.extname(file.originalname)}`
    cb(null, unique)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 Mo
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
    cb(null, allowed.includes(file.mimetype))
  },
})

app.post('/api/gallery/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier invalide ou manquant' })

  try {
    const result = await pool.query(
      'INSERT INTO gallery_items (user_id, filename, original_name, mime_type) VALUES ($1, $2, $3, $4) RETURNING id, filename, original_name, mime_type, uploaded_at',
      [req.session.userId, req.file.filename, req.file.originalname, req.file.mimetype]
    )
    res.json({ ok: true, item: result.rows[0] })
  } catch (err) {
    console.error('Erreur upload:', err.message)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

app.get('/api/gallery', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, filename, original_name, mime_type, uploaded_at FROM gallery_items WHERE user_id = $1 ORDER BY uploaded_at DESC',
      [req.session.userId]
    )
    res.json({ items: result.rows })
  } catch (err) {
    console.error('Erreur listing galerie:', err.message)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

app.delete('/api/gallery/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT filename FROM gallery_items WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.userId]
    )
    const item = result.rows[0]
    if (!item) return res.status(404).json({ error: 'Fichier introuvable' })

    await pool.query('DELETE FROM gallery_items WHERE id = $1', [req.params.id])
    const filePath = path.join(uploadDir, item.filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    res.json({ ok: true })
  } catch (err) {
    console.error('Erreur suppression:', err.message)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ---------- Démarrage ----------

const PORT = process.env.PORT || 3000

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`✅ YERO-Ban-checker lancé sur le port ${PORT}`))
  })
  .catch((err) => {
    console.error('❌ Erreur d\'initialisation de la base:', err.message)
    process.exit(1)
  })
