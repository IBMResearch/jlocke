/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';

const isV6 = require('net').isIPv6;

const ipaddr = require('ipaddr.js');
const Promise = require('bluebird');
const dbg = require('debug')('jlocke-express-middleware');

const getLocation = require('tiny-promisify')(require('iplocation'));

const ensureIndexes = require('./lib/ensureIndexes');


module.exports = (db, opts = { dbOpts: {} }) => {
  const dbOpts = opts.dbOpts || {};
  const dbType = dbOpts.type || 'elastic';
  // Specific for MongoDB
  const mongoCol = dbOpts.colName || 'requests';
  // Elastic
  const elasIndex = dbOpts.indexName || 'searchbyrequest';
  const elasType = dbOpts.elasType || 'requests';

  // To be sure that the proper indexes exist.
  ensureIndexes(db, {
    // The default is mongo
    type: dbType,
    mongo: { col: mongoCol },
    elastic: { index: elasIndex, type: elasType },
  })
  .then(() => dbg('Indexes are correct'))
  .catch((err) => { throw Error(`Doing the index stuff: ${err.message}`); });

  return (req, res, next) => {
    dbg('New request');

    // We don't want to wait until the DB write is done to keep answering to more HTTP requests.
    next();

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
      let goodIp = req.ip;

      if (isV6(goodIp)) {
        dbg('Detected v6 IP address, converting it to v4 ...');
        const address = ipaddr.parse(goodIp);
        goodIp = address.toIPv4Address().toString();
      }

      meta.ip = goodIp;
      dbg(`Converted IP: ${goodIp}`);
    }

    if (Object.keys(req.params).length > 0) {
      meta.params = req.param;
      dbg('Parameters found:', req.params);
    }
    if (Object.keys(req.body).length > 0) {
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
      if (opts.idFunc) {
        // TODO: Confirm that also works with LoopBack. ("res.app")
        getId = opts.idFunc(req, res);
        dbg('The user passed a function to get the user ID ...');
      }

      // We only need to check for it if the user pass the option. (default: false).
      let getLoc = Promise.resolve();
      // Adding geolocation info if the proper options is passed.
      if (opts.geo && req.ip) {
        getLoc = getLocation(req.ip);
        dbg('The user asked for the location ...');
      }

      Promise.join(getId, getLoc)
      .then((result) => {
        if (result[0]) { meta.userId = result[0]; }
        if (result[1]) { meta.geo = result[1]; }
        dbg('Inserting found request metadata in the DB', meta);

        if (meta.method === 'POST' &&
            opts.hide && opts.hide.path &&
           (meta.path.indexOf(opts.hide.path) !== -1) &&
           opts.hide.field && meta.body && meta.body[opts.hide.field]) {
          dbg(`Dropping hidded field: ${opts.hide.field}`);
          delete meta.body[opts.hide.field];
        }

        let op;
        if (dbType === 'mongo') {
          // Formating geo data for MongoDB.
          // https://docs.mongodb.com/manual/core/2dsphere/
          if (meta.geo &&
            (meta.geo.longitude || meta.geo.longitude === 0) &&
            (meta.geo.latitude || meta.geo.latitude === 0)) {
            meta.location = { type: 'Point', coordinates: [meta.geo.longitude, meta.geo.latitude] };
          }
          op = db.collection(mongoCol).insertOne(meta);
        } else {
          // Formating geo data for Elastic. The field name "location" is mandatory:
          // https://www.elastic.co/guide/en/elasticsearch/guide/current/lat-lon-formats.html

          if (meta.geo &&
            // "longitude" and "latitude" can be 0.
            (meta.geo.longitude || meta.geo.longitude === 0) &&
            (meta.geo.latitude || meta.geo.latitude === 0)) {
            meta.location = { lon: meta.geo.longitude, lat: meta.geo.latitude };
          }

          op = db.index({
            index: elasIndex,
            type: elasType,
            body: meta,
          });
        }

        op
        .then(() => dbg('New metadata correctly inserted'))
        .catch((err) => { throw Error(`Adding the requests metadata: ${err.message}`); });
      })
      .catch((err) => { throw Error(`Getting the user ID or IP geolocation: ${err.message}`); });
    });
  };
};
