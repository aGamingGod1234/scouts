scout app

Local setup
- Copy `.env.example` to `.env` and set `DATABASE_URL`.
- Install dependencies: `npm install`.
- Run Prisma: `npm run prisma:generate` then `npm run prisma:migrate`.
- Start dev server: `npm run dev`.

Railway setup
- Create a PostgreSQL service and copy its `DATABASE_URL` into your Railway app variables.
- Add `APP_VERSION` (optional, used by `/api/health`).
- Build command: `npm run build`
- Start command: `npm run start`

Migration notes
- Supabase + Google Sheets have been removed; PostgreSQL is the single source of truth.
- Prisma manages schema and migrations under `prisma/`.
- Local: run `npm run prisma:migrate` to create tables.
- Railway: run `npx prisma migrate deploy` during deployment or via a Railway service command.
"# scouts" 
