# AIHUB Backend (NestJS)

Authentication & authorization API for the AIHUB storefront/admin.

- **Stack:** NestJS 12 (ESM), TypeORM 1.x + MySQL 8 (`mysql2`), Passport JWT, class-validator, Swagger
- **Auth:** email + password (bcrypt), short-lived access token + rotating refresh token, `@Public()` / `@Roles()` decorators with global guards
- **Roles:** `admin`, `customer`

## Setup

```bash
cd backend
cp .env.example .env      # fill JWT_* secrets (>= 32 chars) – dev values are already in .env
npm install
npm run start:dev         # http://localhost:4000/api  – Swagger: http://localhost:4000/docs
```

Database: `aihub` on `localhost:3306`, user `root`, empty password (see `.env`).
With `DB_SYNCHRONIZE=true` (development only) TypeORM creates/updates tables from the entities on start.
On first start an admin account is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if that email does not exist yet.

## Scripts

| Script                 | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run start:dev`    | Dev server with watch                          |
| `npm run build`        | Compile to `dist/`                             |
| `npm run start:prod`   | Run compiled build                             |
| `npm run lint`         | oxlint                                         |
| `npm test`             | Unit tests (vitest)                            |
| `npm run test:e2e`     | End-to-end auth flow (needs the MySQL from `.env`) |

## Endpoints (`/api`)

| Method | Path                | Auth              | Description                                   |
| ------ | ------------------- | ----------------- | --------------------------------------------- |
| GET    | `/health`           | public            | Liveness probe                                |
| POST   | `/auth/register`    | public            | Create a `customer` account, returns tokens   |
| POST   | `/auth/login`       | public            | Returns `{ user, tokens }`                    |
| POST   | `/auth/refresh`     | body refreshToken | Rotates the token pair; old refresh token dies|
| POST   | `/auth/logout`      | bearer            | Revokes the refresh token                     |
| GET    | `/auth/me`          | bearer            | Current profile                               |
| PATCH  | `/auth/password`    | bearer            | Change password (revokes refresh tokens)      |
| GET    | `/users`            | admin             | Paginated list (`page`, `limit`, `search`, `role`) |
| GET    | `/users/:id`        | admin             | User detail                                   |
| PATCH  | `/users/:id/role`   | admin             | Change role                                   |
| PATCH  | `/users/:id/status` | admin             | Lock / unlock (`isActive`)                    |

Token response shape:

```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "tokenType": "Bearer",
  "expiresIn": "15m"
}
```

Send `Authorization: Bearer <accessToken>` on protected routes. When it expires, call
`POST /auth/refresh` with `{ "refreshToken": "…" }` and store the new pair.

## Import the WordPress content

The storefront's `src/data/generated/wp-content.json` (from `npm run sync:wp` in the Next app) can be
loaded into MySQL — categories, products (with one placeholder "Gói mặc định" variant at
99.000đ/199.000đ until real prices are entered), posts and pages. Re-running upserts by `wp_id`.

```bash
npm run import:wp                     # default: ../src/data/generated/wp-content.json
npm run import:wp -- path/to/file.json
# or, with the server running: POST /api/admin/import/wp (admin token)
```

## Storefront & admin API (`/api`, full docs at `/docs`)

| Area        | Public                                                                 | Admin (`@Roles(admin)`)                                                                 |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Catalog     | `GET /categories`, `GET /categories/lookup?path=`, `GET /products?category&search&sort&badge&ids`, `GET /products/:slug` | `admin/categories` CRUD, `admin/products` CRUD + `PATCH :id/status/:status`, `admin/products/:id/variants`, `admin/variants/:id` |
| Inventory   | –                                                                      | `POST admin/variants/:id/inventory` (nhập kho), `GET …/inventory`, `GET …/inventory/movements`, `POST admin/inventory/items/:id/revoke` |
| Orders      | `POST /orders` (guest or bearer), `GET /orders/lookup?code&email`, `GET /orders/me`, `GET /orders/me/:code` | `GET admin/orders`, `GET admin/orders/:id`, `POST …/confirm-payment`, `POST …/complete`, `POST …/cancel`, `POST …/refund` |
| Promotions  | applied via `promotionCode` on checkout                                | `admin/promotions` CRUD                                                                 |
| Wallet      | `GET /wallet`, `GET /wallet/transactions`, `POST /wallet/fund-requests` (bearer) | `GET admin/fund-requests`, `POST …/:id/approve`, `POST …/:id/reject`                    |
| Content     | `GET /posts?category&search`, `GET /posts/:slug`, `GET /pages/:slug`, `GET /content-blocks/:placement` | `admin/content/blocks` CRUD, `GET admin/content/posts`, `GET admin/content/pages`, `PATCH …/:id/status/:status` |
| Reviews     | `GET /products/:slug/reviews`, `POST /products/:slug/reviews` (held for moderation) | `GET admin/reviews?status`, `PATCH admin/reviews/:id/status` (recomputes product rating) |
| Support     | `POST /support/tickets` (guest or bearer), `GET /support/tickets`, `GET …/:id`, `POST …/:id/messages` | `GET admin/support/tickets`, `GET …/:id`, `POST …/:id/messages`, `PATCH …/:id` |
| Settings    | `GET /settings/public` (hotline, Zalo, home sections…)                 | `GET admin/settings`, `PUT admin/settings/:key` (seeded defaults in `settings.service.ts`) |
| System      | –                                                                      | `GET admin/stats` (overview, chart, low stock, activity, badges), `GET admin/notifications`, `POST …/:id/read`, `GET admin/inventory`, `GET admin/transactions`, `GET/POST admin/reports` |

Order lifecycle: `pending_payment` → (`confirm-payment` or wallet) `processing` → (`complete`:
auto SKUs are delivered from `inventory_items`, manual SKUs need `deliveryNotes[itemId]`)
`completed`; `cancel`/`refund` credit the wallet back when the order was paid from it.

## Database schema

All domain tables (catalog, inventory, orders, payments, wallets, promotions, content, support,
system) are defined as TypeORM entities under `src/<domain>/entities/` and registered in
`src/database/entities.ts`. See [docs/schema.md](docs/schema.md) for the ERD and design notes.

## Project layout

```
src/
  main.ts                    bootstrap: prefix, CORS, Swagger
  app.module.ts              global ValidationPipe / serializer / guards
  config/env.validation.ts   typed + validated environment variables
  database/                  TypeORM (MySQL) module
  common/
    decorators/              @Public(), @Roles(), @CurrentUser()
    guards/                  JwtAuthGuard (global), RolesGuard (global), JwtRefreshGuard
    enums/role.enum.ts
  users/                     User entity, admin endpoints, admin seed
  auth/                      register/login/refresh/logout, JWT strategies
```

## Adding a protected route

```ts
@Controller('orders')
export class OrdersController {
  @Get()                       // any signed-in user
  list(@CurrentUser() user: User) {}

  @Roles(Role.Admin)
  @Post()                      // only these roles
  create() {}

  @Public()
  @Get('public')               // no token required
  publicList() {}
}
```

## Production notes

- Set `NODE_ENV=production`, `DB_SYNCHRONIZE=false` and manage schema with TypeORM migrations.
- Use long random `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`; Swagger is disabled in production.
- Remove `ADMIN_PASSWORD` from the environment after the first boot.
