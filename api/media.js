const {handleOptions, listMedia, sendJson} = require('./_utils');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return sendJson(res, 405, {error: 'Method not allowed.'});

  sendJson(res, 200, await listMedia());
};
