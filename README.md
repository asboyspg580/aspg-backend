# AS Boys PG — Backend API

Express backend with **two storage modes**:

1. **MongoDB (recommended)** — data persists forever, survives every
   Render restart/redeploy. Use this in production.
2. **Local `data.json` file** — used automatically if you don't set
   `MONGODB_URI`. Fine for testing on your own laptop, but **on
   Render's free tier this WILL randomly reset** — Render's free disk
   is wiped whenever the service restarts/redeploys, which happens
   periodically even without you doing anything. This is why your
   room seat updates and gallery photos disappeared.

## ⚠️ Fix the data-loss issue — set up MongoDB Atlas (free, 5 minutes, permanent)

1. Go to **https://www.mongodb.com/cloud/atlas/register** and sign up (free).
2. Create a **free M0 cluster** (select any region close to India, e.g. Mumbai).
3. Under **Database Access** → add a new database user (username + password — save these).
4. Under **Network Access** → add IP address → choose **"Allow access from anywhere"** (`0.0.0.0/0`). This is required because Render's servers don't have a fixed IP.
5. Go to your cluster → **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<username>` and `<password>` with the ones you created in step 3.
6. On **Render** → your `aspg-backend` service → **Environment** tab → add:
   ```
   Key:   MONGODB_URI
   Value: mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/asboyspg?retryWrites=true&w=majority
   ```
   (Notice `/asboyspg` added before the `?` — that's just the database name, any name works.)
7. Save → Render redeploys automatically. Check the **Logs** tab — you should see:
   ```
   ✅ Connected to MongoDB — data will persist across restarts.
   ```

That's it — from now on, room seats, reviews, gallery photos, and leads will **never reset**, no matter how many times Render restarts the free instance.

## Run locally (without MongoDB — uses data.json)

```bash
npm install
npm start
```

## Run locally with MongoDB (matches production)

```bash
MONGODB_URI="mongodb+srv://..." npm start
```

## Environment variables

| Variable         | Default                  | Purpose                                          |
|-------------------|---------------------------|---------------------------------------------------|
| `MONGODB_URI`     | *(none)*                  | Set this to enable permanent MongoDB storage      |
| `PORT`            | `4000`                    | Port to run on                                    |
| `ALLOWED_ORIGIN`  | `*`                       | Set to your frontend URL(s) for CORS security     |
| `ADMIN_EMAIL`     | `admin@asboyspg.in`       | Default admin account email (created on first run)|
| `ADMIN_PASSWORD`  | `Admin@asboyspg580.com`   | Default admin account password (created on first run)|
| `ADMIN_MASTER_KEY`| *(none)*                  | Secret key required to register new admins or reset a forgotten password. **Set this and keep it private** — without it, register/forgot-password are disabled. |

**Change `ADMIN_EMAIL`/`ADMIN_PASSWORD` before going live.**

## API Endpoints

- `GET  /api/rooms` / `PATCH /api/rooms/:id` `{occupied}`
- `GET  /api/reviews` / `POST /api/reviews` `{name,course,rating,text}` / `DELETE /api/reviews/:id`
- `GET  /api/media` / `POST /api/media` `{type,src,cap}` / `DELETE /api/media/:id`
- `GET  /api/enquiries` / `POST /api/enquiries` `{name,phone,email,room,date,msg}` / `PATCH /api/enquiries/:id` `{status?,notes?}` / `DELETE /api/enquiries/:id`
- `POST /api/admin/login` `{email,password}`
- `POST /api/admin/register` `{email,password,masterKey}` — creates a new admin account (requires `ADMIN_MASTER_KEY`)
- `POST /api/admin/forgot-password` `{email,newPassword,masterKey}` — resets a forgotten password (requires `ADMIN_MASTER_KEY`)
- `GET  /api/health` — returns `{ok:true, storage:"mongodb"|"local-file"}` so you can confirm which mode is active
