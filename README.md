# El Niño Ready World

A responsive English, Telugu, and Spanish information site about El Niño, local weather, safety steps, and official weather updates. The site uses React, Vite, TypeScript, Express, and SQLite. The Open-Meteo weather widget remains available without an API key.

## Run locally

Requirements: Node.js 22 or later and npm.

1. Install packages:
   ```sh
   npm install
   ```
2. For local development, `npm run dev` generates a strong random administrator password and session secret on the first run and prints the password in the server terminal. The bootstrap username is `admin`; the generated password remains the same on subsequent starts. To choose your own local credentials instead, copy `.env.example` to `.env` and set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET`. Do not commit `.env`.
3. Start the API and Vite together:
   ```sh
   npm run dev
   ```
4. Open the Vite URL shown in the terminal (normally `http://localhost:5173`) and go to `/admin` to sign in.

There is no shared default password. Bootstrap credentials and session secrets are read only by the server and are never sent to the browser. Production always requires explicitly configured `ADMIN_PASSWORD` and `SESSION_SECRET` values; it never generates development credentials.

## Content dashboard

The private `/admin` dashboard supports English, Telugu, and Spanish text; daily updates; product entries; page content; image uploads and reuse; external links; prices and expiring offers; regional markets and risk tags; scheduled publishing; page paths; SEO titles, descriptions, and sharing images; previews; drafts; publishing; and deletion. Administrators can create and disable editor/viewer accounts and change their roles. Administrators can edit content, editors can manage content, and viewers have read-only dashboard access. Page visibility settings hide selected routes from navigation and public content delivery; the homepage remains visible. Visitors cannot access the dashboard or protected APIs. Published content is fetched from the server; drafts are returned only to authenticated accounts. The public products page and updates panel use this shared content.

The first successful administrator login initializes an empty database without publishing sample listings. Public products and updates now come only from published database content. Existing unverified starter product/update examples are not used as public fallback data.

Image uploads accept JPEG, PNG, or WebP files up to 5 MB. The server checks and decodes the image, resizes it, and stores a generated WebP file under the data directory. SVG and arbitrary file uploads are not accepted.

Products can be explicitly listed for ISO country codes (for example `IN,AU`) or `*` for global availability. Publishing a product requires a name, image, product link, and verified market list. Prices and currency codes are entered by the administrator; there is no stock, shipping, or sales integration, so these details must be kept accurate manually. Product recommendations prioritize climate-risk tags only when they match tags on published, region-scoped official updates. Offers can have an expiry time. Update entries can be scheduled and remain private until their publish time.

The homepage carousel and regional products section use only published product records with a configured market; the carousel additionally requires a price and currency. Country selection is suggested from the browser locale when it matches a supported country and can be changed manually. The selector does not use GPS. The existing weather widget requests browser location only when the visitor chooses its location feature. Regional notices and risk tags must be verified and entered by an administrator; the site does not claim to ingest live national alert feeds. For countries without a direct national link in the selector, the site links to the WMO World Weather Information Service.

The language selector supports the site's current English, Telugu, and Spanish content. The visitor's browser language is suggested on first visit when supported; a manual choice is remembered in browser preferences. No machine-translation provider or credentials are configured. Dashboard visitor metrics are approximate, privacy-preserving page-view counts (not unique visitors); sales metrics are marked unavailable until a commerce integration is connected. Admin changes and media uploads are recorded in the SQLite audit log.

## Supabase for products, updates, and images

Supabase is optional until configured. Without its environment variables, the existing local SQLite/filesystem behavior remains active. To connect it:

1. Create or select a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/setup.sql`](./supabase/setup.sql). It creates the `site_content` table, publication timestamp trigger, read-only public RLS policy, and public-read `site-media` storage bucket. The bucket allows WebP files up to 5 MB; unauthenticated and normal authenticated clients have no upload, edit, or delete policy.
3. In the Supabase project API settings, copy the project URL, anon key, and service-role key. Set these server environment variables (locally in `.env`, or in the Node hosting provider):

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Supabase project URL, such as `https://YOUR_PROJECT_ID.supabase.co` |
   | `SUPABASE_ANON_KEY` | Project anon/publishable key used by the server for RLS-filtered public reads |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project service-role secret used only by the server for authorized admin writes and storage operations |
   | `SUPABASE_STORAGE_BUCKET` | `site-media` (must match the bucket and policy in the SQL script) |

   Never add the service-role key to frontend code, a `VITE_*` variable, or a public repository. Keep `.env` private. The server requires all three Supabase keys together and fails clearly if configuration is partial.
4. Restart the Node server. On first connection it copies existing local product/update records and their locally uploaded images to Supabase without overwriting records already present there. Subsequent product/update form saves and uploads use Supabase. Other CMS page/text entries, admin accounts/sessions, settings, analytics, and the audit log continue to use the existing SQLite database.
5. Continue using the same `/admin` forms. Public content is fetched through the site API, and the existing refresh cycle displays changes automatically. Daily update publication and expiry timestamps are generated by the Supabase database; the public RLS policy excludes scheduled or expired updates after 24 hours. Expiration hides records but does not delete them.

The storage bucket is intentionally public-read so published product/update images can load on the public site. Upload, edit, and delete requests go through the existing authenticated, CSRF-protected server API; the service-role key never reaches the browser. The Supabase table permits public reads only for published, currently eligible entries and denies direct client writes.

## Build and deploy

```sh
npm run build
npm start
```

Deploy this as a **Node.js server**, not as a static-only Vite site or static file drop. The Express server serves the built site, the admin API, and uploaded images. Use a single server instance with HTTPS and a persistent writable volume. Set the environment variables below in the hosting provider; keep the same `DATA_DIR` across restarts and back up the entire directory.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_USERNAME` | No | Bootstrap administrator username (3–48 letters, numbers, dots, underscores, or hyphens); defaults to `admin`. |
| `ADMIN_PASSWORD` | Yes | Bootstrap administrator password (at least 12 characters). Choose a strong, unique value. |
| `SESSION_SECRET` | Yes | Random secret (at least 32 characters) used to protect signed session cookies. |
| `DATA_DIR` | No | Writable persistent directory for SQLite databases and uploads; defaults to `./data`. |
| `PORT` | No | HTTP port; defaults to `3001`. |
| `NODE_ENV` | No | Set to `production` in production to enable secure HTTPS-only session cookies. |

On first start, the server creates `content.sqlite` (including administrator accounts, sessions, page visibility, audit log, and page-view tables) and the uploads directory in `DATA_DIR`. Schema additions use `CREATE TABLE IF NOT EXISTS`; **no manual database migration is required.** Existing single-password deployments migrate automatically and may need to sign in again using the configured bootstrap username and password. The bootstrap administrator credentials from environment variables are synchronized on each server start. Keep the data directory on durable storage; ephemeral serverless filesystems and static-only hosting will lose content and are not supported.

Admin APIs use server-side session authorization, HTTP-only same-site cookies, CSRF tokens, login rate limits, and input validation. Uploaded images are decoded and converted before being served. Public APIs return published content only. The weather service contacts Open-Meteo directly from the browser and does not need a secret key.

When using Supabase for products, daily updates, or images, also configure the four `SUPABASE_*` variables above on the Node server. Supabase does not replace the current SQLite-backed administrator accounts, sessions, site settings, analytics, or audit log; those still require the persistent `DATA_DIR` described above.
