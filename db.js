const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Render fournit DATABASE_URL automatiquement quand vous liez une base Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
})

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await pool.query(schema)
  console.log('✅ Base de données initialisée')
}

module.exports = { pool, initDb }
