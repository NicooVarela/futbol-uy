# FutbolUY

Monorepo para recopilar y mostrar datos del futbol uruguayo e internacional con foco en torneos vinculados a Uruguay.

El proyecto tiene dos piezas principales:

- `apps/scraper`: ingesta datos desde SofaScore y los guarda en PostgreSQL.
- `apps/web`: frontend en Next.js que lee la base con Prisma y renderiza tablas, fixtures, clubes y partidos.

## Resumen rapido

- Stack: `Next.js 15`, `React 19`, `TypeScript`, `Prisma`, `PostgreSQL`, `Turborepo`, `Playwright`.
- Base de datos: PostgreSQL local via Docker.
- Fuente actual de datos: API pública de SofaScore, consumida con un contexto real de navegador.
- Dominio modelado: torneos, temporadas, equipos, estadios, jugadores, partidos, incidencias, formaciones y tablas.

## Estructura del repo

```text
.
├── apps/
│   ├── scraper/     # jobs de sincronizacion y acceso a SofaScore
│   └── web/         # app publica en Next.js
├── packages/
│   ├── db/          # Prisma schema, cliente y scripts de DB
│   ├── types/       # tipos compartidos
│   ├── eslint-config/
│   └── typescript-config/
├── docker-compose.yml
├── package.json
└── turbo.json
```

## Como funciona

1. El scraper consulta SofaScore.
2. Normaliza y guarda la informacion en PostgreSQL.
3. La web consulta la base con Prisma.
4. Next.js revalida las paginas cada cierto tiempo (`revalidate`).

## Requisitos

- `Node.js >= 18`
- `npm >= 10`
- `Docker` y `docker compose`

## Variables de entorno

Archivo base:

```bash
cp .env.example .env
```

Variables clave:

```env
DATABASE_URL="postgresql://futboluy:futboluy_local@localhost:5432/futboluy"
SCRAPER_DELAY_MS=2000
NEXTAUTH_URL=http://localhost:3000
```

Notas:

- `apps/web/.env.local` puede usarse para desarrollo local del frontend.
- `.env` y `.env.local` estan ignorados por git.
- Cloudinary, Upstash y NextAuth aparecen preparados, pero hoy no hay uso visible en el codigo principal.

## Primer arranque

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar PostgreSQL

```bash
docker compose up -d
```

### 3. Generar cliente Prisma

```bash
npm run db:generate --workspace @futbol-uy/db
```

### 4. Crear la base

Opcion recomendada para desarrollo con migraciones:

```bash
npm run db:migrate --workspace @futbol-uy/db
```

Alternativa si solo queres empujar el schema:

```bash
npm run db:push --workspace @futbol-uy/db
```

### 5. Cargar datos iniciales

```bash
npm run dev --workspace @futbol-uy/scraper
```

O correr jobs puntuales:

```bash
npx tsx apps/scraper/src/index.ts seasons
npx tsx apps/scraper/src/index.ts teams
npx tsx apps/scraper/src/index.ts players
npx tsx apps/scraper/src/index.ts standings
npx tsx apps/scraper/src/index.ts fixtures
```

### 6. Levantar la web

```bash
npm run dev --workspace @futbol-uy/web
```

Abrir [http://localhost:3000](http://localhost:3000)

## Scripts utiles

### Raiz del monorepo

```bash
npm run dev
npm run build
npm run lint
npm run check-types
npm run format
```

### Web

```bash
npm run dev --workspace @futbol-uy/web
npm run build --workspace @futbol-uy/web
npm run start --workspace @futbol-uy/web
npm run lint --workspace @futbol-uy/web
npm run check-types --workspace @futbol-uy/web
```

### Scraper

```bash
npm run dev --workspace @futbol-uy/scraper
npm run build --workspace @futbol-uy/scraper
node apps/scraper/dist/index.js all
```

### Base de datos

```bash
npm run db:generate --workspace @futbol-uy/db
npm run db:migrate --workspace @futbol-uy/db
npm run db:push --workspace @futbol-uy/db
npm run db:studio --workspace @futbol-uy/db
```

## Jobs del scraper

Entrada principal:

```bash
npx tsx apps/scraper/src/index.ts <job> [arg]
```

Jobs disponibles:

- `all`: corre `seasons`, `teams`, `players`, `standings` y `fixtures`.
- `sync`: hoy hace lo mismo que `all`.
- `seasons`: sincroniza torneos y temporadas.
- `teams`: sincroniza equipos y estadios.
- `players`: sincroniza planteles.
- `standings`: sincroniza tablas por grupo.
- `fixtures`: sincroniza ultimos y proximos partidos.
- `match-detail <sofascoreEventId>`: trae incidencias y formaciones de un partido.
- `historical [fromYear]`: carga historico desde cierto anio. Ejemplo: `historical 2020`.

Ejemplos:

```bash
npx tsx apps/scraper/src/index.ts all
npx tsx apps/scraper/src/index.ts match-detail 15635513
npx tsx apps/scraper/src/index.ts historical 2022
```

## Paginas de la web

- `/`: portada con partidos recientes y tabla principal.
- `/torneo/[slug]`: vista de torneo, temporada, tabla y fixture.
- `/club/[slug]`: ficha de club, plantel y ultimos partidos.
- `/partido/[id]`: detalle de partido, incidencias y formaciones.

## Prisma y datos

Schema principal: [`packages/db/prisma/schema.prisma`](/Users/nico/Desktop/futbol-uy/packages/db/prisma/schema.prisma)

Entidades mas importantes:

- `Tournament`
- `Season`
- `Team`
- `Player`
- `Event`
- `Standing`
- `Incident`
- `Lineup`
- `ScraperLog`

## Flujo recomendado de trabajo

Para desarrollo normal:

```bash
docker compose up -d
npm install
npm run db:migrate --workspace @futbol-uy/db
npx tsx apps/scraper/src/index.ts all
npm run dev --workspace @futbol-uy/web
```

Cuando cambies el schema de Prisma:

```bash
npm run db:migrate --workspace @futbol-uy/db
npm run db:generate --workspace @futbol-uy/db
```

Cuando quieras refrescar un partido puntual:

```bash
npx tsx apps/scraper/src/index.ts match-detail <id>
```

## Estado actual del proyecto

Fortalezas:

- Buena separacion entre ingesta, base y frontend.
- Modelo de datos bastante completo para un vertical deportivo.
- Uso correcto de Prisma y de Server Components para leer datos.
- `check-types` actualmente pasa.

Limitaciones conocidas:

- El `README` del starter fue reemplazado por este documento, pero los README internos todavia no estan actualizados.
- `lint` no corre hoy porque falta instalar/configurar `eslint` como dependencia efectiva del workspace.
- El scraper depende de una integracion fragil con una API no oficial.
- Hay bastante UI inline y poca abstraccion reusable en la app web.
- No hay tests automatizados.

## Siguientes mejoras sugeridas

- Dejar `lint` funcionando de punta a punta.
- Agregar scripts root para Prisma y scraping frecuente.
- Centralizar helpers de formato de fecha/hora y colores por zona.
- Reducir `any` en scraper y vistas.
- Agregar testing minimo:
  - unitario para transformaciones del scraper
  - integracion para consultas Prisma criticas
  - smoke tests para paginas principales
- Documentar mejor el flujo de despliegue y refresh de datos.
- Separar componentes visuales reutilizables del frontend.

## Troubleshooting

### La web abre pero no muestra datos

- Verifica que PostgreSQL este arriba: `docker compose ps`
- Verifica migraciones: `npm run db:migrate --workspace @futbol-uy/db`
- Corre una carga inicial: `npx tsx apps/scraper/src/index.ts all`

### Prisma falla por cliente desactualizado

```bash
npm run db:generate --workspace @futbol-uy/db
```

### El scraper falla con SofaScore

- Reintentar con mayor delay:

```bash
SCRAPER_DELAY_MS=4000 npx tsx apps/scraper/src/index.ts fixtures
```

- Revisar si cambiaron endpoints o estructura de respuesta.

### `npm run lint` falla

Estado actual esperado: hoy puede fallar porque `eslint` no esta resuelto correctamente en el workspace.

## Archivos importantes

- [`package.json`](/Users/nico/Desktop/futbol-uy/package.json)
- [`turbo.json`](/Users/nico/Desktop/futbol-uy/turbo.json)
- [`docker-compose.yml`](/Users/nico/Desktop/futbol-uy/docker-compose.yml)
- [`apps/web/app/page.tsx`](/Users/nico/Desktop/futbol-uy/apps/web/app/page.tsx)
- [`apps/scraper/src/index.ts`](/Users/nico/Desktop/futbol-uy/apps/scraper/src/index.ts)
- [`apps/scraper/src/sources/sofascore.ts`](/Users/nico/Desktop/futbol-uy/apps/scraper/src/sources/sofascore.ts)
- [`packages/db/prisma/schema.prisma`](/Users/nico/Desktop/futbol-uy/packages/db/prisma/schema.prisma)
