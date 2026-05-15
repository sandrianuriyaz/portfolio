const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const OWNER_PIN = process.env.OWNER_PIN || 'sandria2026';
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const MESSAGES_FILE = path.join(ROOT, 'messages.json');
const MAX_UPLOAD = 8 * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, {recursive: true});
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const sendJson = (res, status, body) => {
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
};

const safeName = (name) => name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
const publicPath = (file) => `/uploads/${file}`;

const listMedia = () => {
  const files = fs.readdirSync(UPLOAD_DIR);
  const firstMatch = (prefix) => files.find((file) => file.startsWith(prefix));

  const projects = {};
  ['sketchrush', 'kampusgig', 'travelplanner'].forEach((project) => {
    const file = firstMatch(`project-${project}.`);
    if (file) projects[project] = publicPath(file);
  });

  const profile = firstMatch('profile.');
  const gallery = files
    .filter((file) => file.startsWith('gallery-'))
    .sort()
    .map(publicPath);

  return {
    profile: profile ? publicPath(profile) : null,
    projects,
    gallery,
  };
};

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

const handleUpload = async (req, res) => {
  try {
    const body = await collectBody(req);
    const {fields, files} = parseMultipart(body, req.headers['content-type'] || '');
    const file = files[0];

    if (fields.pin !== OWNER_PIN) return sendJson(res, 403, {error: 'PIN salah.'});
    if (!file || !file.type?.startsWith('image/')) return sendJson(res, 400, {error: 'File harus gambar.'});

    const ext = path.extname(file.filename) || `.${file.type.split('/')[1] || 'jpg'}`;
    const cleanExt = safeName(ext).replace(/^\.+/, '.');
    let filename;

    if (fields.type === 'profile') {
      fs.readdirSync(UPLOAD_DIR).filter((item) => item.startsWith('profile.')).forEach((item) => fs.unlinkSync(path.join(UPLOAD_DIR, item)));
      filename = `profile${cleanExt}`;
    } else if (fields.type === 'project') {
      const project = safeName(fields.project || '');
      if (!['sketchrush', 'kampusgig', 'travelplanner'].includes(project)) return sendJson(res, 400, {error: 'Project tidak valid.'});
      fs.readdirSync(UPLOAD_DIR).filter((item) => item.startsWith(`project-${project}.`)).forEach((item) => fs.unlinkSync(path.join(UPLOAD_DIR, item)));
      filename = `project-${project}${cleanExt}`;
    } else if (fields.type === 'gallery') {
      filename = `gallery-${Date.now()}-${safeName(file.filename)}`;
    } else {
      return sendJson(res, 400, {error: 'Tipe upload tidak valid.'});
    }

    fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.body);
    sendJson(res, 200, {url: publicPath(filename), media: listMedia()});
  } catch (error) {
    sendJson(res, 400, {error: error.message});
  }
};

const handleVerify = async (req, res) => {
  try {
    const body = await collectJson(req);
    sendJson(res, body.pin === OWNER_PIN ? 200 : 403, {ok: body.pin === OWNER_PIN});
  } catch (error) {
    sendJson(res, 400, {error: 'Request tidak valid.'});
  }
};

const handleMessage = async (req, res) => {
  try {
    const body = await collectJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();

    if (!name || !email || !message) return sendJson(res, 400, {error: 'Semua field wajib diisi.'});
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, {error: 'Email tidak valid.'});
    if (message.length > 3000) return sendJson(res, 400, {error: 'Pesan terlalu panjang.'});

    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]');
    messages.push({
      id: Date.now().toString(36),
      name,
      email,
      message,
      createdAt: new Date().toISOString(),
    });
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    sendJson(res, 200, {ok: true});
  } catch (error) {
    sendJson(res, 400, {error: 'Pesan tidak valid.'});
  }
};

const handleDeleteGallery = (req, res, pathname) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.searchParams.get('pin') !== OWNER_PIN) return sendJson(res, 403, {error: 'PIN salah.'});

  const filename = safeName(decodeURIComponent(pathname.replace('/api/gallery/', '')));
  if (!filename.startsWith('gallery-')) return sendJson(res, 400, {error: 'File tidak valid.'});

  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  sendJson(res, 200, {media: listMedia()});
};

const serveFile = (res, filePath) => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {'content-type': mimeTypes[ext] || 'application/octet-stream'});
  fs.createReadStream(filePath).pipe(res);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && pathname === '/api/media') return sendJson(res, 200, listMedia());
  if (req.method === 'POST' && pathname === '/api/verify') return handleVerify(req, res);
  if (req.method === 'POST' && pathname === '/api/message') return handleMessage(req, res);
  if (req.method === 'POST' && pathname === '/api/upload') return handleUpload(req, res);
  if (req.method === 'DELETE' && pathname.startsWith('/api/gallery/')) return handleDeleteGallery(req, res, pathname);

  if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(UPLOAD_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    return serveFile(res, filePath);
  }

  if (req.method === 'GET') {
    const filePath = pathname === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, pathname);
    return serveFile(res, filePath);
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Portfolio server running at http://localhost:${PORT}`);
});
