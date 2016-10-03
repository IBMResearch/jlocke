'ue strict';

const dbg = require('debug')('express-middleware-todb');


module.exports = db =>
  (req, res, next) => {
    dbg('New request');
    // We don't want to wait until the DB write is done to keep answering to more HTTP requests.
    next();

    const meta = {
      path: req.path,
      method: req.method,
      protocol: req.protocol,
      ip: req.ip,
      headers: req.headers,
      originalUrl: req.originalUrl,
    };
    if (Object.keys(req.params).length > 0) {
      meta.params = req.param;
      dbg('Parameters found:', req.params);
    }
    if (Object.keys(req.body).length > 0) {
      meta.body = req.body;
      dbg('Body found:', req.body);
    }

    dbg('Inserting found request metadata in the DB', meta);

    db.collection('requests').insertOne(meta)
    .then(() => { dbg('New metadata correctly inserted'); })
    .catch((err) => { throw new Error(`Inserting metadata: ${err.message}`); });
  };
