const {OWNER_PIN, collectJson, handleOptions, sendJson} = require('./_utils');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, {error: 'Method not allowed.'});

  try {
    const body = await collectJson(req);
    sendJson(res, body.pin === OWNER_PIN ? 200 : 403, {ok: body.pin === OWNER_PIN});
  } catch (error) {
    sendJson(res, 400, {error: 'Request tidak valid.'});
  }
};
