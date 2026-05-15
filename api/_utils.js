const path = require('path');

const OWNER_PIN = process.env.OWNER_PIN || 'sandria2026';
const MAX_UPLOAD = 8 * 1024 * 1024;

const corsHeaders = {
  'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const sendJson = (res, status, body) => {
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8', ...corsHeaders});
  res.end(JSON.stringify(body));
};

const handleOptions = (req, res) => {
  if (req.method !== 'OPTIONS') return false;
  res.writeHead(204, corsHeaders);
  res.end();
  return true;
};

const safeName = (name) => String(name || '').replace(/[^a-z0-9._-]/gi, '-').toLowerCase();

const collectBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;

  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_UPLOAD) {
      reject(new Error('Upload terlalu besar.'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const collectJson = async (req) => {
  const raw = await collectBody(req);
  if (!raw.length) return {};
  return JSON.parse(raw.toString('utf8'));
};

const parseMultipart = (buffer, contentType) => {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error('Boundary tidak ditemukan.');

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const fields = {};
  const files = [];
  let start = buffer.indexOf(boundary);

  while (start !== -1) {
    start += boundary.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;

    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) break;

    const rawHeaders = buffer.slice(start, headerEnd).toString('utf8');
    let partEnd = buffer.indexOf(boundary, headerEnd + 4);
    if (partEnd === -1) break;
    if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) partEnd -= 2;

    const body = buffer.slice(headerEnd + 4, partEnd);
    const name = rawHeaders.match(/name="([^"]+)"/i)?.[1];
    const filename = rawHeaders.match(/filename="([^"]*)"/i)?.[1];
    const type = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim();

    if (name && filename) {
      files.push({name, filename, type, body});
    } else if (name) {
      fields[name] = body.toString('utf8');
    }

    start = buffer.indexOf(boundary, partEnd + 2);
  }

  return {fields, files};
};

const blob = async () => import('@vercel/blob');

const newest = (items) => [...items].sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)))[0];

const listMedia = async () => {
  try {
    const {list} = await blob();
    const {blobs} = await list({limit: 1000});
    const byPrefix = (prefix) => blobs.filter((item) => item.pathname.startsWith(prefix));

    const projects = {};
    ['sketchrush', 'kampusgig', 'travelplanner'].forEach((project) => {
      const item = newest(byPrefix(`project-${project}-`));
      if (item) projects[project] = item.url;
    });

    const profile = newest(byPrefix('profile-'));
    const gallery = byPrefix('gallery-')
      .sort((a, b) => String(a.pathname).localeCompare(String(b.pathname)))
      .map((item) => item.url);

    return {
      profile: profile?.url || null,
      projects,
      gallery,
    };
  } catch (error) {
    return {profile: null, projects: {}, gallery: []};
  }
};

const deleteByPrefix = async (prefix) => {
  const {list, del} = await blob();
  const {blobs} = await list({prefix, limit: 1000});
  if (blobs.length) await del(blobs.map((item) => item.url));
};

const extFrom = (file) => {
  const ext = path.extname(file.filename);
  if (ext) return safeName(ext).replace(/^\.+/, '.');
  return `.${safeName(file.type?.split('/')[1] || 'jpg')}`;
};

module.exports = {
  OWNER_PIN,
  blob,
  collectBody,
  collectJson,
  corsHeaders,
  deleteByPrefix,
  extFrom,
  handleOptions,
  listMedia,
  parseMultipart,
  safeName,
  sendJson,
};
