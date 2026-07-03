# AS Boys PG — Backend API

Plain Node.js + Express backend. Stores data in `data.json` on disk, so
admin changes (rooms, reviews, gallery, leads) persist across refreshes
instead of resetting — which was the original problem.

## Run locally

```bash
npm install
npm start
```

Server starts on `http://localhost:4000` by default.

## Environment variables (optional)

| Variable         | Default                  | Purpose                                   |
|-------------------|---------------------------|--------------------------------------------|
| `PORT`            | `4000`                    | Port to run on                             |
| `ALLOWED_ORIGIN`  | `*`                       | Set to your frontend URL for CORS security |
| `ADMIN_EMAIL`     | `admin@asboyspg.com`      | Admin login email                          |
| `ADMIN_PASSWORD`  | `admin123`                | Admin login password                       |

**Change `ADMIN_EMAIL`/`ADMIN_PASSWORD` before going live.**

## Deploying (pick one, all have free tiers)

### Render.com (recommended, easiest)
1. Push this `backend` folder to a GitHub repo.
2. On Render → New → Web Service → connect the repo.
3. Build command: `npm install`  |  Start command: `npm start`.
4. Add environment variables above (at least `ALLOWED_ORIGIN` set to your
   frontend's URL once you know it).
5. Deploy → you'll get a URL like `https://as-boys-pg-backend.onrender.com`.

### Railway.app
Same idea — connect repo, it auto-detects Node, set env vars, deploy.

### Any VPS
```bash
git clone <your-repo>
cd backend
npm install
ADMIN_PASSWORD=yourpassword PORT=4000 node server.js
# use pm2 or systemd to keep it running, and Nginx as reverse proxy
```

## ⚠️ Important note on free-tier hosting

Render/Railway free tiers use an **ephemeral filesystem** — meaning
`data.json` can get reset when the service restarts/redeploys. This is
fine for testing. For real production use, either:
- Pick a host with a persistent disk (Render's paid "Persistent Disk"
  add-on, a small VPS, etc.), or
- Swap `data.json` for a real database (SQLite file on a persistent
  volume, or a hosted DB like MongoDB Atlas / Supabase — free tiers
  available). Ask and this can be upgraded later.

## API Endpoints

- `GET  /api/rooms` / `PATCH /api/rooms/:id` `{occupied}`
- `GET  /api/reviews` / `POST /api/reviews` `{name,course,rating,text}` / `DELETE /api/reviews/:id`
- `GET  /api/media` / `POST /api/media` `{type,src,cap}` / `DELETE /api/media/:id`
- `GET  /api/enquiries` / `POST /api/enquiries` `{name,phone,email,room,date,msg}` / `PATCH /api/enquiries/:id` `{status?,notes?}` / `DELETE /api/enquiries/:id`
- `POST /api/admin/login` `{email,password}`
