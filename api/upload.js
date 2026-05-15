const {
  OWNER_PIN,
  blob,
  collectBody,
  deleteByPrefix,
  extFrom,
  handleOptions,
  listMedia,
  parseMultipart,
  safeName,
  sendJson,
} = require('./_utils');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, {error: 'Method not allowed.'});

  try {
    const body = await collectBody(req);
    const {fields, files} = parseMultipart(body, req.headers['content-type'] || '');
    const file = files[0];

    if (fields.pin !== OWNER_PIN) return sendJson(res, 403, {error: 'PIN salah.'});
    if (!file || !file.type?.startsWith('image/')) return sendJson(res, 400, {error: 'File harus gambar.'});

    const {put} = await blob();
    const ext = extFrom(file);
    let filename;

    if (fields.type === 'profile') {
      await deleteByPrefix('profile-');
      filename = `profile-${Date.now()}${ext}`;
    } else if (fields.type === 'project') {
      const project = safeName(fields.project || '');
      if (!['sketchrush', 'kampusgig', 'travelplanner'].includes(project)) return sendJson(res, 400, {error: 'Project tidak valid.'});
      await deleteByPrefix(`project-${project}-`);
      filename = `project-${project}-${Date.now()}${ext}`;
    } else if (fields.type === 'gallery') {
      filename = `gallery-${Date.now()}-${safeName(file.filename)}`;
    } else {
      return sendJson(res, 400, {error: 'Tipe upload tidak valid.'});
    }

    const uploaded = await put(filename, file.body, {access: 'public', contentType: file.type});
    sendJson(res, 200, {url: uploaded.url, media: await listMedia()});
  } catch (error) {
    sendJson(res, 400, {error: error.message});
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
