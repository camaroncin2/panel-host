import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const serviceNames = ['Minetlan', 'Cretania']
const sessionCookieName = 'panel_host_session'

function parseProperties(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function getServerType(folderName, files, properties) {
  if (files.includes('velocity.toml')) return 'Velocity'
  if (folderName.toLowerCase().includes('neoforge')) return 'NeoForge'
  if (folderName.toLowerCase().includes('purpur')) return 'Purpur'
  if (properties) return 'Minecraft'
  return null
}

function assignService(index) {
  return serviceNames[index % serviceNames.length]
}

async function getDirectorySize(targetPath, depth = 0) {
  if (depth > 2) return 0

  try {
    const entries = await fs.readdir(targetPath, { withFileTypes: true })
    const sizes = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(targetPath, entry.name)
        if (entry.isDirectory()) return getDirectorySize(entryPath, depth + 1)
        const stat = await fs.stat(entryPath)
        return stat.size
      }),
    )

    return sizes.reduce((sum, value) => sum + value, 0)
  } catch {
    return 0
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

async function readServerFiles(serverPath) {
  try {
    const entries = await fs.readdir(serverPath, { withFileTypes: true })
    const visibleEntries = entries
      .filter((entry) => !entry.name.startsWith('.'))
      .slice(0, 30)

    return Promise.all(
      visibleEntries.map(async (entry) => {
        const entryPath = path.join(serverPath, entry.name)
        const stat = await fs.stat(entryPath)
        const size = entry.isDirectory() ? await getDirectorySize(entryPath) : stat.size

        return {
          name: entry.name,
          type: entry.isDirectory() ? 'Carpeta' : 'Archivo',
          size: formatBytes(size),
          updated: stat.mtime.toISOString(),
        }
      }),
    )
  } catch {
    return []
  }
}

function sanitizeLocalText(value, rootPath) {
  const escapedRoot = rootPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const normalizedRoot = rootPath.replaceAll('\\', '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return value
    .replace(new RegExp(escapedRoot, 'gi'), '[server-root]')
    .replace(new RegExp(normalizedRoot, 'gi'), '[server-root]')
    .replace(/[A-Z]:[\\/][^\s'"]+/gi, '[local-path]')
}

async function readLogLines(serverPath, rootPath) {
  const logPath = path.join(serverPath, 'logs', 'latest.log')
  const content = await readTextIfExists(logPath)
  if (!content) return []

  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => sanitizeLocalText(line, rootPath))
    .slice(-80)
}

async function detectServers(rootPath) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true })
  const directories = entries.filter((entry) => entry.isDirectory())
  const detected = []

  for (const directory of directories) {
    const serverPath = path.join(rootPath, directory.name)
    const files = await fs.readdir(serverPath).catch(() => [])
    const propertiesContent = await readTextIfExists(path.join(serverPath, 'server.properties'))
    const properties = propertiesContent ? parseProperties(propertiesContent) : null
    const type = getServerType(directory.name, files, properties)

    if (!type) continue

    const velocityPort = files.includes('velocity.toml')
      ? (await readTextIfExists(path.join(serverPath, 'velocity.toml')))?.match(/bind\s*=\s*"[^:]+:(\d+)"/)?.[1]
      : null
    const port = properties?.['server-port'] ?? velocityPort

    detected.push({
      id: directory.name,
      name: directory.name,
      type,
      status: 'detected',
      address: port ? `localhost:${port}` : 'localhost',
      playersOnline: 0,
      playersLimit: Number(properties?.['max-players'] ?? 0),
      cpu: null,
      ram: null,
      port: port ?? properties?.['server-port'] ?? null,
      files: await readServerFiles(serverPath),
      consoleLines: await readLogLines(serverPath, rootPath),
      database: (await pathExists(path.join(rootPath, 'database_setup.sql')))
        ? { status: 'Detectada', source: 'Configuracion local' }
        : null,
    })
  }

  return detected
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  Object.entries(headers).forEach(([key, value]) => response.setHeader(key, value))
  response.end(JSON.stringify(payload))
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separatorIndex = cookie.indexOf('=')
        if (separatorIndex === -1) return [cookie, '']
        return [cookie.slice(0, separatorIndex), decodeURIComponent(cookie.slice(separatorIndex + 1))]
      }),
  )
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')
  return rawBody ? JSON.parse(rawBody) : {}
}

function getAuthConfig() {
  return {
    username: process.env.PANEL_HOST_ADMIN_USER ?? 'admin',
    password: process.env.PANEL_HOST_ADMIN_PASSWORD ?? 'panelhost',
    token: process.env.PANEL_HOST_SESSION_TOKEN ?? 'panel-host-dev-session',
    isDevelopmentFallback:
      !process.env.PANEL_HOST_ADMIN_USER ||
      !process.env.PANEL_HOST_ADMIN_PASSWORD ||
      !process.env.PANEL_HOST_SESSION_TOKEN,
  }
}

function isAuthenticated(request) {
  const { token } = getAuthConfig()
  const cookies = parseCookies(request.headers.cookie)
  return cookies[sessionCookieName] === token
}

function localPanelApi() {
  return {
    name: 'local-panel-api',
    configureServer(server) {
      server.middlewares.use('/api/auth/session', (request, response) => {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Metodo no permitido' })
          return
        }

        const authenticated = isAuthenticated(request)
        sendJson(response, 200, {
          authenticated,
          user: authenticated ? { name: getAuthConfig().username } : null,
        })
      })

      server.middlewares.use('/api/auth/login', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Metodo no permitido' })
          return
        }

        try {
          const { username, password } = await readJsonBody(request)
          const authConfig = getAuthConfig()

          if (username !== authConfig.username || password !== authConfig.password) {
            sendJson(response, 401, { error: 'Credenciales incorrectas' })
            return
          }

          sendJson(
            response,
            200,
            {
              authenticated: true,
              user: { name: username },
              mode: authConfig.isDevelopmentFallback ? 'development' : 'configured',
            },
            {
              'Set-Cookie': `${sessionCookieName}=${encodeURIComponent(authConfig.token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`,
            },
          )
        } catch {
          sendJson(response, 400, { error: 'Solicitud invalida' })
        }
      })

      server.middlewares.use('/api/auth/logout', (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Metodo no permitido' })
          return
        }

        sendJson(response, 200, { authenticated: false }, {
          'Set-Cookie': `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
        })
      })

      server.middlewares.use('/api/panel/state', async (request, response) => {
        if (!isAuthenticated(request)) {
          sendJson(response, 401, { error: 'Sesion requerida' })
          return
        }

        response.setHeader('Content-Type', 'application/json')

        const rootPath = process.env.PANEL_HOST_LOCAL_ROOT
        if (!rootPath || !(await pathExists(rootPath))) {
          response.end(JSON.stringify({ hosts: [] }))
          return
        }

        try {
          const servers = await detectServers(rootPath)
          const hosts = serviceNames.map((name, index) => {
            const hostServers = servers.filter((_, serverIndex) => assignService(serverIndex) === name)

            return {
              id: name.toLowerCase(),
              name,
              region: 'Servicio de hosting',
              health: hostServers.length ? 100 : null,
              resources: { cpu: null, ram: null, disk: null },
              servers: hostServers,
              index,
            }
          })

          response.end(JSON.stringify({ hosts }))
        } catch (error) {
          response.statusCode = 500
          response.end(JSON.stringify({ error: error.message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localPanelApi()],
})
