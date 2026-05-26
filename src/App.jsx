import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Box,
  ChevronDown,
  CirclePause,
  Database,
  FileArchive,
  FileCode2,
  Folder,
  FolderUp,
  Gauge,
  HardDrive,
  History,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Moon,
  Play,
  Power,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Sun,
  TerminalSquare,
  UserCog,
  Users,
} from 'lucide-react'
import './App.css'

const hostingGroups = [
  {
    id: 'minetlan',
    name: 'Minetlan',
    region: 'Servicio de hosting',
    health: null,
    resources: { cpu: null, ram: null, disk: null },
    servers: [],
  },
  {
    id: 'cretania',
    name: 'Cretania',
    region: 'Servicio de hosting',
    health: null,
    resources: { cpu: null, ram: null, disk: null },
    servers: [],
  },
]

const emptyGroups = hostingGroups

const sections = [
  ['summary', LayoutDashboard, 'Resumen'],
  ['console', TerminalSquare, 'Consolas'],
  ['files', Folder, 'Archivos'],
  ['database', Database, 'Bases de datos'],
  ['activity', Activity, 'Actividad'],
  ['nodes', Server, 'Nodos'],
  ['settings', Settings, 'Ajustes'],
]

const uploadDestinations = ['/mods', '/plugins', '/config', '/world', '/logs', '/']

const permissionProfiles = [
  {
    id: 'owner',
    name: 'Administrador',
    detail: 'Acceso completo al panel',
    permissions: ['Consola', 'Archivos', 'Base de datos', 'Nodos', 'Ajustes'],
  },
  {
    id: 'operator',
    name: 'Operador',
    detail: 'Gestion operativa de servidores',
    permissions: ['Consola', 'Archivos', 'Actividad'],
  },
  {
    id: 'viewer',
    name: 'Lectura',
    detail: 'Consulta sin acciones criticas',
    permissions: ['Resumen', 'Actividad'],
  },
]

const panelUsers = [
  { id: 'admin', name: 'admin', role: 'Administrador', status: 'Activo' },
  { id: 'staff', name: 'staff', role: 'Operador', status: 'Pendiente' },
  { id: 'viewer', name: 'viewer', role: 'Lectura', status: 'Pendiente' },
]

function classNames(...items) {
  return items.filter(Boolean).join(' ')
}

function formatValue(value, suffix = '') {
  return value === null || value === undefined ? '-' : `${value}${suffix}`
}

function getFileEditorMetadata(filePath = '') {
  const fileName = filePath.split('/').pop() ?? ''
  const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
  const metadataByExtension = {
    json: { label: 'JSON', className: 'json' },
    properties: { label: 'Properties', className: 'properties' },
    toml: { label: 'TOML', className: 'config' },
    yml: { label: 'YAML', className: 'config' },
    yaml: { label: 'YAML', className: 'config' },
    log: { label: 'Log', className: 'log' },
    txt: { label: 'Texto', className: 'text' },
    bat: { label: 'Batch', className: 'script' },
    sh: { label: 'Shell', className: 'script' },
  }

  return metadataByExtension[extension] ?? { label: extension ? extension.toUpperCase() : 'Texto', className: 'text' }
}

function getEditorLineClass(line, type) {
  const trimmedLine = line.trim()

  if (!trimmedLine) return 'empty'
  if (trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) return 'comment'
  if (type === 'json' && /^[{}[\],]+$/.test(trimmedLine)) return 'structure'
  if (type === 'log' && /\b(ERROR|WARN)\b/i.test(trimmedLine)) return 'warning'
  if (type === 'script' && /^(@echo|set |cd |java|\.\/|#)!?/i.test(trimmedLine)) return 'command'
  if (trimmedLine.includes('=')) return 'property'
  if (trimmedLine.includes(':')) return 'property'
  return 'text'
}

function EditorLinePreview({ content, type }) {
  const lines = content.split('\n')

  return (
    <div className="editor-preview" aria-hidden="true">
      {lines.map((line, index) => (
        <div className={classNames('editor-preview-line', getEditorLineClass(line, type))} key={`${index}-${line}`}>
          <span>{index + 1}</span>
          <code>{line || ' '}</code>
        </div>
      ))}
    </div>
  )
}

const Metric = memo(function Metric({ icon: Icon, label, value, detail }) {
  return (
    <article className="metric">
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
})

const StatusPill = memo(function StatusPill({ status }) {
  const labels = {
    detected: 'Detectado',
    online: 'Online',
    offline: 'Offline',
    maintenance: 'Mantenimiento',
  }

  return <span className={classNames('status-pill', status ?? 'idle')}>{labels[status] ?? 'Sin seleccion'}</span>
})

const ServerPowerState = memo(function ServerPowerState({ status }) {
  const state =
    status === 'offline'
      ? { label: 'Apagado', className: 'off' }
      : status === 'maintenance'
        ? { label: 'Reiniciando', className: 'restarting' }
        : status
          ? { label: 'Encendido', className: 'on' }
          : { label: 'Sin estado', className: 'idle' }

  return (
    <span className={classNames('power-state', state.className)}>
      <i />
      {state.label}
    </span>
  )
})

const EmptyState = memo(function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="empty-state">
      <div>
        <Icon size={20} />
      </div>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
})

const LoginScreen = memo(function LoginScreen({ error, form, isLoading, onChange, onSubmit }) {
  return (
    <main className="login-shell">
      <section className="login-card" aria-label="Acceso seguro">
        <div className="login-brand">
          <div className="brand-mark">
            <Box size={24} />
          </div>
          <div>
            <span>Panel Host</span>
            <strong>Minecraft</strong>
          </div>
        </div>

        <div className="login-heading">
          <LockKeyhole size={22} />
          <div>
            <h1>Acceso al panel</h1>
            <p>Ingresa con una cuenta autorizada para continuar.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Usuario
            <input
              autoComplete="username"
              name="identifier"
              onChange={onChange}
              placeholder="Usuario"
              required
              value={form.identifier}
            />
          </label>
          <label>
            Contrasena
            <input
              autoComplete="current-password"
              name="password"
              onChange={onChange}
              placeholder="Contrasena"
              required
              type="password"
              value={form.password}
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Validando' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
})

function App() {
  const [authStatus, setAuthStatus] = useState('checking')
  const [authUser, setAuthUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [hostGroups, setHostGroups] = useState(emptyGroups)
  const [isLoading, setIsLoading] = useState(true)
  const [activeHostId, setActiveHostId] = useState('minetlan')
  const [activeServerId, setActiveServerId] = useState(null)
  const [activeSection, setActiveSection] = useState('console')
  const [fileSearch, setFileSearch] = useState('')
  const [nodeSearch, setNodeSearch] = useState('')
  const [uploadTargetPath, setUploadTargetPath] = useState('/mods')
  const [selectedUploadServers, setSelectedUploadServers] = useState([])
  const [currentFilePath, setCurrentFilePath] = useState('')
  const [fileEntries, setFileEntries] = useState([])
  const [isFileBrowserLoading, setIsFileBrowserLoading] = useState(false)
  const [fileBrowserError, setFileBrowserError] = useState('')
  const [openedFile, setOpenedFile] = useState(null)
  const [editorDraft, setEditorDraft] = useState('')
  const [isSavingFile, setIsSavingFile] = useState(false)
  const consoleLogRef = useRef(null)
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('panel-host-theme')
    if (savedTheme) return savedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const deferredFileSearch = useDeferredValue(fileSearch)
  const deferredNodeSearch = useDeferredValue(nodeSearch)
  const activeHost = useMemo(
    () => hostGroups.find((group) => group.id === activeHostId) ?? hostGroups[0],
    [activeHostId, hostGroups],
  )
  const activeServer = useMemo(
    () => activeHost.servers.find((serverItem) => serverItem.id === activeServerId) ?? null,
    [activeHost, activeServerId],
  )

  useEffect(() => {
    window.localStorage.setItem('panel-host-theme', theme)
  }, [theme])

  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' })
        const data = await response.json()

        if (!isMounted) return
        setAuthUser(data.authenticated ? data.user : null)
        setAuthStatus(data.authenticated ? 'authenticated' : 'unauthenticated')
      } catch {
        if (isMounted) setAuthStatus('unauthenticated')
      }
    }

    checkSession()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (authStatus !== 'authenticated') return undefined

    let isMounted = true

    async function loadPanelState() {
      try {
        const response = await fetch('/api/panel/state', { credentials: 'include' })
        if (response.status === 401) {
          setAuthUser(null)
          setAuthStatus('unauthenticated')
          return
        }
        if (!response.ok) throw new Error('No se pudo cargar el estado')
        const data = await response.json()
        const nextGroups = data.hosts?.length ? data.hosts : emptyGroups

        if (!isMounted) return
        setHostGroups(nextGroups)
        setActiveHostId((currentHostId) => {
          if (nextGroups.some((group) => group.id === currentHostId)) return currentHostId
          return nextGroups[0]?.id ?? 'minetlan'
        })
        setActiveServerId((currentServerId) => {
          if (nextGroups.some((group) => group.servers.some((serverItem) => serverItem.id === currentServerId))) {
            return currentServerId
          }
          return nextGroups[0]?.servers[0]?.id ?? null
        })
        setSelectedUploadServers((currentServers) => {
          const validIds = new Set(nextGroups.flatMap((group) => group.servers.map((serverItem) => serverItem.id)))
          const filteredServers = currentServers.filter((serverId) => validIds.has(serverId))
          return filteredServers.length ? filteredServers : nextGroups[0]?.servers.slice(0, 2).map((serverItem) => serverItem.id) ?? []
        })
      } catch {
        if (isMounted) setHostGroups(emptyGroups)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadPanelState()
    return () => {
      isMounted = false
    }
  }, [authStatus])

  useEffect(() => {
    if (activeSection !== 'files' || !activeServer) return undefined

    let isMounted = true

    async function loadFiles() {
      if (!currentFilePath) return

      setIsFileBrowserLoading(true)
      setFileBrowserError('')

      try {
        const params = new URLSearchParams({ server: activeServer.id, path: currentFilePath })
        const response = await fetch(`/api/panel/files?${params.toString()}`, { credentials: 'include' })
        const data = await response.json().catch(() => ({}))

        if (!isMounted) return
        if (!response.ok) {
          setFileEntries([])
          setFileBrowserError(data.error ?? 'No se pudo abrir la carpeta.')
          return
        }

        setFileEntries(data.files ?? [])
      } catch {
        if (isMounted) {
          setFileEntries([])
          setFileBrowserError('No se pudo conectar con el explorador de archivos.')
        }
      } finally {
        if (isMounted) setIsFileBrowserLoading(false)
      }
    }

    loadFiles()
    return () => {
      isMounted = false
    }
  }, [activeSection, activeServer, currentFilePath])

  useEffect(() => {
    if (activeSection !== 'console') return

    requestAnimationFrame(() => {
      if (!consoleLogRef.current) return
      consoleLogRef.current.scrollTop = consoleLogRef.current.scrollHeight
    })
  }, [activeSection, activeServer?.id, activeServer?.consoleLines])

  const updateLoginForm = useCallback((event) => {
    const { name, value } = event.target
    setLoginForm((currentForm) => ({ ...currentForm, [name]: value }))
  }, [])

  const submitLogin = useCallback(async (event) => {
    event.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.user) {
        setLoginError(data.error ?? 'No se pudo iniciar sesion.')
        return
      }

      setAuthUser(data.user)
      setAuthStatus('authenticated')
      setLoginForm({ identifier: '', password: '' })
    } catch {
      setLoginError('No se pudo conectar con el servicio de autenticacion.')
    } finally {
      setIsLoggingIn(false)
    }
  }, [loginForm])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setAuthUser(null)
    setAuthStatus('unauthenticated')
    setHostGroups(emptyGroups)
    setActiveServerId(null)
  }, [])

  const currentFileEntries = useMemo(
    () => (currentFilePath ? fileEntries : activeServer?.files ?? []),
    [activeServer, currentFilePath, fileEntries],
  )
  const visibleFiles = useMemo(
    () =>
      currentFileEntries
        ?.filter((file) => file.name.toLowerCase().includes(deferredFileSearch.trim().toLowerCase()))
        .toSorted((firstFile, secondFile) => {
        if (firstFile.type !== secondFile.type) return firstFile.type === 'Carpeta' ? -1 : 1
        return firstFile.name.localeCompare(secondFile.name)
        }) ?? [],
    [currentFileEntries, deferredFileSearch],
  )
  const filePathSegments = currentFilePath ? currentFilePath.split('/').filter(Boolean) : []
  const editorMetadata = useMemo(
    () => getFileEditorMetadata(openedFile?.path),
    [openedFile?.path],
  )
  const editorLineCount = editorDraft ? editorDraft.split('\n').length : 0

  const totals = useMemo(() => {
    const allServers = hostGroups.flatMap((group) => group.servers)
    const online = allServers.filter((serverItem) => serverItem.status === 'online').length
    const players = allServers.reduce((sum, serverItem) => sum + (serverItem.playersOnline ?? 0), 0)

    return { servers: allServers.length, online, players, allServers }
  }, [hostGroups])
  const recentAlerts = useMemo(
    () =>
      totals.allServers
        .flatMap((serverItem) =>
          (serverItem.consoleLines ?? [])
            .filter((line) => /\b(ERROR|WARN)\b/i.test(line))
            .slice(-2)
            .map((line) => ({ server: serverItem.name, line })),
        )
        .slice(-6)
        .reverse(),
    [totals.allServers],
  )
  const visibleNodes = useMemo(
    () =>
      hostGroups.filter((group) =>
        group.name.toLowerCase().includes(deferredNodeSearch.trim().toLowerCase()),
      ),
    [deferredNodeSearch, hostGroups],
  )
  const activeSectionData = useMemo(
    () => sections.find(([id]) => id === activeSection) ?? sections[0],
    [activeSection],
  )
  const ActiveSectionIcon = activeSectionData[1]

  const selectHost = useCallback((hostId) => {
    const nextHost = hostGroups.find((group) => group.id === hostId)
    setActiveHostId(hostId)
    setActiveServerId(nextHost?.servers[0]?.id ?? null)
    setSelectedUploadServers(nextHost?.servers.slice(0, 2).map((serverItem) => serverItem.id) ?? [])
    setCurrentFilePath('')
    setFileEntries([])
    setOpenedFile(null)
    setEditorDraft('')
    setFileBrowserError('')
  }, [hostGroups])

  const selectServer = useCallback((serverId) => {
    setActiveServerId(serverId)
    setCurrentFilePath('')
    setFileEntries([])
    setOpenedFile(null)
    setEditorDraft('')
    setFileBrowserError('')
  }, [])

  const toggleUploadServer = useCallback((serverId) => {
    setSelectedUploadServers((currentServers) =>
      currentServers.includes(serverId)
        ? currentServers.filter((currentServerId) => currentServerId !== serverId)
      : [...currentServers, serverId],
    )
  }, [])

  const openFolder = useCallback((folderPath) => {
    setCurrentFilePath(folderPath)
    setOpenedFile(null)
    setEditorDraft('')
  }, [])

  const openFile = useCallback(async (file) => {
    if (!activeServer) return

    setFileBrowserError('')
    setOpenedFile({ name: file.name, path: file.path, isLoading: true })
    setEditorDraft('')

    try {
      const params = new URLSearchParams({ server: activeServer.id, path: file.path })
      const response = await fetch(`/api/panel/file?${params.toString()}`, { credentials: 'include' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setOpenedFile(null)
        setFileBrowserError(data.error ?? 'No se pudo abrir el archivo.')
        return
      }

      setOpenedFile({ name: data.name, path: data.path, updated: data.updated, isLoading: false })
      setEditorDraft(data.content ?? '')
    } catch {
      setOpenedFile(null)
      setFileBrowserError('No se pudo conectar con el editor de archivos.')
    }
  }, [activeServer])

  const saveOpenedFile = useCallback(async () => {
    if (!activeServer || !openedFile) return

    setIsSavingFile(true)
    setFileBrowserError('')

    try {
      const response = await fetch('/api/panel/file', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: activeServer.id,
          path: openedFile.path,
          content: editorDraft,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFileBrowserError(data.error ?? 'No se pudo guardar el archivo.')
        return
      }

      setOpenedFile((currentFile) => currentFile ? { ...currentFile, saved: true } : currentFile)
    } catch {
      setFileBrowserError('No se pudo conectar con el servicio de guardado.')
    } finally {
      setIsSavingFile(false)
    }
  }, [activeServer, editorDraft, openedFile])

  if (authStatus !== 'authenticated') {
    return (
      <LoginScreen
        error={loginError}
        form={loginForm}
        isLoading={isLoggingIn || authStatus === 'checking'}
        onChange={updateLoginForm}
        onSubmit={submitLogin}
      />
    )
  }

  return (
    <div className={classNames('app-shell', theme === 'dark' && 'theme-dark')}>
      <aside className="sidebar" aria-label="Panel principal">
        <div className="brand">
          <div className="brand-mark">
            <Box size={22} />
          </div>
          <div>
            <strong>Panel Host</strong>
            <span>Minecraft</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Secciones">
          <label className="mobile-section-select">
            <span>
              <ActiveSectionIcon size={18} />
              <strong>{activeSectionData[2]}</strong>
            </span>
            <select
              aria-label="Cambiar seccion"
              value={activeSection}
              onChange={(event) => setActiveSection(event.target.value)}
            >
              {sections.map(([id, , label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={18} />
          </label>

          {sections.map(([id, Icon, label]) => (
            <button
              className={classNames(activeSection === id && 'active')}
              key={id}
              onClick={() => setActiveSection(id)}
              type="button"
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="host-switcher">
          <span className="section-label">Servicios</span>
          {hostGroups.map((group) => (
            <button
              className={classNames('host-button', group.id === activeHostId && 'selected')}
              key={group.id}
              onClick={() => selectHost(group.id)}
              type="button"
            >
              <Server size={17} />
              <span>
                <strong>{group.name}</strong>
                <small>{isLoading ? 'Cargando' : `${group.servers.length} servidores`}</small>
              </span>
              <i>{formatValue(group.health, '%')}</i>
            </button>
          ))}
        </div>

        <div className="sidebar-server-switcher">
          <span className="section-label">Servidores</span>
          {activeHost.servers.length === 0 ? (
            <div className="sidebar-empty-note">
              {isLoading ? 'Cargando servidores.' : 'Sin servidores conectados.'}
            </div>
          ) : (
            activeHost.servers.map((serverItem) => (
              <button
                className={classNames('sidebar-server-button', serverItem.id === activeServer?.id && 'selected')}
                key={serverItem.id}
                onClick={() => selectServer(serverItem.id)}
                type="button"
              >
                <span className="server-dot" />
                <span>
                  <strong>{serverItem.name}</strong>
                  <small>{serverItem.type}</small>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-footer session-footer">
          <ShieldCheck size={18} />
          <span>{authUser?.name ?? 'Sesion activa'}</span>
          <button aria-label="Cerrar sesion" className="logout-button" onClick={logout} type="button">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="title-group">
            <span className="eyebrow">Operacion central</span>
            <h1>Gestion de servidores Minecraft</h1>
          </div>
          {!['summary', 'nodes'].includes(activeSection) && (
            <section className="header-metrics" aria-label="Resumen">
              <Metric icon={Users} label="Jugadores" value={totals.players} detail="conectados" />
              <Metric icon={Gauge} label="Salud del nodo" value={formatValue(activeHost.health, '%')} detail={activeHost.region} />
              <Metric icon={HardDrive} label="Disco" value={formatValue(activeHost.resources.disk, '%')} detail="uso actual" />
            </section>
          )}
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={18} />
              <input placeholder="Buscar" />
            </label>
            <button
              className="icon-button"
              type="button"
              aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo noche'}
              onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button className="icon-button" type="button" aria-label="Historial">
              <History size={19} />
            </button>
          </div>
        </header>

        {activeSection === 'summary' && (
          <section className="summary-panel" id="overview">
            <div className="summary-grid">
              <section className="summary-card service-status-card">
                <div className="summary-heading">
                  <div>
                    <span className="section-label">Estado de servicios</span>
                    <h2>Hosting</h2>
                  </div>
                  <button className="soft-button" type="button">Sincronizar</button>
                </div>
                <div className="service-list">
                  {hostGroups.map((group) => (
                    <article key={group.id}>
                      <div>
                        <strong>{group.name}</strong>
                        <span>{group.servers.length} servidores</span>
                      </div>
                      <b>{formatValue(group.health, '%')}</b>
                    </article>
                  ))}
                </div>
              </section>

              <section className="summary-card quick-actions-card">
                <div className="summary-heading">
                  <div>
                    <span className="section-label">Acciones rapidas</span>
                    <h2>Operaciones</h2>
                  </div>
                </div>
                <div className="quick-actions">
                  <button type="button" onClick={() => setActiveSection('console')}>
                    <TerminalSquare size={17} />
                    Consola
                  </button>
                  <button type="button" onClick={() => setActiveSection('files')}>
                    <Folder size={17} />
                    Archivos
                  </button>
                  <button type="button" onClick={() => setActiveSection('database')}>
                    <Database size={17} />
                    Base de datos
                  </button>
                  <button type="button" onClick={() => setActiveSection('activity')}>
                    <Activity size={17} />
                    Actividad
                  </button>
                </div>
              </section>

              <section className="summary-card servers-summary-card">
                <div className="summary-heading">
                  <div>
                    <span className="section-label">Servidores</span>
                    <h2>Instancias detectadas</h2>
                  </div>
                </div>
                <div className="summary-server-table">
                  {totals.allServers.map((serverItem) => (
                    <button
                      key={serverItem.id}
                      onClick={() => {
                        const nextHost = hostGroups.find((group) =>
                          group.servers.some((item) => item.id === serverItem.id),
                        )
                        setActiveHostId(nextHost?.id ?? activeHostId)
                        selectServer(serverItem.id)
                        setActiveSection('console')
                      }}
                      type="button"
                    >
                      <span>{serverItem.name}</span>
                      <small>{serverItem.type}</small>
                      <StatusPill status={serverItem.status} />
                      <b>{serverItem.port ?? '-'}</b>
                    </button>
                  ))}
                </div>
              </section>

              <section className="summary-card alerts-card">
                <div className="summary-heading">
                  <div>
                    <span className="section-label">Alertas recientes</span>
                    <h2>Logs</h2>
                  </div>
                </div>
                {recentAlerts.length ? (
                  <div className="alerts-list">
                    {recentAlerts.map((alert, index) => (
                      <article key={`${alert.server}-${index}`}>
                        <strong>{alert.server}</strong>
                        <span>{alert.line}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Activity}
                    title="Sin alertas"
                    body="No hay eventos importantes detectados."
                  />
                )}
              </section>
            </div>
          </section>
        )}

        {activeSection === 'nodes' && (
          <section className="nodes-only-panel" id="nodes">
            <section className="tool-panel content-panel nodes-panel">
              <div className="nodes-toolbar">
                <div>
                  <span className="section-label">Nodos remotos</span>
                  <strong>Servicios conectados</strong>
                </div>
                <label className="node-search">
                  <Search size={16} />
                  <input
                    placeholder="Buscar nodo"
                    value={nodeSearch}
                    onChange={(event) => setNodeSearch(event.target.value)}
                  />
                </label>
                <button className="soft-button" type="button">Actualizar</button>
              </div>

              <p className="nodes-note">
                Los nodos representan cada servicio de hosting conectado. La consola y archivos usan esta conexion para operar sobre sus servidores.
              </p>

              <div className="node-grid">
                {visibleNodes.map((group, index) => (
                  <article className="node-card" key={group.id}>
                    <div className="node-card-heading">
                      <div>
                        <Server size={17} />
                        <strong>{group.name}</strong>
                      </div>
                      <div className="node-actions" aria-label="Acciones del nodo">
                        <Folder size={15} />
                        <TerminalSquare size={15} />
                        <Settings size={15} />
                      </div>
                    </div>

                    <div className="node-facts">
                      <div>
                        <span>Direccion de conexion</span>
                        <strong>localhost:{24444 + index}</strong>
                      </div>
                      <div>
                        <span>Estado del nodo</span>
                        <b className="node-online">En linea</b>
                      </div>
                      <div>
                        <span>Conexion directa</span>
                        <b className="node-online">Normal</b>
                      </div>
                      <div>
                        <span>Estado de instancia</span>
                        <strong>{group.servers.length}/{Math.max(group.servers.length + 3, 6)}</strong>
                      </div>
                      <div>
                        <span>Plataforma</span>
                        <strong>Windows local</strong>
                      </div>
                      <div>
                        <span>Version</span>
                        <b className="node-online">Preparado</b>
                      </div>
                    </div>

                    <div className="node-charts">
                      <div>
                        <span>Uso de CPU</span>
                        <strong>{formatValue(group.resources.cpu, '%')}</strong>
                        <svg viewBox="0 0 180 52" role="img" aria-label="Uso de CPU">
                          <polyline points="0,38 18,40 36,34 54,36 72,25 90,31 108,39 126,36 144,37 162,35 180,38" />
                        </svg>
                      </div>
                      <div>
                        <span>Uso de memoria</span>
                        <strong>{formatValue(group.resources.ram, '%')}</strong>
                        <svg viewBox="0 0 180 52" role="img" aria-label="Uso de memoria">
                          <defs>
                            <linearGradient id={`memory-full-${group.id}`} x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="currentColor" stopOpacity="0.38" />
                              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          <path d="M0 18 H180 V52 H0 Z" fill={`url(#memory-full-${group.id})`} />
                          <polyline points="0,18 180,18" />
                        </svg>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {!['summary', 'nodes'].includes(activeSection) && (
        <section className={classNames('dashboard-grid', activeSection !== 'files' && 'single-detail')} id={activeSection}>
          {activeSection === 'files' && (
          <div className="server-panel files-server-panel">
            <div className="panel-heading">
              <div>
                <span className="section-label">Servidores en {activeHost.name}</span>
                <h2>Instancias</h2>
                <p>{totals.servers} servidores registrados</p>
              </div>
              <button className="soft-button" type="button">
                <RefreshCw size={16} />
                Sincronizar
              </button>
            </div>

              <section className="bulk-upload-panel" aria-label="Subida multiple">
                <div className="bulk-upload-heading">
                  <FolderUp size={17} />
                  <div>
                    <strong>Subida multiple</strong>
                    <span>{selectedUploadServers.length} servidores seleccionados</span>
                  </div>
                </div>

                <div className="upload-pickers">
                  <label className="upload-picker-card">
                    <input type="file" />
                    <FileArchive size={16} />
                    <span>Archivo</span>
                    <strong>Seleccionar</strong>
                  </label>
                  <label className="upload-picker-card">
                    <input directory="" type="file" webkitdirectory="" />
                    <Folder size={16} />
                    <span>Carpeta</span>
                    <strong>Seleccionar</strong>
                  </label>
                </div>

                <label className="destination-input">
                  Ruta destino
                  <select
                    value={uploadTargetPath}
                    onChange={(event) => setUploadTargetPath(event.target.value)}
                  >
                    {uploadDestinations.map((destination) => (
                      <option key={destination} value={destination}>
                        {destination}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="upload-server-list">
                  {activeHost.servers.map((serverItem) => (
                    <label key={serverItem.id}>
                      <input
                        checked={selectedUploadServers.includes(serverItem.id)}
                        onChange={() => toggleUploadServer(serverItem.id)}
                        type="checkbox"
                      />
                      <span>{serverItem.name}</span>
                    </label>
                  ))}
                </div>

                <button className="soft-button upload-action" disabled={!selectedUploadServers.length} type="button">
                  Preparar subida
                </button>
              </section>
          </div>
          )}

          <section className={classNames('right-panel', activeSection !== 'console' && 'content-only')} aria-label="Detalle del servidor seleccionado">
            {activeSection === 'console' && (
            <section className="tool-panel console-panel" id="console">
                <div className="terminal-header">
                  <span>
                    <Power size={14} />
                    Consola
                  </span>
                  <button type="button" disabled={!activeServer}>
                    <CirclePause size={15} />
                    Pausar
                  </button>
                </div>
                {activeServer?.consoleLines?.length ? (
                  <pre ref={consoleLogRef}>
                    {activeServer.consoleLines.map((line, index) => (
                      <code key={`${line}-${index}`}>{line}</code>
                    ))}
                  </pre>
                ) : (
                  <EmptyState
                    icon={TerminalSquare}
                    title="Consola sin datos"
                    body="Selecciona un servidor conectado para ver la salida."
                  />
                )}
                <div className="command-line">
                  <span>/</span>
                  <input placeholder="Comando" disabled={!activeServer} />
                <button type="button" disabled={!activeServer}>Enviar</button>
              </div>
            </section>
            )}

            {activeSection === 'files' && (
              <section className="tool-panel content-panel" id="files">
                <div className="table-header files-header">
                  <div>
                    <strong>Archivos</strong>
                    <span>{activeServer?.name ?? 'Sin servidor seleccionado'}</span>
                  </div>
                  <label className="file-search">
                    <Search size={16} />
                    <input
                      placeholder="Buscar archivo"
                      value={fileSearch}
                      onChange={(event) => setFileSearch(event.target.value)}
                    />
                  </label>
                  <button className="soft-button" type="button" disabled={!activeServer}>Subir</button>
                </div>
                <div className="file-browser-toolbar" aria-label="Ruta actual">
                  <button type="button" onClick={() => openFolder('')} disabled={!currentFilePath}>
                    Raiz
                  </button>
                  {filePathSegments.map((segment, index) => {
                    const segmentPath = filePathSegments.slice(0, index + 1).join('/')

                    return (
                      <button key={segmentPath} type="button" onClick={() => openFolder(segmentPath)}>
                        {segment}
                      </button>
                    )
                  })}
                  {isFileBrowserLoading && <span>Cargando</span>}
                </div>
                {fileBrowserError && <div className="file-browser-error">{fileBrowserError}</div>}
                {visibleFiles.length ? (
                  <div className="file-table">
                    {visibleFiles.map((file) => {
                      const Icon = file.type === 'Carpeta' ? Folder : file.name.endsWith('.properties') ? FileCode2 : FileArchive
                      const filePath = file.path ?? file.name

                      return (
                        <button
                          className="file-row"
                          key={filePath}
                          onClick={() => (file.type === 'Carpeta' ? openFolder(filePath) : openFile({ ...file, path: filePath }))}
                          type="button"
                        >
                          <Icon size={18} />
                          <strong>{file.name}</strong>
                          <span>{file.type}</span>
                          <span>{file.size}</span>
                          <small>{new Date(file.updated).toLocaleString()}</small>
                        </button>
                      )
                    })}
                  </div>
                ) : currentFileEntries.length ? (
                  <EmptyState
                    icon={Search}
                    title="Sin resultados"
                    body="No hay archivos que coincidan con la busqueda."
                  />
                ) : currentFilePath ? (
                  <EmptyState
                    icon={Folder}
                    title="Carpeta vacia"
                    body="No hay archivos visibles en esta ruta."
                  />
                ) : (
                  <EmptyState
                    icon={Folder}
                    title="Sin archivos cargados"
                    body="Selecciona un servidor conectado."
                  />
                )}
              </section>
            )}

            {activeSection === 'files' && openedFile && (
              <div className="file-editor-overlay" role="presentation">
                <section className="file-editor-modal" aria-label="Editor de archivo" role="dialog" aria-modal="true">
                  <div className="file-editor-header">
                    <div>
                      <span>Archivo abierto</span>
                      <strong>{openedFile.path}</strong>
                      <small>{editorLineCount} lineas</small>
                    </div>
                    <span className={classNames('file-type-pill', editorMetadata.className)}>
                      {editorMetadata.label}
                    </span>
                    <div>
                      <button className="soft-button" type="button" onClick={() => setOpenedFile(null)}>
                        Cerrar
                      </button>
                      <button
                        className="soft-button"
                        type="button"
                        disabled={openedFile.isLoading || isSavingFile}
                        onClick={saveOpenedFile}
                      >
                        {isSavingFile ? 'Guardando' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                  <div
                    className={classNames('file-editor-surface', editorMetadata.className)}
                    style={{ '--editor-textarea-height': `${Math.max(editorLineCount * 20 + 28, 260)}px` }}
                  >
                    <EditorLinePreview content={editorDraft} type={editorMetadata.className} />
                    <textarea
                      disabled={openedFile.isLoading}
                      value={editorDraft}
                      onChange={(event) => setEditorDraft(event.target.value)}
                      spellCheck="false"
                      aria-label={`Editar ${openedFile.path}`}
                    />
                  </div>
                </section>
              </div>
            )}

            {activeSection === 'database' && (
              <section className="tool-panel content-panel" id="database">
                <div className="table-header">
                  <strong>Base de datos</strong>
                  <button className="soft-button" type="button" disabled={!activeServer}>Credenciales</button>
                </div>
                {activeServer?.database ? (
                  <div className="database-grid">
                    <div>
                      <span>Estado</span>
                      <strong>{activeServer.database.status}</strong>
                    </div>
                    <div>
                      <span>Origen</span>
                      <strong>{activeServer.database.source}</strong>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Database}
                    title="Sin base de datos"
                    body="La configuracion aparecera aqui."
                  />
                )}
              </section>
            )}

            {activeSection === 'activity' && (
              <section className="tool-panel content-panel activity-panel">
                <EmptyState
                  icon={Activity}
                  title="Sin actividad"
                  body="Los eventos del servidor apareceran aqui."
                />
              </section>
            )}

            {activeSection === 'settings' && (
              <section className="tool-panel content-panel settings-panel" id="settings">
                <div className="settings-header">
                  <div>
                    <span className="section-label">Configuracion del panel</span>
                    <strong>Ajustes de seguridad y acceso</strong>
                  </div>
                  <button className="soft-button" type="button">
                    <RefreshCw size={16} />
                    Sincronizar
                  </button>
                </div>

                <div className="settings-grid">
                  <section className="settings-card sftp-card" aria-label="Conexion SFTP">
                    <div className="settings-card-heading">
                      <div className="settings-icon">
                        <KeyRound size={19} />
                      </div>
                      <div>
                        <span>SFTP</span>
                        <strong>Conexion de archivos</strong>
                      </div>
                      <span className="settings-backend-pill">Backend</span>
                    </div>

                    <div className="sftp-fields">
                      <div>
                        <span>Servicio</span>
                        <strong>{activeHost.name}</strong>
                      </div>
                      <div>
                        <span>Servidor</span>
                        <strong>{activeServer?.name ?? 'Sin seleccionar'}</strong>
                      </div>
                      <div>
                        <span>Host</span>
                        <strong>Pendiente</strong>
                      </div>
                      <div>
                        <span>Puerto</span>
                        <strong>Pendiente</strong>
                      </div>
                      <div>
                        <span>Usuario</span>
                        <strong>Pendiente</strong>
                      </div>
                      <div>
                        <span>Ruta base</span>
                        <strong>Pendiente</strong>
                      </div>
                    </div>

                    <div className="settings-note">
                      <ShieldCheck size={16} />
                      <span>Los datos reales se cargaran desde el backend y no quedaran escritos en el frontend.</span>
                    </div>

                    <div className="settings-actions">
                      <button className="soft-button" type="button" disabled>
                        Probar conexion
                      </button>
                      <button className="soft-button" type="button" disabled>
                        Guardar SFTP
                      </button>
                    </div>
                  </section>

                  <section className="settings-card permissions-card" aria-label="Permisos de usuarios">
                    <div className="settings-card-heading">
                      <div className="settings-icon">
                        <UserCog size={19} />
                      </div>
                      <div>
                        <span>Usuarios</span>
                        <strong>Permisos del panel</strong>
                      </div>
                      <button className="soft-button" type="button" disabled>
                        Agregar usuario
                      </button>
                    </div>

                    <div className="permission-profiles">
                      {permissionProfiles.map((profile) => (
                        <article key={profile.id}>
                          <div>
                            <strong>{profile.name}</strong>
                            <span>{profile.detail}</span>
                          </div>
                          <div>
                            {profile.permissions.map((permission) => (
                              <span key={permission}>{permission}</span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="user-permission-table">
                      <div className="user-permission-head">
                        <span>Usuario</span>
                        <span>Rol</span>
                        <span>Estado</span>
                        <span>Acceso</span>
                      </div>
                      {panelUsers.map((user) => (
                        <div className="user-permission-row" key={user.id}>
                          <strong>{user.name}</strong>
                          <span>{user.role}</span>
                          <span className={classNames('user-status', user.status === 'Activo' && 'active')}>{user.status}</span>
                          <button className="soft-button" type="button" disabled>
                            <SlidersHorizontal size={15} />
                            Editar
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            )}

            {activeSection === 'console' && (
              <section className="selected-server-card" aria-label="Servidor seleccionado">
                <div>
                  <StatusPill status={activeServer?.status} />
                  <div className="selected-title-row">
                    <h3>{activeServer?.name ?? 'Selecciona un servidor'}</h3>
                    <ServerPowerState status={activeServer?.status} />
                  </div>
                  <p>{activeServer?.address ?? 'No hay servidor activo en este servicio.'}</p>
                </div>
                <div className="selected-resource-grid">
                  <div>
                    <span>CPU</span>
                    <strong>{formatValue(activeServer?.cpu, '%')}</strong>
                  </div>
                  <div>
                    <span>RAM</span>
                    <strong>{formatValue(activeServer?.ram, '%')}</strong>
                  </div>
                  <div>
                    <span>Jugadores</span>
                    <strong>{activeServer ? `${activeServer.playersOnline}/${activeServer.playersLimit || '-'}` : '-'}</strong>
                  </div>
                </div>
                <div className="power-actions compact" aria-label="Controles de energia">
                  <button className="action-button start" type="button" disabled={!activeServer}>
                    <Play size={16} />
                    Iniciar
                  </button>
                  <button className="action-button restart" type="button" disabled={!activeServer}>
                    <RefreshCw size={16} />
                    Reiniciar
                  </button>
                  <button className="action-button stop" type="button" disabled={!activeServer}>
                    <Square size={15} />
                    Detener
                  </button>
                </div>
              </section>
            )}
          </section>
        </section>
        )}
      </main>
    </div>
  )
}

export default App
