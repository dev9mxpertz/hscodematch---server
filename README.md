# HSCodeMatch API

REST API behind the HSCodeMatch website: contact forms, newsletter, visitor accounts, website
content and the admin panel. Built with Express 5, TypeScript, MongoDB (Mongoose) and Zod.

## Getting started

Requirements: Node.js 20.9+ and a MongoDB database (MongoDB Atlas or self-hosted).

```bash
cd backend
npm install
cp .env.example .env      # then fill in MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run seed              # loads the website's current content (posts, plans, FAQs, …)
npm run create-admin      # creates / updates the admin account from ADMIN_EMAIL + ADMIN_PASSWORD
npm run dev               # http://localhost:4000
```

To run the website against it, create `.env.development.local` in the project root with
`NEXT_PUBLIC_API_URL=http://localhost:4000` and start `npm run dev` there. Add the website's
origin to `CORS_ORIGINS`.

| Script                    | What it does                                                     |
| ------------------------- | ---------------------------------------------------------------- |
| `npm run dev`             | Start with hot reload                                            |
| `npm run build`           | Compile TypeScript into `dist/`                                  |
| `npm start`               | Run the compiled server (reads `.env`)                           |
| `npm test`                | Integration tests against an in-memory MongoDB                   |
| `npm run lint`            | ESLint                                                           |
| `npm run typecheck`       | TypeScript, no emit                                              |
| `npm run seed`            | Add default content that isn't in the database yet (keeps edits) |
| `npm run seed -- --reset` | Replace all content with the defaults (`src/seed/content.json`)  |
| `npm run create-admin`    | Create or reset the admin account from `.env`                    |

## Environment

All settings are validated on start-up (`src/config/env.ts`); the server refuses to start with a
clear message if one is missing or invalid. See `.env.example` for the full list.

| Variable               | Required | Notes                                                                                  |
| ---------------------- | -------- | -------------------------------------------------------------------------------------- |
| `MONGODB_URI`          | yes      | Atlas: `mongodb+srv://USER:PASS@cluster…/hscodematch`                                  |
| `JWT_SECRET`           | yes      | 32+ random characters; changing it signs everyone out                                  |
| `CORS_ORIGINS`         | yes      | Comma-separated website origins, e.g. `https://hscodematch.com`                        |
| `SITE_URL`             | yes      | Public website URL, used in password-reset emails                                      |
| `ADMIN_EMAIL/PASSWORD` | setup    | Only read by `npm run create-admin` (password 12+ characters)                          |
| `SMTP_*`, `MAIL_FROM`  | optional | Without `SMTP_HOST` emails are skipped and a warning is logged                         |
| `REVALIDATE_URL`       | optional | Website refresh endpoint, e.g. `https://hscodematch.betamxpertz.co.in/api/revalidate/` |
| `REVALIDATE_SECRET`    | optional | 16+ characters; the same value is set on the website                                   |
| `NOTIFY_EMAIL`         | optional | Receives a copy of new contact messages and inquiries                                  |

**MongoDB Atlas:** under _Network Access_ allow the API server's public IP (or `0.0.0.0/0` while
testing). Use a database user that only has access to the `hscodematch` database.

## API overview

Base path: `/api/v1`. Responses are `{ data, meta? }`; errors are
`{ error: { code, message, details? } }` with field-level `details` for validation errors.

| Area             | Endpoints                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Health           | `GET /health`                                                                                                                                                                                                                                                |
| Forms (public)   | `POST /contact`, `POST /inquiries`, `POST /newsletter`                                                                                                                                                                                                       |
| Content (public) | `GET /posts`, `GET /posts/:slug`, `GET /plans`, `GET /services`, `GET /faqs`, `GET /testimonials`, `GET /pages`, `GET /pages/:slug`, `GET /settings`                                                                                                         |
| Visitor accounts | `POST /account/signup`, `/signin`, `/forgot-password`, `/reset-password`; `GET/PATCH /account/me`; `POST /account/change-password`                                                                                                                           |
| Admin auth       | `POST /auth/login`, `GET /auth/me`                                                                                                                                                                                                                           |
| Admin            | `/admin/stats`, `/admin/users`, `/admin/contact-messages`, `/admin/inquiries`, `/admin/subscribers` (+ `export.csv`), `/admin/posts`, `/admin/plans`, `/admin/services`, `/admin/faqs`, `/admin/testimonials`, `/admin/pages`, `/admin/settings` (GET / PUT) |

Admin and visitor tokens are separate (different JWT audiences): a visitor token can never call
admin endpoints. Forms include a hidden honeypot field and are rate-limited; login and sign-up have
stricter limits.

## Project structure

```
src/
├── app.ts / server.ts     Express app (also used by tests) and the process entry point
├── config/env.ts          Validated environment
├── db/connect.ts          Mongoose connection
├── lib/                   Logger, errors, tokens, passwords, mailer, validation, pagination
├── middleware/            Auth (requireAdmin / requireUser), rate limits, error handler
├── modules/
│   ├── auth/              Admin accounts and login
│   ├── users/             Website visitor accounts (+ admin user management)
│   ├── submissions/       Contact messages, expert inquiries, newsletter
│   ├── content/           Posts, plans, services, FAQs, testimonials, pages, site settings
│   └── admin/             Dashboard stats
├── routes/index.ts        Mounts every module under /api/v1
├── seed/                  Default website content
└── scripts/               seed, create-admin
tests/                     Supertest integration tests (in-memory MongoDB)
deploy/                    PM2 process file and Nginx config
```

## Deployment

**Production: Render** — see [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md). The Blueprint in
`render.yaml` (repository root) builds with `npm ci --include=dev && npm run build`, starts with
`npm start` and checks `/api/v1/health`. Set `REVALIDATE_URL` / `REVALIDATE_SECRET` so admin edits
refresh the website immediately.

**Alternative: your own VPS**

- Node + PM2: `npm ci && npm run build`, then `pm2 start deploy/ecosystem.config.cjs && pm2 save`.
- Docker: `docker compose up -d --build` (reads `.env`).
- HTTPS: put Nginx in front using `deploy/nginx.conf`, then `sudo certbot --nginx -d <api-domain>`.

After the first deploy against an empty database run `npm run seed` and `npm run create-admin`
(locally, with `MONGODB_URI` pointing at the production database).
