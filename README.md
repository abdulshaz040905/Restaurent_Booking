#  QuickDine

Restaurant table-booking platform. Diners search approved restaurants, pick a
time slot against live seat availability, and manage their reservations. Owners
register a restaurant and work their booking list. Admins approve listings.

**Stack:** React 19 + Vite + Tailwind 4 (TypeScript) · Express 5 + Mongoose
(TypeScript) · MongoDB · Cloudinary for image uploads · JWT auth.

## Getting started

```bash
# 1. API
cd server
cp .env.example .env      # fill in MONGODB_URI, JWT_SECRET, CLOUDINARY_URL
npm install
npm run seed              # optional: demo restaurants + accounts
npm run server            # http://localhost:5000

# 2. Web app (separate terminal)
cd client
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev               # http://localhost:5173
```

The server refuses to boot if `MONGODB_URI` or `JWT_SECRET` are missing, rather
than failing later on the first request.

### Demo accounts (after `npm run seed`)

| Role  | Email                  | Password    |
| ----- | ---------------------- | ----------- |
| Admin | `admin@example.com`    | `admin1234` |
| Diner | `user@example.com`     | `user1234`  |
| Owner | `owner@example.com`    | `owner1234` |

The seed creates one owner account per restaurant (the app allows one restaurant
per owner); see `server/seed.ts` for the remaining owner emails.

## Roles

- **Diner** — search, book, cancel, review restaurants they have dined at.
- **Owner** — register one restaurant, set capacity and slots, work the booking
  list. Self-service at sign-up via the "I am a Restaurant Owner" checkbox.
- **Admin** — approve/reject listings, view platform stats. **Not** self-service:
  the API never accepts `role: "admin"` from a request body. Promote a user by
  editing their `role` directly in MongoDB.

## API

| Method | Route                                | Access | Notes |
| ------ | ------------------------------------ | ------ | ----- |
| POST   | `/api/auth/register`                 | Public | Rate limited. Role is forced to `user`/`owner`. |
| POST   | `/api/auth/login`                    | Public | Rate limited. |
| GET    | `/api/auth/me`                       | Auth   | |
| GET    | `/api/restaurants`                   | Public | `search`, `cuisine`, `priceRange`, `location`, `rating`, `sort`, `page`, `limit` |
| GET    | `/api/restaurants/featured`          | Public | |
| GET    | `/api/restaurants/:slug`             | Public | Unapproved listings visible to their owner and admins only. |
| GET    | `/api/restaurants/:id/availability`  | Public | `?date=YYYY-MM-DD` → per-slot seats left. |
| GET    | `/api/restaurants/:id/reviews`       | Public | |
| POST   | `/api/restaurants/:id/reviews`       | Auth   | Requires a non-cancelled booking there. |
| POST   | `/api/bookings`                      | Auth   | Validates slot, date and capacity. |
| GET    | `/api/bookings/my`                   | Auth   | |
| PUT    | `/api/bookings/:id/cancel`           | Auth   | Owner of the booking only. |
| GET/POST/PUT | `/api/owner/restaurant`        | Owner  | One restaurant per owner. |
| GET    | `/api/owner/bookings`                | Owner  | |
| PUT    | `/api/owner/bookings/:id/status`     | Owner  | |
| GET    | `/api/admin/restaurants`             | Admin  | |
| PUT    | `/api/admin/restaurants/:id/approve` | Admin  | |
| GET    | `/api/admin/stats`                   | Admin  | |

## Conventions worth knowing

- **Booking dates** are stored as UTC midnight of the calendar day, so all
  bookings for one day compare equal. **Slot times** are `"HH:MM"` 24-hour
  strings interpreted in the server's timezone. Never format a slot by hand —
  use `formatSlot` from `client/src/lib/format.ts`.
- **Never use `new Date().toISOString().split("T")[0]`** for "today" in the
  client; it returns the UTC day, which is the wrong day for part of every
  24 hours. Use `todayLocalISO()`.
- **Seat capacity** is checked before insert and re-verified after, with the
  losing booking rolling itself back — see the comments in
  `server/controllers/bookingController.ts`.
- **Editing** a live listing's name, description, cuisine, location, address,
  chef or image returns it to the admin approval queue. Capacity and slot
  changes do not.

## Deployment (Vercel)

Deploy `client/` and `server/` as two projects. `server/server.ts` exports the
Express app for the serverless runtime and only calls `listen()` outside Vercel.
Set `CLIENT_URL` on the API to your front-end origin so CORS is not wide open.

## Scripts

| Location | Command | Does |
| -------- | ------- | ---- |
| `server` | `npm run server` | Dev server with reload |
| `server` | `npm start` | Run once |
| `server` | `npm run seed` | Reset and seed the database |
| `server` | `npm run build` | Type-check and emit to `dist/` |
| `client` | `npm run dev` | Vite dev server |
| `client` | `npm run build` | Type-check and build |
| `client` | `npm run lint` | ESLint |
