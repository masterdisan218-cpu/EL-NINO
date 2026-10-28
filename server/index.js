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
const dataDir = path.resolve(process.env.DATA_DIR || path.join(rootDir, 'data'));
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
    updated_at TEXT NOT NULL
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
db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now());
db.prepare(`
  UPDATE site_state SET value = '1'
  WHERE key = 'content_initialized'
  AND EXISTS (SELECT 1 FROM content)
`).run();

const passwordHash = (password, salt = crypto.randomBytes(16)) => ({
  salt: salt.toString('hex'),
  hash: crypto.scryptSync(password, salt, 64).toString('hex'),
});
const bootstrapPassword = passwordHash(adminPassword);
db.prepare(`
  INSERT INTO admin_users (username, password_salt, password_hash, role, active, created_at)
  VALUES (?, ?, ?, 'admin', 1, ?)
  ON CONFLICT(username) DO UPDATE SET
    password_salt = excluded.password_salt,
    password_hash = excluded.password_hash,
    role = 'admin',
    active = 1
`).run(adminUsername, bootstrapPassword.salt, bootstrapPassword.hash, new Date().toISOString());
const dummySalt = crypto.randomBytes(16);
const dummyPasswordHash = crypto.scryptSync(crypto.randomBytes(32), dummySalt, 64);
const publicPagePaths = ['/', '/global-impact-safety', '/products', '/about-sources'];
const configurablePagePaths = publicPagePaths.filter((pagePath) => pagePath !== '/');
const readVisiblePages = () => {
  const row = db.prepare("SELECT value FROM site_state WHERE key = 'page_visibility'").get();
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

app.use(session({
  name: 'el-nino-admin',
  store: new SqliteSessionStore(db),
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

function requireAuthenticated(req, res, next) {
  if (req.session.admin !== true || typeof req.session.username !== 'string') {
    return res.status(401).json({ error: 'Sign in is required.' });
  }
  const user = db.prepare('SELECT username, role, active FROM admin_users WHERE username = ? COLLATE NOCASE')
    .get(req.session.username);
  if (!user || user.active !== 1) {
    return res.status(401).json({ error: 'This account is unavailable. Sign in again or contact an administrator.' });
  }
  req.adminUser = { username: user.username, role: user.role };
  next();
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

const writeAudit = (action, contentId = '', actor = 'Administrator') => {
  db.prepare('INSERT INTO admin_audit (id, actor, action, content_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), actor, action, contentId, new Date().toISOString());
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
  };
}

const findAllContent = db.prepare('SELECT id, kind, payload, published, updated_at FROM content ORDER BY updated_at DESC');
const findContentById = db.prepare('SELECT id, kind, payload, published, updated_at FROM content WHERE id = ?');

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

function supabaseContentUrl(query = '') {
  return `/rest/v1/site_content${query ? `?${query}` : ''}`;
}

function parseSupabaseEntry(row) {
  return parseEntry({
    ...row,
    payload: JSON.stringify(row.payload),
    published: row.published ? 1 : 0,
    updated_at: row.updated_at,
  });
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

  const localEntries = findAllContent.all().filter((row) => row.kind === 'product' || row.kind === 'update');
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
    const { id, updatedAt, ...content } = entry;
    void id;
    void updatedAt;
    await saveSupabaseContent(row.id, {
      kind: content.kind,
      payload: Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'published')),
      published: content.published,
    });
  }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
const pageViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
app.post('/api/analytics/page-view', pageViewLimiter, (req, res) => {
  const body = z.object({ path: z.enum(['/', '/global-impact-safety', '/products', '/about-sources']) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'The page view is not valid.' });
  db.prepare(`
    INSERT INTO page_views (day, page_path, views) VALUES (?, ?, 1)
    ON CONFLICT(day, page_path) DO UPDATE SET views = views + 1
  `).run(new Date().toISOString().slice(0, 10), body.data.path);
  res.status(204).end();
});
app.get('/api/auth/session', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const user = req.session.admin === true && typeof req.session.username === 'string'
    ? db.prepare('SELECT username, role, active FROM admin_users WHERE username = ? COLLATE NOCASE').get(req.session.username)
    : null;
  const authenticated = Boolean(user && user.active === 1);
  res.json({
    authenticated,
    user: authenticated ? { username: user.username, role: user.role } : null,
    csrfToken: csrfToken(req),
  });
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait and try again.' },
});

app.post('/api/auth/login', loginLimiter, requireCsrf, (req, res, next) => {
  const body = z.object({
    username: z.string().trim().min(3).max(48).regex(/^[a-zA-Z0-9._-]+$/),
    password: z.string().min(1).max(256),
  }).strict().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Enter a valid username and password.' });
  const user = db.prepare('SELECT username, password_salt, password_hash, role, active FROM admin_users WHERE username = ? COLLATE NOCASE')
    .get(body.data.username);
  const salt = user ? Buffer.from(user.password_salt, 'hex') : dummySalt;
  const expected = user ? Buffer.from(user.password_hash, 'hex') : dummyPasswordHash;
  const candidate = crypto.scryptSync(body.data.password, salt, 64);
  if (!crypto.timingSafeEqual(candidate, expected) || !user || user.active !== 1) {
    return res.status(401).json({ error: 'The username or password is incorrect.' });
  }
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.admin = true;
    req.session.username = user.username;
    req.session.role = user.role;
    csrfToken(req);
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      writeAudit('signed in', '', user.username);
      res.json({ authenticated: true, user: { username: user.username, role: user.role }, csrfToken: req.session.csrfToken });
    });
  });
});

app.post('/api/auth/logout', requireAuthenticated, requireCsrf, (req, res, next) => {
  writeAudit('signed out', '', req.adminUser.username);
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('el-nino-admin', { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' });
    res.status(204).end();
  });
});

app.get('/api/admin/users', requireAuthenticated, requireAdmin, (_req, res, next) => {
  try {
    const users = db.prepare(`
      SELECT username, role, active, created_at AS createdAt
      FROM admin_users
      ORDER BY username COLLATE NOCASE
    `).all();
    res.set('Cache-Control', 'no-store');
    res.json(users.map((user) => ({ ...user, active: user.active === 1 })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/users', requireAuthenticated, requireAdmin, requireCsrf, (req, res, next) => {
  const body = z.object({
    username: z.string().trim().min(3).max(48).regex(/^[a-zA-Z0-9._-]+$/),
    password: z.string().min(12).max(256),
    role: z.enum(['editor', 'viewer']),
  }).strict().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Enter a valid username, a password of at least 12 characters, and an editor or viewer role.' });
  const credentials = passwordHash(body.data.password);
  try {
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO admin_users (username, password_salt, password_hash, role, active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(body.data.username, credentials.salt, credentials.hash, body.data.role, createdAt);
    writeAudit(`created ${body.data.role} account`, '', req.adminUser.username);
    res.status(201).json({
      username: body.data.username,
      role: body.data.role,
      active: true,
      createdAt,
    });
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'An account with that username already exists.' });
    }
    next(error);
  }
});

app.patch('/api/admin/users/:username', requireAuthenticated, requireAdmin, requireCsrf, (req, res, next) => {
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
    const user = db.prepare('SELECT username, role, active, created_at AS createdAt FROM admin_users WHERE username = ? COLLATE NOCASE')
      .get(username.data);
    if (!user) return res.status(404).json({ error: 'This account does not exist.' });
    const role = body.data.role ?? user.role;
    const active = body.data.active ?? (user.active === 1);
    if (body.data.password) {
      const credentials = passwordHash(body.data.password);
      db.prepare(`
        UPDATE admin_users
        SET role = ?, active = ?, password_salt = ?, password_hash = ?
        WHERE username = ? COLLATE NOCASE
      `).run(role, Number(active), credentials.salt, credentials.hash, user.username);
      db.prepare("DELETE FROM admin_sessions WHERE json_extract(sess, '$.username') = ? COLLATE NOCASE")
        .run(user.username);
    } else {
      db.prepare('UPDATE admin_users SET role = ?, active = ? WHERE username = ? COLLATE NOCASE')
        .run(role, Number(active), user.username);
    }
    writeAudit(`updated account ${user.username}`, '', req.adminUser.username);
    res.json({ username: user.username, role, active, createdAt: user.createdAt });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public/settings', (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ visiblePages: readVisiblePages() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/settings', requireAuthenticated, requireAdmin, (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ visiblePages: readVisiblePages() });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/settings', requireAuthenticated, requireAdmin, requireCsrf, (req, res, next) => {
  const body = z.object({
    visiblePages: z.array(z.enum(configurablePagePaths)).max(configurablePagePaths.length),
  }).strict().safeParse(req.body);
  if (!body.success || new Set(body.data?.visiblePages).size !== body.data?.visiblePages.length) {
    return res.status(400).json({ error: 'Choose a valid, unique set of public pages. The homepage always remains visible.' });
  }
  try {
    db.prepare("UPDATE site_state SET value = ? WHERE key = 'page_visibility'")
      .run(JSON.stringify(body.data.visiblePages));
    writeAudit('updated page visibility', '', req.adminUser.username);
    res.set('Cache-Control', 'no-store');
    res.json({ visiblePages: ['/', ...body.data.visiblePages] });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public/content', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const visiblePages = new Set(readVisiblePages());
    const initialized = db.prepare("SELECT value FROM site_state WHERE key = 'content_initialized'").get().value === '1';
    const now = new Date().toISOString();
    const localItems = db.prepare(`
      SELECT id, kind, payload, published, updated_at
      FROM content
      WHERE published = 1
      AND (? = 0 OR kind NOT IN ('product', 'update'))
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
          AND julianday(COALESCE(NULLIF(json_extract(payload, '$.scheduledAt'), ''), updated_at)) + 1 > julianday(?)
        )
      )
      AND (
        json_extract(payload, '$.scheduledAt') IS NULL
        OR json_extract(payload, '$.scheduledAt') = ''
        OR json_extract(payload, '$.scheduledAt') <= ?
      )
      ORDER BY updated_at DESC
    `).all(Number(supabaseEnabled), now, now).map(parseEntry);
    const remoteRows = supabaseEnabled ? await listSupabaseContent({ publicOnly: true }) : [];
    const remoteItems = remoteRows
      .filter((row) => {
        if (row.kind === 'product') {
          return Boolean(row.payload.availableCountries && row.payload.titleEn && row.payload.imageUrl && row.payload.linkUrl);
        }
        return row.kind === 'update'
          && row.expires_at
          && Date.parse(row.expires_at) > Date.now()
          && Boolean(row.payload.sourceName && row.payload.sourceUrl)
          && (!row.payload.scheduledAt || Date.parse(row.payload.scheduledAt) <= Date.now());
      })
      .map(parseSupabaseEntry);
    const items = [...localItems, ...remoteItems].filter((item) =>
      !['page', 'content'].includes(item.kind) || visiblePages.has(item.pagePath),
    );
    res.json({ items, initialized });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/summary', requireAuthenticated, async (_req, res, next) => {
  try {
    const localCounts = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN kind = 'product' AND published = 1 AND COALESCE(json_extract(payload, '$.availableCountries'), '') != '' THEN 1 ELSE 0 END), 0) AS publishedProducts,
        COALESCE(SUM(CASE WHEN kind = 'update' AND published = 1 AND COALESCE(json_extract(payload, '$.sourceUrl'), '') != '' AND julianday(COALESCE(NULLIF(json_extract(payload, '$.scheduledAt'), ''), updated_at)) + 1 > julianday(?) THEN 1 ELSE 0 END), 0) AS publishedUpdates,
        COALESCE(SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END), 0) AS drafts
      FROM content
      WHERE ? = 0 OR kind NOT IN ('product', 'update')
    `).get(new Date().toISOString(), Number(supabaseEnabled));
    const remoteEntries = supabaseEnabled ? await listSupabaseContent() : [];
    const remoteCounts = remoteEntries.reduce((counts, row) => {
      if (row.kind === 'product' && row.published && row.payload.availableCountries) counts.publishedProducts += 1;
      if (row.kind === 'update' && row.published && row.expires_at && Date.parse(row.expires_at) > Date.now()) counts.publishedUpdates += 1;
      if (!row.published) counts.drafts += 1;
      return counts;
    }, { publishedProducts: 0, publishedUpdates: 0, drafts: 0 });
    const counts = {
      publishedProducts: localCounts.publishedProducts + remoteCounts.publishedProducts,
      publishedUpdates: localCounts.publishedUpdates + remoteCounts.publishedUpdates,
      drafts: localCounts.drafts + remoteCounts.drafts,
    };
    const visitorViews = db.prepare('SELECT COALESCE(SUM(views), 0) AS count FROM page_views WHERE day >= ?')
      .get(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).count;
    const recentActivity = db.prepare('SELECT action, content_id AS contentId, created_at AS createdAt FROM admin_audit ORDER BY created_at DESC LIMIT 8').all();
    res.set('Cache-Control', 'no-store');
    res.json({ ...counts, visitorViews, recentActivity });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/content', requireAuthenticated, async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const localEntries = findAllContent.all()
      .filter((row) => !supabaseEnabled || !['product', 'update'].includes(row.kind))
      .map(parseEntry);
    const remoteEntries = supabaseEnabled ? (await listSupabaseContent()).map(parseSupabaseEntry) : [];
    res.json([...localEntries, ...remoteEntries].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/content/seed', requireAuthenticated, requireContentEditor, requireCsrf, (req, res, next) => {
  const seedSchema = z.object({
    updates: z.array(contentSchema).max(100),
    products: z.array(contentSchema).max(100),
  }).strict();
  const body = seedSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'The initial content could not be validated.' });
  try {
    const seed = db.transaction(() => {
      if (db.prepare('SELECT COUNT(*) AS count FROM content').get().count !== 0) return;
      const insert = db.prepare('INSERT INTO content (id, kind, payload, published, updated_at) VALUES (?, ?, ?, ?, ?)');
      const now = new Date().toISOString();
      for (const item of [...body.data.updates, ...body.data.products]) {
        const { kind, published, ...payload } = item;
        insert.run(crypto.randomUUID(), kind, JSON.stringify(payload), Number(published), now);
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
    if (supabaseEnabled && (kind === 'product' || kind === 'update')) {
      const row = await saveSupabaseContent(id, { kind, payload, published });
      writeAudit(`created ${kind}`, id, req.adminUser.username);
      return res.status(201).json(parseSupabaseEntry(row));
    }
    const updatedAt = new Date().toISOString();
    db.prepare('INSERT INTO content (id, kind, payload, published, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, kind, JSON.stringify(payload), Number(published), updatedAt);
    writeAudit(`created ${kind}`, id, req.adminUser.username);
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
    const updatedAt = new Date().toISOString();
    const localEntry = findContentById.get(req.params.id);
    const remoteEntry = supabaseEnabled ? await findSupabaseContent(req.params.id) : null;
    if (!localEntry && !remoteEntry) return res.status(404).json({ error: 'This content entry no longer exists.' });

    if (supabaseEnabled && (kind === 'product' || kind === 'update')) {
      const row = await saveSupabaseContent(req.params.id, { kind, payload, published });
      if (localEntry) db.prepare('DELETE FROM content WHERE id = ?').run(req.params.id);
      writeAudit(`${published ? 'published' : 'saved'} ${kind}`, req.params.id, req.adminUser.username);
      return res.json(parseSupabaseEntry(row));
    }

    db.prepare(`
      INSERT INTO content (id, kind, payload, published, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload,
        published = excluded.published, updated_at = excluded.updated_at
    `).run(req.params.id, kind, JSON.stringify(payload), Number(published), updatedAt);
    if (remoteEntry) await deleteSupabaseContent(req.params.id);
    writeAudit(`${published ? 'published' : 'saved'} ${kind}`, req.params.id, req.adminUser.username);
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
    writeAudit('deleted content', req.params.id, req.adminUser.username);
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
    writeAudit('uploaded image', '', req.adminUser.username);
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
if (fs.existsSync(path.join(distDir, 'index.html'))) {
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

const server = app.listen(port, () => {
  if (supabaseEnabled) console.log(`Supabase content and image storage enabled (bucket: ${supabaseStorageBucket})`);
  else console.warn('Supabase is not configured; product/update content and media are using local SQLite/filesystem storage.');
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
