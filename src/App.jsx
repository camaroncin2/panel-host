import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Box,
  CirclePause,
  Database,
  FileArchive,
  FileCode2,
  Folder,
  FolderUp,
  Gauge,
  HardDrive,
  History,
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
  Square,
  Sun,
  TerminalSquare,
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

function classNames(...items) {
  return items.filter(Boolean).join(' ')
}

function formatValue(value, suffix = '') {
  return value === null || value === undefined ? '-' : `${value}${suffix}`
}

function Metric({ icon: Icon, label, value, detail }) {
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
}

function StatusPill({ status }) {
  const labels = {
    detected: 'Detectado',
    online: 'Online',
    offline: 'Offline',
    maintenance: 'Mantenimiento',
  }

  return <span className={classNames('status-pill', status ?? 'idle')}>{labels[status] ?? 'Sin seleccion'}</span>
}

function ServerPowerState({ status }) {
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
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="empty-state">
      <div>
        <Icon size={20} />
      </div>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

function LoginScreen({ error, form, isLoading, onChange, onSubmit }) {
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
              name="username"
              onChange={onChange}
              placeholder="Usuario"
              required
              value={form.username}
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
}

function App() {
  const [authStatus, setAuthStatus] = useState('checking')
  const [authUser, setAuthUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
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
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('panel-host-theme')
    if (savedTheme) return savedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    window.localStorage.setItem('panel-host-theme', theme)
  }, [theme])

  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/session')
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
        const response = await fetch('/api/panel/state')
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

  function updateLoginForm(event) {
    const { name, value } = event.target
    setLoginForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  async function submitLogin(event) {
    event.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.authenticated) {
        setLoginError(data.error ?? 'No se pudo iniciar sesion.')
        return
      }

      setAuthUser(data.user)
      setAuthStatus('authenticated')
      setLoginForm({ username: '', password: '' })
    } catch {
      setLoginError('No se pudo conectar con el servicio de autenticacion.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setAuthUser(null)
    setAuthStatus('unauthenticated')
    setHostGroups(emptyGroups)
    setActiveServerId(null)
  }

  const activeHost = hostGroups.find((group) => group.id === activeHostId) ?? hostGroups[0]
  const activeServer =
    activeHost.servers.find((serverItem) => serverItem.id === activeServerId) ?? null
  const visibleFiles =
    activeServer?.files
      ?.filter((file) => file.name.toLowerCase().includes(fileSearch.trim().toLowerCase()))
      .toSorted((firstFile, secondFile) => {
        if (firstFile.type !== secondFile.type) return firstFile.type === 'Carpeta' ? -1 : 1
        return firstFile.name.localeCompare(secondFile.name)
      }) ?? []

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
  const visibleNodes = hostGroups.filter((group) =>
    group.name.toLowerCase().includes(nodeSearch.trim().toLowerCase()),
  )

  function selectHost(hostId) {
    const nextHost = hostGroups.find((group) => group.id === hostId)
    setActiveHostId(hostId)
    setActiveServerId(nextHost.servers[0]?.id ?? null)
    setSelectedUploadServers(nextHost.servers.slice(0, 2).map((serverItem) => serverItem.id))
  }

  function toggleUploadServer(serverId) {
    setSelectedUploadServers((currentServers) =>
      currentServers.includes(serverId)
        ? currentServers.filter((currentServerId) => currentServerId !== serverId)
      : [...currentServers, serverId],
    )
  }

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
                        setActiveServerId(serverItem.id)
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
        <section className="dashboard-grid" id={activeSection}>
          <div className="server-panel">
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

            <div className="server-list">
              {activeHost.servers.length === 0 ? (
                <EmptyState
                  icon={Server}
                  title="Sin servidores conectados"
                  body={isLoading ? 'Cargando servidores.' : 'Conecta la API para mostrar instancias.'}
                />
              ) : (
                activeHost.servers.map((serverItem) => (
                  <button
                    className={classNames('server-row', serverItem.id === activeServer?.id && 'selected')}
                    key={serverItem.id}
                    onClick={() => setActiveServerId(serverItem.id)}
                    type="button"
                  >
                    <div className="server-row-main">
                      <span className="server-dot" />
                      <div>
                        <strong>{serverItem.name}</strong>
                        <small>{serverItem.type}</small>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <section className="right-panel" aria-label="Detalle del servidor seleccionado">
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
                  <pre>
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
                {visibleFiles.length ? (
                  <div className="file-table">
                    {visibleFiles.map((file) => {
                      const Icon = file.type === 'Carpeta' ? Folder : file.name.endsWith('.properties') ? FileCode2 : FileArchive

                      return (
                        <div className="file-row" key={file.name}>
                          <Icon size={18} />
                          <strong>{file.name}</strong>
                          <span>{file.type}</span>
                          <span>{file.size}</span>
                          <small>{new Date(file.updated).toLocaleString()}</small>
                        </div>
                      )
                    })}
                  </div>
                ) : activeServer?.files?.length ? (
                  <EmptyState
                    icon={Search}
                    title="Sin resultados"
                    body="No hay archivos que coincidan con la busqueda."
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
              <section className="tool-panel content-panel">
                <EmptyState
                  icon={Settings}
                  title="Ajustes pendientes"
                  body="Aqui se configuraran opciones del panel."
                />
              </section>
            )}

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
          </section>
        </section>
        )}
      </main>
    </div>
  )
}

export default App
