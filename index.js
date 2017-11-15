/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';

const Promise = require('bluebird');
const elastic = require('elasticsearch');

const dbg = require('debug')('jlocke-express-middleware');

const ensureIndexes = require('./lib/ensureIndexes');


module.exports = (uri, opts = { dbOpts: {} }) => {
  const dbOpts = opts.dbOpts || {};
  const index = dbOpts.index || 'searchbyrequest';
  const type = dbOpts.type || 'requests';
  let dbReady = false;

  dbg(`Starting, connecting to the DB: ${uri}`);
  // TODO: Try catch? with proper error reporting?
  const db = new elastic.Client({
    host: uri,
    // log: 'trace',
  });

  // To be sure that the proper indexes exist.
  ensureIndexes(db, index, type)
  .then(() => {
    dbg('Indexes are correct');
    dbReady = true;
  })
  .catch((err) => { throw Error(`Checking the indexes: ${err.message}`); });

  return (req, res, next) => {
    dbg('New request');

    // We don't want to wait until the DB write is done to keep answering to more HTTP requests.
    next();

    // We don't use the Elastic if it's not up or with index errors.
    if (!dbReady) { return; }

    // Elastic only support v4 IP addresses, so we need to convert it.
    // https://www.elastic.co/guide/en/elasticsearch/reference/current/ip.html

    const meta = {
      path: req.path,
      method: req.method,
      protocol: req.protocol,
      headers: req.headers,
      originalUrl: req.originalUrl,
      timestamp: new Date(),
    };

    if (req.ip) {
      meta.ip = req.ip;
      dbg(`Converted IP: ${meta.ip}`);
    }

    if (req.params && Object.keys(req.params).length > 0) {
      meta.params = req.param;
      dbg('Parameters found:', req.params);
    }
    if (req.body && Object.keys(req.body).length > 0) {
      meta.body = req.body;
      dbg('Body found:', req.body);
    }

    // We need to wait for the route to finish to get the correct statusCode.
    res.on('finish', () => {
      dbg('Request ended');

      meta.responseCode = res.statusCode;

      // Adding geolocation info if the proper options is passed.
      // We only need to check for it if the user pass the option. (default: false).
      let getId = Promise.resolve();
      if (opts.idFun) {
        // TODO: Confirm that also works with LoopBack. ("res.app")
        getId = opts.idFun(req, res);
        dbg('The user passed a function to get the user ID ...');
      }

      getId
      .then((result) => {
        if (result) { meta.userId = result; }
        dbg('Inserting found request metadata in the DB', meta);

        if (meta.method === 'POST' &&
            opts.hide && opts.hide.path &&
           (meta.path.indexOf(opts.hide.path) !== -1) &&
           opts.hide.field && meta.body && meta.body[opts.hide.field]) {
          dbg(`Dropping hidded field: ${opts.hide.field}`);
          delete meta.body[opts.hide.field];
        }

        db.index({ index, type, body: meta })
        .then(() => dbg('New metadata correctly inserted'))
        .catch((err) => { throw Error(`Adding the requests metadata: ${err.message}`); });
      })
      .catch((err) => { throw Error(`Getting the user ID: ${err.message}`); });
    });
  };
};
