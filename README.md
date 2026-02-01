scout app

Local setup
- Copy `.env.example` to `.env` and set `DATABASE_URL` + `SESSION_SECRET` (and optional `INIT_ADMIN_*`).
- Install dependencies: `npm install`.
- Run Prisma: `npm run prisma:generate` then `npm run db:migrate`.
- Seed the initial dev user: `npm run db:seed`.
- Default login (after seeding): `lucastoh41@gmail.com` / `Hwachong@2024` (override with `INIT_ADMIN_*`).
- Start dev server: `npm run dev`.

Railway setup
- Create a PostgreSQL service and copy its `DATABASE_URL` into your Railway app variables.
- Add `SESSION_SECRET` (required for session cookies).
- Add `APP_VERSION` (optional, used by `/api/health`).
- Add `INIT_ADMIN_EMAIL`, `INIT_ADMIN_PASSWORD`, `INIT_ADMIN_ROLE` (defaults exist in `.env.example`).
- Build command: `npm run build`
- Start command: `npm run start`
- Run migrations: `npm run db:migrate`
- Seed once: `npm run db:seed`

Migration notes
- Supabase + Google Sheets have been removed; PostgreSQL is the single source of truth.
- Prisma manages schema and migrations under `prisma/`.
- Local: run `npm run prisma:migrate` to create tables.
- Railway: run `npx prisma migrate deploy` during deployment or via a Railway service command.
"# scouts" 
