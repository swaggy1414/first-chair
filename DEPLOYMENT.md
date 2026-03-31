# First Chair — Deployment Guide

This guide walks through deploying First Chair with **Railway** (backend + database) and **Vercel** (frontend).

---

## Railway Backend Setup

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** > **Deploy from GitHub Repo** > select the `first-chair` repository.
3. Railway will detect the `Procfile` and begin deploying the server.
4. **Add a PostgreSQL database:** click **"+ New"** > **Database** > **PostgreSQL**.
   - Railway automatically sets the `DATABASE_URL` environment variable — no action needed.
5. Go to the **Variables** tab on your server service and add:
   - `JWT_SECRET` — generate a random string (e.g., run `openssl rand -hex 32` in your terminal)
   - `FRONTEND_URL` — you will set this after the Vercel deploy (e.g., `https://firstchair.vercel.app`)
   - `ANTHROPIC_API_KEY` — optional, only needed for AI features
   - `PORT` — set to `3001`
6. Go to **Settings** > **Root Directory** > set to `/server`.
7. Railway will redeploy automatically after changing settings.
8. Go to **Settings** > **Networking** > **Generate Domain** to get a public URL.
9. Copy the Railway public URL (e.g., `https://first-chair-production.up.railway.app`). You will need this for the Vercel setup.

---

## Initialize the Database

1. In Railway, click on the **PostgreSQL** service.
2. Go to the **Data** tab or click **Connect** to get the connection string.
3. **Run the schema:** Copy the contents of `server/sql/schema.sql` and paste into the Railway query editor (Data tab > Query), then click Run.
4. **Run the seed data:** Connect via psql using the Railway connection string:
   ```
   psql "your-railway-connection-string"
   ```
   Or set the `DATABASE_URL` environment variable locally and run:
   ```
   DATABASE_URL="your-railway-connection-string" node server/src/seed.js
   ```

---

## Vercel Frontend Setup

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New** > **Project** > **Import** the `first-chair` repository.
3. Set **Framework Preset** to **Vite**.
4. Set **Root Directory** to `client`.
5. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://your-railway-url.up.railway.app/api` (use the URL from step 9 of Railway setup, with `/api` appended)
6. Click **Deploy**.
7. Once deployed, copy the Vercel URL (e.g., `https://firstchair.vercel.app`).
8. Go back to **Railway** > your server service > **Variables** > set `FRONTEND_URL` to the Vercel URL (e.g., `https://firstchair.vercel.app`).
9. Railway will redeploy automatically after the variable change.

---

## Custom Domain (Optional)

1. In **Vercel**: go to your project > **Settings** > **Domains** > **Add** your custom domain.
2. Update your DNS records as Vercel instructs (typically a CNAME or A record).
3. In **Railway**: update the `FRONTEND_URL` variable to your custom domain (e.g., `https://firstchair.yourdomain.com`).

---

## Verify the Deployment

1. Open the Vercel URL in your browser.
2. You should see the First Chair login page.
3. Log in with the default credentials:
   - **Email:** `admin@firstchair.law`
   - **Password:** `FirstChair2025!`
4. Verify that:
   - Cases load on the dashboard
   - Case tabs (Deadlines, Records, Discovery, Exhibits, etc.) work
   - Morning Brief shows data
   - Settings page loads

---

## Troubleshooting

- **CORS errors in the browser console:** Make sure `FRONTEND_URL` in Railway matches your Vercel URL exactly (including `https://`, no trailing slash).
- **Database connection errors:** Check that Railway's PostgreSQL service is running and `DATABASE_URL` is set automatically.
- **API calls failing:** Confirm `VITE_API_URL` in Vercel points to your Railway URL with `/api` at the end.
- **Build fails on Vercel:** Make sure the Root Directory is set to `client` and Framework Preset is `Vite`.
