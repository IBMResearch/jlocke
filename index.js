'use strict';

const dbg = require('debug')('express-middleware-todb');

const getLocation = require('tiny-promisify')(require('iplocation'));


module.exports = (db, opts = {}) =>
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
    
    const outCol = opts.col || 'requests'
    // We only need to check for it if the user pass the option. (default: false).
    let getLoc = () => Promise.resolve();

    // if (opts.geo && req.ip) {
    if (opts.geo && req.ip) {
      getLoc = getLocation;
      dbg('The user asked for the location ...');
    }

    getLoc(req.ip)
    .then((geoInfo) => {
      if (geoInfo) { meta.geo = geoInfo; }

      dbg('Inserting found request metadata in the DB', meta);

      // TODO: Make this connection an op
      db.collection(outCol).insertOne(meta)
      .then(() => dbg('New metadata correctly inserted'));
    });
  };
