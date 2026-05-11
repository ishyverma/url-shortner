# LinkForge - URL Shortener

A production-ready, self-hosted URL shortener with analytics, built with modern tech stack.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-20.x-brightgreen.svg)
![Next.js](https://img.shields.io/badge/next.js-15-black)

## Features

- **URL Shortening** - Create short, memorable links with custom slugs
- **Analytics Dashboard** - Track clicks, unique visitors, geographic data, devices, browsers, referrers
- **QR Code Generation** - Generate QR codes for any link
- **Password Protection** - Protect links with password
- **Link Expiration** - Set expiration dates for links
- **Workspace Management** - Organize links into workspaces
- **UTM Parameters** - Automatic UTM tracking
- **Real-time Updates** - Click events processed asynchronously

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Architecture                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐  │
│  │   Browser   │────▶│   Frontend  │────▶│     API Server      │  │
│  │  (Next.js)  │     │  (Next.js)  │     │      (Hono)         │  │
│  └─────────────┘     └─────────────┘     └──────────┬──────────┘  │
│                                                      │              │
│                           ┌──────────────────────────┼──────────┐   │
│                           │                          │          │   │
│                           ▼                          ▼          ▼   │
│                    ┌─────────────┐           ┌──────────┐ ┌────────┐│
│                    │    Redis    │           │ PostgreSQL│ │  Bull  ││
│                    │  (Cache +   │           │  (Primary  │ │  MQ   ││
│                    │   Queue)    │           │    DB)     │ │Worker ││
│                    └─────────────┘           └───────────┘ └───────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend
- **Runtime**: Bun (with Node.js fallback)
- **Framework**: [Hono](https://hono.dev/) - Fast, lightweight web framework
- **Database**: PostgreSQL with [Prisma](https://www.prisma.io/) ORM
- **Queue**: BullMQ with Redis
- **Caching**: Redis
- **Auth**: NextAuth.js (Google OAuth)
- **Validation**: Zod
- **Logging**: Pino

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + custom components
- **Charts**: Recharts
- **Icons**: Lucide React
- **State**: TanStack Query

### Infrastructure
- **Container**: Docker & Docker Compose
- **Database**: PostgreSQL (with TimescaleDB support)

## 🔄 System Flow

### 1. Link Creation Flow
```
User → Frontend → API → Prisma → PostgreSQL
                     ↓
              Redis Cache (link:{slug})
```

1. User creates a link via frontend
2. API validates input with Zod
3. Prisma creates the link in PostgreSQL
4. Link is cached in Redis for fast lookups

### 2. Link Redirect Flow (High Performance)
```
Request → Redis Cache ──▶ Redis HIT ──▶ Redirect
                │
                ▼
           Redis MISS
                │
                ▼
          PostgreSQL ──▶ Cache in Redis ──▶ Redirect
```

1. User visits `short.ly/{slug}`
2. **First check**: Redis cache (`link:{slug}`)
3. If cached and valid → immediate redirect
4. If miss → query PostgreSQL
5. Cache result in Redis (1 hour TTL)
6. Redirect to original URL

### 3. Click Tracking Flow (Async)
```
Redirect Request → Enqueue to BullMQ
                      │
                      ▼
              ┌─────────────────┐
              │   Redis Queue  │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Worker (10    │
              │  concurrent)    │
              └────────┬────────┘
                       │
                       ▼
         ┌─────────────┴──────────────┐
         │                            │
         ▼                            ▼
   ClickEvent Table         Link.totalClicks++
   (PostgreSQL)              (Atomic counter)
```

1. When user clicks link, request enqueued to BullMQ
2. **Non-blocking** - redirect returns immediately
3. Background worker:
   - Creates `ClickEvent` record with full metadata
   - Increments `Link.totalClicks` atomically
   - Parses user agent, extracts geo data
4. Handles 1000s of clicks/second without slowing redirects

### 4. Analytics Flow
```
Frontend → API Queries ──▶ PostgreSQL (aggregated)
     │                          │
     │                    TimescaleDB (if available)
     │                          │
     └──────────────────────────┘
            Chart Data
```

- API provides aggregated analytics
- GroupBy for countries, devices, browsers, referrers
- Timeseries data for charts
- Cached with short TTL

## 💾 Redis Usage

### 1. **Link Caching** (High Read)
```
Key: link:{slug}
Value: { id, workspaceId, originalUrl, isActive, expiresAt }
TTL: 3600 seconds (1 hour)
```
- **Why**: Most requests are redirects, cache avoids DB hit
- **Invalidation**: On link update/delete

### 2. **Password Unlocks** (Medium Read)
```
Key: link:unlocked:{slug}
Value: originalUrl
TTL: 3600 seconds (1 hour)
```
- **Why**: Skip password check for recently unlocked links

### 3. **BullMQ Queue** (High Write)
```
Queue: clicks
- Stores pending click events
- Processed by worker with concurrency of 10
- Auto-cleanup after 1000 completed, 500 failed
```

### 4. **Session Store** (NextAuth)
```
Key: nextauth:sess:{sessionId}
Value: encrypted session data
TTL: 30 days
```

## 🎯 Cache Strategy

| Data Type | Cache Key | TTL | Invalidation |
|-----------|-----------|-----|---------------|
| Link | `link:{slug}` | 1h | On update/delete |
| Unlocked | `link:unlocked:{slug}` | 1h | Manual |
| Workspace Stats | `stats:workspace:{id}` | 5min | On new click |
| Analytics | `analytics:{slug}:*` | 1min | On new click |

## 👥 User Roles & Permissions

- **Owner**: Full workspace control, manage members, billing
- **Member**: Create/manage links, view analytics
- **Viewer**: (future) View-only access to specific links

## 🗂️ Data Models

### User
- Authentication via Google OAuth
- Owns workspaces, creates links

### Workspace
- Contains multiple links
- Has API key for programmatic access
- Plan-based limits (free/pro)

### Link
- Short slug → original URL mapping
- Tracks totalClicks, uniqueClicks
- Supports password, expiration, tags

### ClickEvent
- Every click creates an event
- Stores: geo, device, browser, referrer, UTM
- Indexed for fast analytics queries

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- 4GB RAM minimum

### Run with Docker Compose

```bash
# Clone and navigate to project
cd url-shortner

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

Services:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3002
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Manual Setup (Development)

```bash
# Backend
cd api
cp .env.example .env
npm install
npx prisma generate
npm run dev

# Frontend
cd web
cp .env.example .env
npm install
npm run dev
```

## 📝 Environment Variables

### API (.env)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/url_shortener
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3002
```

### Web (.env)
```
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=http://localhost:3002
```

## 🔧 API Endpoints

### Links
- `GET /api/v1/links` - List links
- `POST /api/v1/links` - Create link
- `GET /api/v1/links/:slug` - Get link
- `PATCH /api/v1/links/:slug` - Update link
- `DELETE /api/v1/links/:slug` - Delete link
- `GET /api/v1/links/:slug/qr` - Generate QR

### Analytics
- `GET /api/v1/analytics/:slug` - Basic stats
- `GET /api/v1/analytics/:slug/stats` - Detailed stats
- `GET /api/v1/analytics/:slug/timeseries` - Time series data
- `GET /api/v1/analytics/:slug/countries` - Geographic data
- `GET /api/v1/analytics/:slug/devices` - Device breakdown
- `GET /api/v1/analytics/:slug/browsers` - Browser breakdown
- `GET /api/v1/analytics/:slug/referrers` - Referrer data
- `GET /api/v1/analytics/:slug/utm` - UTM parameters

### Workspaces
- `GET /api/v1/workspaces` - List workspaces
- `POST /api/v1/workspaces` - Create workspace
- `GET /api/v1/workspaces/:id` - Get workspace

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### 1. Fork & Clone
```bash
git fork https://github.com/your-username/url-shortener.git
cd url-shortner
```

### 2. Create Feature Branch
```bash
git checkout -b feature/your-feature
# or
git checkout -b fix/bug-fix
```

### 3. Make Changes
- Follow existing code style
- Add tests for new features
- Update documentation

### 4. Commit & Push
```bash
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature
```

### 5. Create Pull Request
- Use clear, descriptive title
- Explain changes and motivation
- Reference related issues

### Code Standards
- **TypeScript** - Strict type checking
- **ESLint** - Follow project config
- **Prettier** - Code formatting
- **Tests** - Include unit/integration tests

### Areas to Contribute
- 🎨 UI/UX improvements
- 📊 Additional analytics features
- ⚡ Performance optimizations
- 📝 Documentation
- 🐛 Bug fixes
- ✨ New features

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Hono](https://hono.dev/) - Fast web framework
- [Next.js](https://nextjs.org/) - React framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [BullMQ](https://docs.bullmq.io/) - Queue system
- [TimescaleDB](https://www.timescale.com/) - Time-series DB

---

<p align="center">Built with ❤️ using Bun, Hono, Next.js & PostgreSQL</p>