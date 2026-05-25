# Panel Host Minecraft

Frontend en React para administrar servicios de hosting Minecraft como Minetlan y Cretania. La interfaz incluye login, selector de servicio, consola, archivos, base de datos, actividad, nodos y modo noche.

## Requisitos

- Node.js 20 o superior
- npm

## Desarrollo

```bash
npm install
cp .env.example .env
npm run dev
```

Variables locales disponibles:

- `PANEL_HOST_LOCAL_ROOT`: carpeta local para probar deteccion de servidores en desarrollo.
- `PANEL_HOST_ADMIN_USER`: usuario del login local de desarrollo.
- `PANEL_HOST_ADMIN_PASSWORD`: contrasena del login local de desarrollo.
- `PANEL_HOST_SESSION_TOKEN`: token de cookie para la sesion local de desarrollo.

El middleware incluido en `vite.config.js` es solo para desarrollo local. En produccion el frontend espera que el backend real implemente:

- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/panel/state`

## Produccion

```bash
npm run lint
npm run build
npm run preview
```

El build final queda en `dist/`. Para publicar en hosting estatico, sirve esa carpeta y configura el backend/API con cookies `HttpOnly`, `SameSite` y HTTPS.

## Optimizaciones incluidas

- Busquedas diferidas para evitar renderizar en cada tecla cuando hay listas grandes.
- Componentes visuales memoizados para reducir renders repetidos.
- Consola limitada por datos del backend local a las ultimas lineas relevantes.
- CSS con contencion de layout/pintado en filas y tarjetas.
- Soporte para `prefers-reduced-motion`.
- Cabeceras estaticas en `public/_headers` para despliegues compatibles.
