const {OWNER_PIN, blob, handleOptions, listMedia, safeName, sendJson} = require('../_utils');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'DELETE') return sendJson(res, 405, {error: 'Method not allowed.'});

  const pin = req.query?.pin;
  const filename = safeName(req.query?.file || '');

  if (pin !== OWNER_PIN) return sendJson(res, 403, {error: 'PIN salah.'});
  if (!filename.startsWith('gallery-')) return sendJson(res, 400, {error: 'File tidak valid.'});

  try {
    const {list, del} = await blob();
    const {blobs} = await list({prefix: filename, limit: 1});
    if (blobs[0]) await del(blobs[0].url);
    sendJson(res, 200, {media: await listMedia()});
  } catch (error) {
    sendJson(res, 400, {error: 'Gagal menghapus foto.'});
  }
};
