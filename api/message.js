const {blob, collectJson, handleOptions, safeName, sendJson} = require('./_utils');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, {error: 'Method not allowed.'});

  try {
    const body = await collectJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();

    if (!name || !email || !message) return sendJson(res, 400, {error: 'Semua field wajib diisi.'});
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, {error: 'Email tidak valid.'});
    if (message.length > 3000) return sendJson(res, 400, {error: 'Pesan terlalu panjang.'});

    const {put} = await blob();
    await put(
      `messages-${Date.now()}-${safeName(name)}.json`,
      JSON.stringify({name, email, message, createdAt: new Date().toISOString()}, null, 2),
      {access: 'public', contentType: 'application/json'}
    );

    sendJson(res, 200, {ok: true});
  } catch (error) {
    sendJson(res, 400, {error: 'Pesan tidak valid.'});
  }
};
