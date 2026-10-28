import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const isVercel = Boolean(process.env.VERCEL);
const dataDir = path.resolve(process.env.DATA_DIR || (isVercel ? '/tmp/el-nino-data' : path.join(rootDir, 'data')));
const uploadDir = path.join(dataDir, 'uploads');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3001);
const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '') || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || '';
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'site-media';
const supabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey && supabaseAnonKey);
let sessionSecret = process.env.SESSION_SECRET;
let adminPassword = process.env.ADMIN_PASSWORD;
const adminUsername = process.env.ADMIN_USERNAME || 'admin';

if ([supabaseUrl, supabaseServiceRoleKey, supabaseAnonKey].some(Boolean) && !supabaseEnabled) {
  throw new Error('Configure SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY together, or leave all three unset.');
}
if (supabaseEnabled && !/^https?:\/\/[^/]+$/.test(supabaseUrl)) {
  throw new Error('SUPABASE_URL must be an HTTP(S) project URL without a path.');
}
if (isVercel && !supabaseEnabled) {
  throw new Error('Vercel deployment requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY. Configure them in the Vercel project environment.');
}
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(supabaseStorageBucket)) {
  throw new Error('SUPABASE_STORAGE_BUCKET must be a valid Supabase storage bucket name.');
}

if (!isProduction && (!sessionSecret || !adminPassword)) {
  fs.mkdirSync(dataDir, { recursive: true });
  const developmentCredentialsPath = path.join(dataDir, 'development-credentials.json');
  let credentials;
  if (fs.existsSync(developmentCredentialsPath)) {
    credentials = JSON.parse(fs.readFileSync(developmentCredentialsPath, 'utf8'));
  } else {
    credentials = {
      sessionSecret: crypto.randomBytes(48).toString('base64url'),
      adminPassword: crypto.randomBytes(24).toString('base64url'),
    };
    fs.writeFileSync(developmentCredentialsPath, JSON.stringify(credentials, null, 2), { mode: 0o600, flag: 'wx' });
    console.log(`Development administrator password (store it safely): ${credentials.adminPassword}`);
  }
  sessionSecret ||= credentials.sessionSecret;
  adminPassword ||= credentials.adminPassword;
}

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET is required and must contain at least 32 characters. Set it in .env before starting in production.');
}
if (!adminPassword || adminPassword.length < 12) {
  throw new Error('ADMIN_PASSWORD is required and must contain at least 12 characters. Set it in .env before starting in production.');
}
if (!/^[a-zA-Z0-9._-]{3,48}$/.test(adminUsername)) {
  throw new Error('ADMIN_USERNAME must be 3–48 characters using letters, numbers, dots, underscores, or hyphens.');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, 'content.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('update', 'product', 'page', 'content')),
    payload TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
    updated_at TEXT NOT NULL,
    published_at TEXT,
    expires_at TEXT
  );
  CREATE INDEX IF NOT EXISTS content_public_kind ON content (published, kind);
  CREATE TABLE IF NOT EXISTS admin_sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions (expires_at);
  CREATE TABLE IF NOT EXISTS admin_users (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_audit (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    content_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS admin_audit_created_at ON admin_audit (created_at DESC);
  CREATE TABLE IF NOT EXISTS page_views (
    day TEXT NOT NULL,
    page_path TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, page_path)
  );
  INSERT OR IGNORE INTO site_state (key, value) VALUES ('content_initialized', '0');
  INSERT OR IGNORE INTO site_state (key, value) VALUES ('page_visibility', '["/global-impact-safety","/products","/about-sources"]');
`);
const contentColumns = new Set(db.pragma('table_info(content)').map((column) => column.name));
if (!contentColumns.has('published_at')) db.exec('ALTER TABLE content ADD COLUMN published_at TEXT');
if (!contentColumns.has('expires_at')) db.exec('ALTER TABLE content ADD COLUMN expires_at TEXT');
db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now());
db.prepare(`
  UPDATE site_state SET value = '1'
  WHERE key = 'content_initialized'
  AND EXISTS (SELECT 1 FROM content)
`).run();
const legacyPublishedUpdates = db.prepare(`
  SELECT id, payload, updated_at FROM content
  WHERE kind = 'update' AND published = 1 AND expires_at IS NULL
`).all();
for (const row of legacyPublishedUpdates) {
  const payload = JSON.parse(row.payload);
  const updatedTime = Date.parse(row.updated_at);
  const scheduledTime = Date.parse(payload.scheduledAt || '');
  const publishedAt = new Date(Number.isFinite(scheduledTime) ? Math.max(updatedTime, scheduledTime) : updatedTime).toISOString();
  db.prepare('UPDATE content SET published_at = ?, expires_at = ? WHERE id = ?')
    .run(publishedAt, new Date(Date.parse(publishedAt) + 24 * 60 * 60 * 1000).toISOString(), row.id);
}

const passwordHash = (password, salt = crypto.randomBytes(16)) => ({
  salt: salt.toString('hex'),
  hash: crypto.scryptSync(password, salt, 64).toString('hex'),
});
const bootstrapPassword = passwordHash(adminPassword);
if (!supabaseEnabled) {
  db.prepare(`
    INSERT INTO admin_users (username, password_salt, password_hash, role, active, created_at)
    VALUES (?, ?, ?, 'admin', 1, ?)
    ON CONFLICT(username) DO UPDATE SET
      password_salt = excluded.password_salt,
      password_hash = excluded.password_hash,
      role = 'admin',
      active = 1
  `).run(adminUsername, bootstrapPassword.salt, bootstrapPassword.hash, new Date().toISOString());
}
const dummySalt = crypto.randomBytes(16);
const dummyPasswordHash = crypto.scryptSync(crypto.randomBytes(32), dummySalt, 64);
const publicPagePaths = ['/', '/global-impact-safety', '/products', '/about-sources'];
const configurablePagePaths = publicPagePaths.filter((pagePath) => pagePath !== '/');
const readVisiblePages = async () => {
  const row = supabaseEnabled
    ? await readSupabaseSetting('page_visibility')
    : db.prepare("SELECT value FROM site_state WHERE key = 'page_visibility'").get();
  if (!row) return publicPagePaths;
  const parsed = JSON.parse(row.value);
  const result = z.array(z.enum(configurablePagePaths)).max(configurablePagePaths.length).safeParse(parsed);
  if (!result.success || new Set(result.data).size !== result.data.length) {
    throw new Error('Stored page visibility settings are invalid.');
  }
  return ['/', ...result.data];
};

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', isProduction ? 1 : false);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://api.open-meteo.com', 'https://geocoding-api.open-meteo.com'],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '256kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

class SqliteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
    this.readSession = database.prepare('SELECT sess, expires_at FROM admin_sessions WHERE sid = ?');
    this.writeSession = database.prepare(`
      INSERT INTO admin_sessions (sid, sess, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at
    `);
    this.deleteSession = database.prepare('DELETE FROM admin_sessions WHERE sid = ?');
    this.updateExpiry = database.prepare('UPDATE admin_sessions SET expires_at = ? WHERE sid = ?');
  }

  get(id, callback) {
    try {
      const row = this.readSession.get(id);
      if (!row || row.expires_at <= Date.now()) {
        if (row) this.deleteSession.run(id);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(id, data, callback = () => {}) {
    try {
      const expiresAt = data.cookie?.expires
        ? new Date(data.cookie.expires).getTime()
        : Date.now() + (data.cookie?.maxAge || 8 * 60 * 60 * 1000);
      this.writeSession.run(id, JSON.stringify(data), expiresAt);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(id, data, callback = () => {}) {
    try {
      const expiresAt = data.cookie?.expires
        ? new Date(data.cookie.expires).getTime()
        : Date.now() + (data.cookie?.maxAge || 8 * 60 * 60 * 1000);
      this.updateExpiry.run(expiresAt, id);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(id, callback = () => {}) {
    try {
      this.deleteSession.run(id);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

class SupabaseSessionStore extends session.Store {
  get(id, callback) {
    const query = new URLSearchParams({
      select: 'sess,expires_at',
      sid: `eq.${id}`,
      expires_at: `gt.${new Date().toISOString()}`,
      limit: '1',
    });
    void supabaseRows('admin_sessions', query)
      .then(async (rows) => {
        if (rows[0]) return callback(null, rows[0].sess);
        await supabaseDelete('admin_sessions', {
          sid: `eq.${id}`,
          expires_at: `lte.${new Date().toISOString()}`,
        });
        callback(null, null);
      })
      .catch(callback);
  }

  set(id, data, callback = () => {}) {
    const expiresAt = data.cookie?.expires
      ? new Date(data.cookie.expires).toISOString()
      : new Date(Date.now() + (data.cookie?.maxAge || 8 * 60 * 60 * 1000)).toISOString();
    void supabaseUpsert('admin_sessions', {
      sid: id,
      sess: data,
      expires_at: expiresAt,
    }, 'sid')
      .then(() => callback(null))
      .catch(callback);
  }

  touch(id, data, callback = () => {}) {
    const expiresAt = data.cookie?.expires
      ? new Date(data.cookie.expires).toISOString()
      : new Date(Date.now() + (data.cookie?.maxAge || 8 * 60 * 60 * 1000)).toISOString();
    void supabasePatch('admin_sessions', { sid: `eq.${id}` }, { expires_at: expiresAt })
      .then(() => callback(null))
      .catch(callback);
  }

  destroy(id, callback = () => {}) {
    void supabaseDelete('admin_sessions', { sid: `eq.${id}` })
      .then(() => callback(null))
      .catch(callback);
  }
}

app.use(session({
  name: 'el-nino-admin',
  store: supabaseEnabled ? new SupabaseSessionStore() : new SqliteSessionStore(db),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  },
}));

const contentSchema = z.object({
  kind: z.enum(['update', 'product', 'page', 'content']),
  titleEn: z.string().trim().max(180).default(''),
  titleTe: z.string().trim().max(180).default(''),
  titleEs: z.string().trim().max(180).default(''),
  descriptionEn: z.string().trim().max(5000).default(''),
  descriptionTe: z.string().trim().max(5000).default(''),
  descriptionEs: z.string().trim().max(5000).default(''),
  date: z.string().trim().max(120).default(''),
  imageUrl: z.string().trim().max(2048).default(''),
  category: z.string().trim().max(80).default(''),
  sourceName: z.string().trim().max(160).default(''),
  sourceUrl: z.string().trim().max(2048).default(''),
  linkUrl: z.string().trim().max(2048).default(''),
  price: z.string().trim().max(80).default(''),
  offer: z.string().trim().max(300).default(''),
  offerTe: z.string().trim().max(300).default(''),
  offerEs: z.string().trim().max(300).default(''),
  offerExpiresAt: z.string().trim().max(40).default('').refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Enter a valid offer expiry date and time.'),
  recommendedFor: z.string().trim().max(300).default(''),
  recommendedForTe: z.string().trim().max(300).default(''),
  recommendedForEs: z.string().trim().max(300).default(''),
  badge: z.string().trim().max(100).default(''),
  availableCountries: z.string().trim().toUpperCase().max(1000).default(''),
  climateRisks: z.string().trim().toLowerCase().max(500).default(''),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).or(z.literal('')).default(''),
  scheduledAt: z.string().trim().max(40).default('').refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Enter a valid schedule date and time.'),
  pagePath: z.string().trim().max(120).default('/'),
  seoTitleEn: z.string().trim().max(180).default(''),
  seoTitleTe: z.string().trim().max(180).default(''),
  seoTitleEs: z.string().trim().max(180).default(''),
  seoDescriptionEn: z.string().trim().max(320).default(''),
  seoDescriptionTe: z.string().trim().max(320).default(''),
  seoDescriptionEs: z.string().trim().max(320).default(''),
  published: z.boolean().default(false),
}).strict().superRefine((item, context) => {
  for (const field of ['imageUrl', 'sourceUrl', 'linkUrl']) {
    const value = item[field];
    if (value && !isSafeUrl(value)) {
      context.addIssue({ code: 'custom', path: [field], message: 'Use an HTTPS URL or a local /uploads/ image path.' });
    }
  }
  if (item.kind === 'product' && item.published && !item.availableCountries) {
    context.addIssue({ code: 'custom', path: ['availableCountries'], message: 'Enter verified country codes or * for global availability before publishing a product.' });
  }
  if (item.kind === 'product' && item.published) {
    if (!item.titleEn || !item.imageUrl || !item.linkUrl) {
      context.addIssue({ code: 'custom', path: ['titleEn'], message: 'Published products need a name, image, and product link.' });
    }
  }
  if (item.kind === 'update' && item.published && (!item.sourceName || !item.sourceUrl)) {
    context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Published updates need a named official source and source URL.' });
  }
  if (item.availableCountries && item.availableCountries.split(',').some((code) => !/^(?:\*|[A-Z]{2})$/.test(code.trim()))) {
    context.addIssue({ code: 'custom', path: ['availableCountries'], message: 'Use comma-separated two-letter country codes, or * for global availability.' });
  }
  if (!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(item.pagePath)) {
    context.addIssue({ code: 'custom', path: ['pagePath'], message: 'Enter a valid local page path, such as / or /products.' });
  }
});

app.get('/api/admin/media', requireAuthenticated, async (_req, res, next) => {
  try {
    const localImages = fs.readdirSync(uploadDir)
      .filter((name) => /^[a-f0-9-]+\.webp$/.test(name))
      .map((name) => {
        const stats = fs.statSync(path.join(uploadDir, name));
        return { imageUrl: `/uploads/${name}`, updatedAt: stats.mtime.toISOString() };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    let remoteImages = [];
    if (supabaseEnabled) {
      const objects = await supabaseRequest(`/storage/v1/object/list/${encodeURIComponent(supabaseStorageBucket)}`, {
        method: 'POST',
        body: { prefix: 'uploads', limit: 1000, offset: 0, sortBy: { column: 'updated_at', order: 'desc' } },
      });
      remoteImages = objects
        .filter((object) => object.name && object.id)
        .map((object) => ({
          imageUrl: publicStorageUrl(`uploads/${object.name}`),
          updatedAt: object.updated_at || object.created_at || new Date(0).toISOString(),
        }));
    }
    res.set('Cache-Control', 'no-store');
    res.json([...remoteImages, ...localImages]);
  } catch (error) {
    next(error);
  }
});

function isSafeUrl(value) {
  if (value.startsWith('/uploads/')) return /^\/uploads\/[a-f0-9-]+\.webp$/.test(value);
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const csrfToken = (req) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
};

function requireCsrf(req, res, next) {
  const expected = req.session.csrfToken;
  const supplied = req.get('x-csrf-token');
  if (!expected || !supplied || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ error: 'Your session token expired. Refresh the page and try again.' });
  }
  next();
}

async function requireAuthenticated(req, res, next) {
  try {
    if (req.session.admin !== true || typeof req.session.username !== 'string') {
      return res.status(401).json({ error: 'Sign in is required.' });
    }
    const user = await getAdminUser(req.session.username);
    if (!user || user.active !== true && user.active !== 1) {
      return res.status(401).json({ error: 'This account is unavailable. Sign in again or contact an administrator.' });
    }
    req.adminUser = { username: user.username, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.adminUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access is required.' });
  }
  next();
}

function requireContentEditor(req, res, next) {
  if (!['admin', 'editor'].includes(req.adminUser?.role)) {
    return res.status(403).json({ error: 'Editor access is required to change website content.' });
  }
  next();
}

const writeAudit = async (action, contentId = '', actor = 'Administrator') => {
  const row = {
    id: crypto.randomUUID(),
    actor,
    action,
    content_id: contentId,
    created_at: new Date().toISOString(),
  };
  if (supabaseEnabled) {
    await supabaseRequest('/rest/v1/admin_audit', {
      method: 'POST',
      body: row,
      headers: { Prefer: 'return=minimal' },
    });
    return;
  }
  db.prepare('INSERT INTO admin_audit (id, actor, action, content_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(row.id, row.actor, row.action, row.content_id, row.created_at);
};

function parseEntry(row) {
  const content = contentSchema.parse({
    ...JSON.parse(row.payload),
    kind: row.kind,
    published: false,
  });
  const verifiedForPublication = row.kind === 'product'
    ? Boolean(content.availableCountries && content.titleEn && content.imageUrl && content.linkUrl)
    : row.kind !== 'update' || Boolean(content.sourceName && content.sourceUrl);
  return {
    id: row.id,
    ...content,
    published: row.published === 1 && verifiedForPublication,
    updatedAt: row.updated_at,
    publishedAt: row.published_at || '',
    expiresAt: row.expires_at || '',
  };
}

function localPublicationWindow(kind, published, payload, existingRow, now) {
  if (kind !== 'update' || !published) return { publishedAt: null, expiresAt: null };
  if (existingRow?.kind === 'update' && existingRow.published === 1 && existingRow.published_at) {
    const oldPayload = JSON.parse(existingRow.payload);
    if (oldPayload.scheduledAt === payload.scheduledAt) {
      return { publishedAt: existingRow.published_at, expiresAt: existingRow.expires_at };
    }
  }
  const scheduledAt = Date.parse(payload.scheduledAt || '');
  const publishedAt = new Date(Number.isFinite(scheduledAt) ? Math.max(now.getTime(), scheduledAt) : now.getTime()).toISOString();
  return {
    publishedAt,
    expiresAt: new Date(Date.parse(publishedAt) + 24 * 60 * 60 * 1000).toISOString(),
  };
}

const findAllContent = db.prepare('SELECT id, kind, payload, published, updated_at, published_at, expires_at FROM content ORDER BY updated_at DESC');
const findContentById = db.prepare('SELECT id, kind, payload, published, updated_at, published_at, expires_at FROM content WHERE id = ?');

async function supabaseRequest(endpoint, { method = 'GET', body, headers = {}, publicRead = false } = {}) {
  const key = publicRead ? supabaseAnonKey : supabaseServiceRoleKey;
  const response = await fetch(`${supabaseUrl}${endpoint}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = '';
    try {
      const result = JSON.parse(text);
      message = result.message || result.error_description || result.error || '';
    } catch {
      message = '';
    }
    throw new Error(`Supabase request failed (${response.status})${message ? `: ${message}` : '.'}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function supabaseRows(table, filters = new URLSearchParams()) {
  const query = new URLSearchParams({ select: '*', ...Object.fromEntries(filters) });
  return supabaseRequest(`/rest/v1/${encodeURIComponent(table)}?${query}`, { publicRead: false });
}

async function supabaseUpsert(table, row, conflictColumn) {
  const query = new URLSearchParams({ on_conflict: conflictColumn });
  return supabaseRequest(`/rest/v1/${encodeURIComponent(table)}?${query}`, {
    method: 'POST',
    body: row,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  });
}

async function supabasePatch(table, filters, patch) {
  const query = new URLSearchParams(filters);
  return supabaseRequest(`/rest/v1/${encodeURIComponent(table)}?${query}`, {
    method: 'PATCH',
    body: patch,
    headers: { Prefer: 'return=representation' },
  });
}

async function supabaseDelete(table, filters) {
  const query = new URLSearchParams(filters);
  return supabaseRequest(`/rest/v1/${encodeURIComponent(table)}?${query}`, { method: 'DELETE' });
}

async function readSupabaseSetting(key) {
  const rows = await supabaseRows('site_state', new URLSearchParams({ key: `eq.${key}`, limit: '1' }));
  return rows[0] || null;
}

async function writeSupabaseSetting(key, value) {
  await supabaseUpsert('site_state', { key, value }, 'key');
}

async function getAdminUser(username) {
  if (!supabaseEnabled) {
    return db.prepare('SELECT username, role, active FROM admin_users WHERE username = ? COLLATE NOCASE')
      .get(username);
  }
  const rows = await supabaseRows('admin_users', new URLSearchParams({
    select: 'username,role,active',
    username: `ilike.${username}`,
    limit: '1',
  }));
  return rows[0] || null;
}

async function getStoredAdminUser(username) {
  if (!supabaseEnabled) {
    return db.prepare('SELECT username, password_salt, password_hash, role, active FROM admin_users WHERE username = ? COLLATE NOCASE')
      .get(username);
  }
  const rows = await supabaseRows('admin_users', new URLSearchParams({
    select: 'username,password_salt,password_hash,role,active',
    username: `ilike.${username}`,
    limit: '1',
  }));
  return rows[0] || null;
}

async function listSupabaseUsers() {
  const users = await supabaseRows('admin_users', new URLSearchParams({ select: 'username,role,active,created_at' }));
  return users.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
}

async function invalidateSupabaseUserSessions(username) {
  const rows = await supabaseRows('admin_sessions', new URLSearchParams({ select: 'sid,sess' }));
  const matchingIds = rows.filter((row) => row.sess?.username?.toLowerCase() === username.toLowerCase()).map((row) => row.sid);
  await Promise.all(matchingIds.map((sid) => supabaseDelete('admin_sessions', { sid: `eq.${sid}` })));
}

async function listAllContent() {
  if (!supabaseEnabled) return findAllContent.all().map(parseEntry);
  return (await listSupabaseContent()).map(parseSupabaseEntry);
}

async function findContent(id) {
  if (!supabaseEnabled) {
    const row = findContentById.get(id);
    return row ? parseEntry(row) : null;
  }
  const row = await findSupabaseContent(id);
  return row ? parseSupabaseEntry(row) : null;
}

async function readContentInitialized() {
  if (!supabaseEnabled) {
    return db.prepare("SELECT value FROM site_state WHERE key = 'content_initialized'").get()?.value === '1';
  }
  return (await readSupabaseSetting('content_initialized'))?.value === '1';
}

async function setContentInitialized() {
  if (supabaseEnabled) await writeSupabaseSetting('content_initialized', '1');
  else db.prepare("UPDATE site_state SET value = '1' WHERE key = 'content_initialized'").run();
}

async function recordPageView(pagePath, day) {
  if (!supabaseEnabled) {
    db.prepare(`
      INSERT INTO page_views (day, page_path, views) VALUES (?, ?, 1)
      ON CONFLICT(day, page_path) DO UPDATE SET views = views + 1
    `).run(day, pagePath);
    return;
  }
  await supabaseRequest('/rest/v1/rpc/record_site_page_view', {
    method: 'POST',
    body: { view_day: day, view_path: pagePath },
  });
}

function supabaseContentUrl(query = '') {
  return `/rest/v1/site_content${query ? `?${query}` : ''}`;
}

class SupabaseRateLimitStore {
  keyFor(key) {
    return crypto.createHmac('sha256', sessionSecret).update(key).digest('hex');
  }

  async increment(key) {
    const result = await supabaseRequest('/rest/v1/rpc/record_admin_login_attempt', {
      method: 'POST',
      body: { limit_key: this.keyFor(key), window_seconds: 900 },
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.reset_at || !Number.isInteger(row.total_hits)) {
      throw new Error('Supabase returned an invalid login rate-limit result.');
    }
    return { totalHits: row.total_hits, resetTime: new Date(row.reset_at) };
  }

  async decrement(key) {
    await supabaseRequest('/rest/v1/rpc/decrement_admin_login_attempt', {
      method: 'POST',
      body: { limit_key: this.keyFor(key) },
    });
  }

  async resetKey(key) {
    await supabaseDelete('admin_login_limits', { key: `eq.${this.keyFor(key)}` });
  }
}

function parseSupabaseEntry(row) {
  return {
    ...parseEntry({
    ...row,
    payload: JSON.stringify(row.payload),
    published: row.published ? 1 : 0,
    updated_at: row.updated_at,
    }),
    publishedAt: row.published_at || '',
    expiresAt: row.expires_at || '',
  };
}

async function listSupabaseContent({ publicOnly = false } = {}) {
  const query = new URLSearchParams({
    select: 'id,kind,payload,published,updated_at,published_at,expires_at',
    order: 'updated_at.desc',
  });
  if (publicOnly) query.set('published', 'eq.true');
  return supabaseRequest(supabaseContentUrl(query.toString()), { publicRead: publicOnly });
}

async function findSupabaseContent(id) {
  const query = new URLSearchParams({
    select: 'id,kind,payload,published,updated_at,published_at,expires_at',
    id: `eq.${id}`,
    limit: '1',
  });
  const rows = await supabaseRequest(supabaseContentUrl(query.toString()));
  return rows[0] || null;
}

async function saveSupabaseContent(id, content) {
  const query = new URLSearchParams({ on_conflict: 'id' });
  const rows = await supabaseRequest(supabaseContentUrl(query.toString()), {
    method: 'POST',
    body: { id, kind: content.kind, payload: content.payload, published: content.published },
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  });
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Supabase did not return the saved content record.');
  return rows[0];
}

async function deleteSupabaseContent(id) {
  const query = new URLSearchParams({ id: `eq.${id}` });
  await supabaseRequest(supabaseContentUrl(query.toString()), { method: 'DELETE' });
}

function publicStorageUrl(objectPath) {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(supabaseStorageBucket)}/${encodedPath}`;
}

async function storeSupabaseImage(buffer, objectPath) {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(supabaseStorageBucket)}/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: buffer,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = '';
    try {
      const result = JSON.parse(text);
      message = result.message || result.error || '';
    } catch {
      message = '';
    }
    throw new Error(`Supabase image upload failed (${response.status})${message ? `: ${message}` : '.'}`);
  }
  return publicStorageUrl(objectPath);
}

async function migrateLegacySupabaseContent() {
  if (!supabaseEnabled) return;

  const localImages = fs.readdirSync(uploadDir).filter((name) => /^[a-f0-9-]+\.webp$/.test(name));
  const remoteImages = await supabaseRequest(`/storage/v1/object/list/${encodeURIComponent(supabaseStorageBucket)}`, {
    method: 'POST',
    body: { prefix: 'uploads', limit: 1000, offset: 0 },
  });
  const remoteImageNames = new Set(remoteImages.map((object) => object.name));
  for (const name of localImages) {
    if (remoteImageNames.has(name)) continue;
    const buffer = fs.readFileSync(path.join(uploadDir, name));
    await storeSupabaseImage(buffer, `uploads/${name}`);
  }

  const localEntries = findAllContent.all();
  for (const row of localEntries) {
    if (await findSupabaseContent(row.id)) continue;
    const entry = parseEntry(row);
    if (entry.imageUrl.startsWith('/uploads/')) {
      const name = entry.imageUrl.slice('/uploads/'.length);
      if (!localImages.includes(name)) {
        throw new Error(`Cannot migrate ${row.kind} ${row.id}: its local image ${name} is missing.`);
      }
      entry.imageUrl = publicStorageUrl(`uploads/${name}`);
    }
    const { id, updatedAt, published, ...payload } = entry;
    void updatedAt;
    await saveSupabaseContent(row.id, {
      kind: entry.kind,
      payload,
      published,
    });
  }

  const localUsers = db.prepare('SELECT username, password_salt, password_hash, role, active, created_at FROM admin_users').all();
  for (const user of localUsers) {
    const existing = await getAdminUser(user.username);
    if (!existing) await supabaseUpsert('admin_users', { ...user, active: user.active === 1 }, 'username');
  }
  if (!(await getAdminUser(adminUsername))) {
    await supabaseUpsert('admin_users', {
      username: adminUsername,
      password_salt: bootstrapPassword.salt,
      password_hash: bootstrapPassword.hash,
      role: 'admin',
      active: true,
      created_at: new Date().toISOString(),
    }, 'username');
  }

  const localSettings = db.prepare('SELECT key, value FROM site_state').all();
  for (const setting of localSettings) {
    if (!(await readSupabaseSetting(setting.key))) await writeSupabaseSetting(setting.key, setting.value);
  }
  if (localEntries.length > 0) await setContentInitialized();

  const localAudit = db.prepare('SELECT id, actor, action, content_id, created_at FROM admin_audit ORDER BY created_at').all();
  for (const item of localAudit) {
    const existing = await supabaseRows('admin_audit', new URLSearchParams({ id: `eq.${item.id}`, limit: '1' }));
    if (existing.length === 0) await supabaseRequest('/rest/v1/admin_audit', {
      method: 'POST',
      body: item,
      headers: { Prefer: 'return=minimal' },
    });
  }
  const localViews = db.prepare('SELECT day, page_path, views FROM page_views').all();
  for (const item of localViews) {
    const existing = await supabaseRows('page_views', new URLSearchParams({
      select: 'day,page_path',
      day: `eq.${item.day}`,
      page_path: `eq.${item.page_path}`,
      limit: '1',
    }));
    if (existing.length === 0) {
      await supabaseRequest('/rest/v1/page_views?on_conflict=day%2Cpage_path', {
        method: 'POST',
        body: { day: item.day, page_path: item.page_path, views: item.views },
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
    }
  }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
const pageViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
app.post('/api/analytics/page-view', pageViewLimiter, (req, res, next) => {
  const body = z.object({ path: z.enum(['/', '/global-impact-safety', '/products', '/about-sources']) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'The page view is not valid.' });
  void recordPageView(body.data.path, new Date().toISOString().slice(0, 10))
    .then(() => res.status(204).end())
    .catch((error) => next(error));
});
app.get('/api/auth/session', async (req, res, next) => {
  try {
  res.set('Cache-Control', 'no-store');
  const user = req.session.admin === true && typeof req.session.username === 'string'
    ? await getAdminUser(req.session.username)
    : null;
  const authenticated = Boolean(user && (user.active === true || user.active === 1));
  res.json({
    authenticated,
    user: authenticated ? { username: user.username, role: user.role } : null,
    csrfToken: csrfToken(req),
  });
  } catch (error) {
    next(error);
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait and try again.' },
  ...(supabaseEnabled ? { store: new SupabaseRateLimitStore() } : {}),
});

app.post('/api/auth/login', loginLimiter, requireCsrf, async (req, res, next) => {
  const body = z.object({
    username: z.string().trim().min(3).max(48).regex(/^[a-zA-Z0-9._-]+$/),
    password: z.string().min(1).max(256),
  }).strict().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Enter a valid username and password.' });
  try {
    const user = await getStoredAdminUser(body.data.username);
    const salt = user ? Buffer.from(user.password_salt, 'hex') : dummySalt;
    const expected = user ? Buffer.from(user.password_hash, 'hex') : dummyPasswordHash;
    const candidate = crypto.scryptSync(body.data.password, salt, 64);
    if (!crypto.timingSafeEqual(candidate, expected) || !user || !(user.active === true || user.active === 1)) {
      return res.status(401).json({ error: 'The username or password is incorrect.' });
    }
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.admin = true;
    req.session.username = user.username;
    req.session.role = user.role;
    csrfToken(req);
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    await writeAudit('signed in', '', user.username);
    res.json({ authenticated: true, user: { username: user.username, role: user.role }, csrfToken: req.session.csrfToken });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', requireAuthenticated, requireCsrf, async (req, res, next) => {
  try {
    await writeAudit('signed out', '', req.adminUser.username);
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie('el-nino-admin', { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/users', requireAuthenticated, requireAdmin, async (_req, res, next) => {
  try {
    const users = supabaseEnabled
      ? await listSupabaseUsers()
      : db.prepare(`
          SELECT username, role, active, created_at AS createdAt
          FROM admin_users
          ORDER BY username COLLATE NOCASE
        `).all();
    res.set('Cache-Control', 'no-store');
    res.json(users.map((user) => ({
      username: user.username,
      role: user.role,
      active: user.active === true || user.active === 1,
      createdAt: user.createdAt || user.created_at,
    })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/users', requireAuthenticated, requireAdmin, requireCsrf, async (req, res, next) => {
  const body = z.object({
    username: z.string().trim().min(3).max(48).regex(/^[a-zA-Z0-9._-]+$/),
    password: z.string().min(12).max(256),
    role: z.enum(['editor', 'viewer']),
  }).strict().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Enter a valid username, a password of at least 12 characters, and an editor or viewer role.' });
  const credentials = passwordHash(body.data.password);
  try {
    const createdAt = new Date().toISOString();
    if (await getAdminUser(body.data.username)) return res.status(409).json({ error: 'An account with that username already exists.' });
    if (supabaseEnabled) {
      await supabaseRequest('/rest/v1/admin_users', {
        method: 'POST',
        body: {
          username: body.data.username,
          password_salt: credentials.salt,
          password_hash: credentials.hash,
          role: body.data.role,
          active: true,
          created_at: createdAt,
        },
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      db.prepare(`
        INSERT INTO admin_users (username, password_salt, password_hash, role, active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(body.data.username, credentials.salt, credentials.hash, body.data.role, createdAt);
    }
    await writeAudit(`created ${body.data.role} account`, '', req.adminUser.username);
    res.status(201).json({
      username: body.data.username,
      role: body.data.role,
      active: true,
      createdAt,
    });
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || /unique constraint|duplicate key/i.test(error.message || '')) {
      return res.status(409).json({ error: 'An account with that username already exists.' });
    }
    next(error);
  }
});

app.patch('/api/admin/users/:username', requireAuthenticated, requireAdmin, requireCsrf, async (req, res, next) => {
  const username = z.string().min(3).max(48).regex(/^[a-zA-Z0-9._-]+$/).safeParse(req.params.username);
  const body = z.object({
    role: z.enum(['editor', 'viewer']).optional(),
    active: z.boolean().optional(),
    password: z.string().min(12).max(256).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!username.success || !body.success) return res.status(400).json({ error: 'Enter valid account changes.' });
  if (username.data.toLowerCase() === adminUsername.toLowerCase()) {
    return res.status(400).json({ error: 'The configured administrator account cannot be changed here.' });
  }
  if (username.data.toLowerCase() === req.adminUser.username.toLowerCase() &&
      (body.data.role !== undefined || body.data.active === false)) {
    return res.status(400).json({ error: 'You cannot change your own role or deactivate your own account.' });
  }
  try {
    const user = supabaseEnabled
      ? (await supabaseRows('admin_users', new URLSearchParams({
          select: 'username,role,active,created_at',
          username: `ilike.${username.data}`,
          limit: '1',
        })))[0]
      : db.prepare('SELECT username, role, active, created_at AS createdAt FROM admin_users WHERE username = ? COLLATE NOCASE')
          .get(username.data);
    if (!user) return res.status(404).json({ error: 'This account does not exist.' });
    const role = body.data.role ?? user.role;
    const active = body.data.active ?? (user.active === true || user.active === 1);
    const patch = { role, active };
    if (body.data.password) {
      const credentials = passwordHash(body.data.password);
      Object.assign(patch, { password_salt: credentials.salt, password_hash: credentials.hash });
      if (supabaseEnabled) {
        await supabasePatch('admin_users', { username: `ilike.${user.username}` }, patch);
        await invalidateSupabaseUserSessions(user.username);
      } else {
        db.prepare(`
          UPDATE admin_users
          SET role = ?, active = ?, password_salt = ?, password_hash = ?
          WHERE username = ? COLLATE NOCASE
        `).run(role, Number(active), credentials.salt, credentials.hash, user.username);
        db.prepare("DELETE FROM admin_sessions WHERE json_extract(sess, '$.username') = ? COLLATE NOCASE")
          .run(user.username);
      }
    } else {
      if (supabaseEnabled) await supabasePatch('admin_users', { username: `ilike.${user.username}` }, patch);
      else db.prepare('UPDATE admin_users SET role = ?, active = ? WHERE username = ? COLLATE NOCASE')
        .run(role, Number(active), user.username);
    }
    await writeAudit(`updated account ${user.username}`, '', req.adminUser.username);
    res.json({ username: user.username, role, active, createdAt: user.createdAt || user.created_at });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public/settings', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ visiblePages: await readVisiblePages() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/settings', requireAuthenticated, requireAdmin, async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ visiblePages: await readVisiblePages() });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/settings', requireAuthenticated, requireAdmin, requireCsrf, async (req, res, next) => {
  const body = z.object({
    visiblePages: z.array(z.enum(configurablePagePaths)).max(configurablePagePaths.length),
  }).strict().safeParse(req.body);
  if (!body.success || new Set(body.data?.visiblePages).size !== body.data?.visiblePages.length) {
    return res.status(400).json({ error: 'Choose a valid, unique set of public pages. The homepage always remains visible.' });
  }
  try {
    if (supabaseEnabled) await writeSupabaseSetting('page_visibility', JSON.stringify(body.data.visiblePages));
    else db.prepare("UPDATE site_state SET value = ? WHERE key = 'page_visibility'")
      .run(JSON.stringify(body.data.visiblePages));
    await writeAudit('updated page visibility', '', req.adminUser.username);
    res.set('Cache-Control', 'no-store');
    res.json({ visiblePages: ['/', ...body.data.visiblePages] });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public/content', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const visiblePages = new Set(await readVisiblePages());
    const initialized = await readContentInitialized();
    let items;
    if (supabaseEnabled) {
      const rows = await listSupabaseContent({ publicOnly: true });
      items = rows.filter((row) => {
        if (row.kind === 'product') {
          return Boolean(row.payload.availableCountries && row.payload.titleEn && row.payload.imageUrl && row.payload.linkUrl);
        }
        if (row.kind === 'update') {
          return Boolean(row.expires_at && Date.parse(row.expires_at) > Date.now()
            && row.payload.sourceName && row.payload.sourceUrl
            && (!row.payload.scheduledAt || Date.parse(row.payload.scheduledAt) <= Date.now()));
        }
        return true;
      }).map(parseSupabaseEntry);
    } else {
      const now = new Date().toISOString();
      items = db.prepare(`
      SELECT id, kind, payload, published, updated_at
      FROM content
      WHERE published = 1
      AND (
        kind != 'product'
        OR (
          COALESCE(json_extract(payload, '$.availableCountries'), '') != ''
          AND COALESCE(json_extract(payload, '$.titleEn'), '') != ''
          AND COALESCE(json_extract(payload, '$.imageUrl'), '') != ''
          AND COALESCE(json_extract(payload, '$.linkUrl'), '') != ''
        )
      )
      AND (
        kind != 'update'
        OR (
          COALESCE(json_extract(payload, '$.sourceName'), '') != ''
          AND COALESCE(json_extract(payload, '$.sourceUrl'), '') != ''
          AND expires_at > ?
        )
      )
      AND (
        json_extract(payload, '$.scheduledAt') IS NULL
        OR json_extract(payload, '$.scheduledAt') = ''
        OR json_extract(payload, '$.scheduledAt') <= ?
      )
      ORDER BY updated_at DESC
    `).all(now, now).map(parseEntry);
    }
    items = items.filter((item) =>
      !['page', 'content'].includes(item.kind) || visiblePages.has(item.pagePath),
    );
    res.json({ items, initialized });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/summary', requireAuthenticated, async (_req, res, next) => {
  try {
    let counts;
    if (supabaseEnabled) {
      const entries = await listAllContent();
      counts = entries.reduce((result, item) => {
        if (item.kind === 'product' && item.published && item.availableCountries) result.publishedProducts += 1;
        if (item.kind === 'update' && item.published && item.expiresAt
          && Date.parse(item.expiresAt) > Date.now()) result.publishedUpdates += 1;
        if (!item.published) result.drafts += 1;
        return result;
      }, { publishedProducts: 0, publishedUpdates: 0, drafts: 0 });
    } else {
      counts = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN kind = 'product' AND published = 1 AND COALESCE(json_extract(payload, '$.availableCountries'), '') != '' THEN 1 ELSE 0 END), 0) AS publishedProducts,
        COALESCE(SUM(CASE WHEN kind = 'update' AND published = 1 AND COALESCE(json_extract(payload, '$.sourceUrl'), '') != '' AND expires_at > ? THEN 1 ELSE 0 END), 0) AS publishedUpdates,
        COALESCE(SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END), 0) AS drafts
      FROM content
    `).get(new Date().toISOString());
    }
    let visitorViews;
    let recentActivity;
    if (supabaseEnabled) {
      const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const views = await supabaseRows('page_views', new URLSearchParams({ select: 'views', day: `gte.${since}` }));
      visitorViews = views.reduce((sum, item) => sum + item.views, 0);
      recentActivity = (await supabaseRows('admin_audit', new URLSearchParams({
        select: 'action,content_id,created_at',
        order: 'created_at.desc',
        limit: '8',
      }))).map((item) => ({ action: item.action, contentId: item.content_id, createdAt: item.created_at }));
    } else {
      visitorViews = db.prepare('SELECT COALESCE(SUM(views), 0) AS count FROM page_views WHERE day >= ?')
        .get(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).count;
      recentActivity = db.prepare('SELECT action, content_id AS contentId, created_at AS createdAt FROM admin_audit ORDER BY created_at DESC LIMIT 8').all();
    }
    res.set('Cache-Control', 'no-store');
    res.json({ ...counts, visitorViews, recentActivity });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/content', requireAuthenticated, async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const entries = await listAllContent();
    res.json(entries.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/content/seed', requireAuthenticated, requireContentEditor, requireCsrf, async (req, res, next) => {
  const seedSchema = z.object({
    updates: z.array(contentSchema).max(100),
    products: z.array(contentSchema).max(100),
  }).strict();
  const body = seedSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'The initial content could not be validated.' });
  try {
    if (supabaseEnabled) {
      if ((await listSupabaseContent()).length > 0) return res.status(409).json({ error: 'Content has already been initialized.' });
      for (const item of [...body.data.updates, ...body.data.products]) {
        const { kind, published, ...payload } = item;
        await saveSupabaseContent(crypto.randomUUID(), { kind, payload, published });
      }
      await setContentInitialized();
      return res.status(201).json({ seeded: true });
    }
    const seed = db.transaction(() => {
      if (db.prepare('SELECT COUNT(*) AS count FROM content').get().count !== 0) return;
      const insert = db.prepare('INSERT INTO content (id, kind, payload, published, updated_at, published_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const now = new Date().toISOString();
      for (const item of [...body.data.updates, ...body.data.products]) {
        const { kind, published, ...payload } = item;
        const window = localPublicationWindow(kind, published, payload, null, new Date(now));
        insert.run(crypto.randomUUID(), kind, JSON.stringify(payload), Number(published), now, window.publishedAt, window.expiresAt);
      }
      db.prepare("UPDATE site_state SET value = '1' WHERE key = 'content_initialized'").run();
    });
    seed();
    res.status(201).json({ seeded: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/content', requireAuthenticated, requireContentEditor, requireCsrf, async (req, res, next) => {
  const body = contentSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0]?.message || 'Check the content fields.' });
  try {
    const id = crypto.randomUUID();
    const { kind, published, ...payload } = body.data;
    if (supabaseEnabled) {
      const row = await saveSupabaseContent(id, { kind, payload, published });
      await setContentInitialized();
      await writeAudit(`created ${kind}`, id, req.adminUser.username);
      return res.status(201).json(parseSupabaseEntry(row));
    }
    const now = new Date();
    const updatedAt = now.toISOString();
    const window = localPublicationWindow(kind, published, payload, null, now);
    db.prepare('INSERT INTO content (id, kind, payload, published, updated_at, published_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, kind, JSON.stringify(payload), Number(published), updatedAt, window.publishedAt, window.expiresAt);
    await writeAudit(`created ${kind}`, id, req.adminUser.username);
    res.status(201).json(parseEntry(findContentById.get(id)));
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/content/:id', requireAuthenticated, requireContentEditor, requireCsrf, async (req, res, next) => {
  const body = contentSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0]?.message || 'Check the content fields.' });
  try {
    const { kind, published, ...payload } = body.data;
    const now = new Date();
    const updatedAt = now.toISOString();
    const localEntry = findContentById.get(req.params.id);
    const remoteEntry = supabaseEnabled ? await findSupabaseContent(req.params.id) : null;
    if (!localEntry && !remoteEntry) return res.status(404).json({ error: 'This content entry no longer exists.' });

    if (supabaseEnabled) {
      const row = await saveSupabaseContent(req.params.id, { kind, payload, published });
      if (localEntry) db.prepare('DELETE FROM content WHERE id = ?').run(req.params.id);
      await writeAudit(`${published ? 'published' : 'saved'} ${kind}`, req.params.id, req.adminUser.username);
      return res.json(parseSupabaseEntry(row));
    }

    const window = localPublicationWindow(kind, published, payload, localEntry, now);
    db.prepare(`
      INSERT INTO content (id, kind, payload, published, updated_at, published_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload,
        published = excluded.published, updated_at = excluded.updated_at,
        published_at = excluded.published_at, expires_at = excluded.expires_at
    `).run(req.params.id, kind, JSON.stringify(payload), Number(published), updatedAt, window.publishedAt, window.expiresAt);
    if (remoteEntry) await deleteSupabaseContent(req.params.id);
    await writeAudit(`${published ? 'published' : 'saved'} ${kind}`, req.params.id, req.adminUser.username);
    res.json(parseEntry(findContentById.get(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/content/:id', requireAuthenticated, requireContentEditor, requireCsrf, async (req, res, next) => {
  try {
    const remoteEntry = supabaseEnabled ? await findSupabaseContent(req.params.id) : null;
    if (remoteEntry) await deleteSupabaseContent(req.params.id);
    const result = db.prepare('DELETE FROM content WHERE id = ?').run(req.params.id);
    if (result.changes === 0 && !remoteEntry) return res.status(404).json({ error: 'This content entry no longer exists.' });
    await writeAudit('deleted content', req.params.id, req.adminUser.username);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(Object.assign(new Error('Upload a JPEG, PNG, or WebP image.'), { status: 400 }));
    }
    callback(null, true);
  },
});

app.post('/api/admin/uploads', requireAuthenticated, requireContentEditor, requireCsrf, imageUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
    const metadata = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) {
      return res.status(400).json({ error: 'The uploaded file is not a supported image.' });
    }
    const name = `${crypto.randomUUID()}.webp`;
    const optimizedImage = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
    let imageUrl;
    if (supabaseEnabled) {
      imageUrl = await storeSupabaseImage(optimizedImage, `uploads/${name}`);
    } else {
      await fs.promises.writeFile(path.join(uploadDir, name), optimizedImage, { flag: 'wx' });
      imageUrl = `/uploads/${name}`;
    }
    await writeAudit('uploaded image', '', req.adminUser.username);
    res.status(201).json({ imageUrl });
  } catch (error) {
    if (error instanceof Error
      && !error.message.startsWith('Supabase image upload failed')
      && /image|input file|unsupported/i.test(error.message)) {
      return res.status(400).json({ error: 'The uploaded image could not be decoded.' });
    }
    next(error);
  }
});

app.use('/uploads', express.static(uploadDir, {
  fallthrough: false,
  immutable: true,
  maxAge: '1y',
  dotfiles: 'deny',
  index: false,
}));

const distDir = path.join(rootDir, 'dist');
if (!isVercel && fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: false, maxAge: isProduction ? '1h' : 0 }));
  app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((error, req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: error.code === 'LIMIT_FILE_SIZE' ? 'Images must be smaller than 5 MB.' : 'The image upload was rejected.',
    });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  if (error.status === 413) return res.status(413).json({ error: 'The request is too large.' });
  if (error.status === 400) return res.status(400).json({ error: error.message || 'The request is not valid.' });
  if (error.status === 404 && req.path.startsWith('/uploads/')) {
    return res.status(404).json({ error: 'Image not found.' });
  }
  console.error('Request failed:', error);
  res.status(500).json({ error: 'The request could not be completed. Please try again.' });
});

await migrateLegacySupabaseContent();

if (supabaseEnabled) console.log('Supabase persistence enabled for content, accounts, sessions, settings, analytics, audit, and media.');
else console.warn('Supabase is not configured; persistent data is using local SQLite/filesystem storage.');

if (!isVercel) {
  const server = app.listen(port, () => {
    console.log(`El Niño Ready World server listening on port ${port}`);
  });

  function close() {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  }
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

export default app;
