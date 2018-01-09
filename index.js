/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';

const isV6 = require('net').isIPv6;

const elastic = require('elasticsearch');
const ipaddr = require('ipaddr.js');
const dbg = require('debug')('jlocke-express-middleware');

const defaults = require('./defaults');
const ensureIndex = require('./lib/ensureIndex');
const today = require('./lib/today');


const errInit = 'URI not found, call "init" before';
let indexReady = false;
let db;
// We can't do it for each day in run time due to performance reasons.
let indexRequests;
let typeRequests;
let indexErrors;
let typeErrors;


module.exports.init = async (uri, opts = {}) => {
  if (!uri) { throw new Error(errInit); }

  dbg(`Connecting to DB: ${uri}`);

  try {
    db = new elastic.Client({
      host: uri,
      log: 'trace',
    });
  } catch (err) {
    throw new Error(`Creating the Elastic client: ${err.message}`);
  }

  // Each new deploy indexes are created including the date in the name.
  // We can't do it for each day in run time due to performance reasons.
  indexRequests = `${opts.indexRequests || defaults.indexes.api.name}-${today()}`;
  typeRequests = opts.typeRequests || defaults.indexes.api.type;
  indexErrors = `${opts.indexErrors || defaults.indexes.error.name}-${today()}`;
  typeErrors = opts.typeErrors || defaults.indexes.error.type;

  dbg('Creating proper indexes', {
    indexRequests, typeRequests, indexErrors, typeErrors,
  });
  // We don't drop if it already exists, ie: same day deploy.
  try {
    await Promise.all([
      ensureIndex(db, indexRequests, typeRequests, 'request'),
      // ensureIndex(db, indexErrors, typeErrors, 'error'),
    ]);
  } catch (err) {
    throw Error(`Creating the indexes: ${err.message}`);
  }

  dbg('Indexes created');
  indexReady = true;
};


module.exports.error = async (message, error, opts = {}) => {
  if (!message) { throw new Error('A custom message is mandatory'); }
  if (!error) { throw new Error('An error is mandatory'); }

  dbg('New error', { message, opts });

  // We don't use the Elastic until the index is created.
  // TODO: Some packets could be lost during each deploy -> use a queue.
  if (!indexReady) {
    // eslint-disable-next-line no-console
    console.warn('Error not logged (index not created)', error);
    return;
  }

  const errorInfo = {
    message,
    timestamp: new Date(),
    errorMessage: error.message,
    errorStack: error.stack,
  };

  if (opts.userId) {
    errorInfo.userId = opts.userId;
    dbg(`UserId passed: ${opts.userId}`);
  }

  await db.index({ index: indexErrors, type: typeErrors, body: errorInfo });
};


// eslint-disable-next-line arrow-body-style
module.exports.express = (opts = {}) =>
  (req, res, next) => {
    dbg('New request');

    // We don't want to wait until the DB write is done to keep answering to more HTTP requests.
    next();

    if (!indexReady) {
      // eslint-disable-next-line no-console
      console.warn('Request not logged (index not created)', req);
      return;
    }

    const reqInfo = {
      path: req.path,
      method: req.method,
      protocol: req.protocol,
      headers: req.headers,
      originalUrl: req.originalUrl,
      timestamp: new Date(),
    };

    if (req.ip) {
      // TODO: Elastic only support v4 IP addresses, so we need to convert it.
      // https://www.elastic.co/guide/en/elasticsearch/reference/current/ip.html
      let goodIp = req.ip;
      if (isV6(goodIp)) {
        dbg('Detected v6 IP address, converting it to v4 ...');
        const address = ipaddr.parse(goodIp);
        goodIp = address.toIPv4Address().toString();
      }

      reqInfo.ip = goodIp;
      dbg(`IP addr: ${reqInfo.ip}`);
    }

    if (req.params && Object.keys(req.params).length > 0) {
      reqInfo.params = req.param;
      dbg('Parameters found:', req.params);
    }
    if (req.body && Object.keys(req.body).length > 0) {
      reqInfo.body = req.body;
      dbg('Body found:', req.body);
    }

    if (req.userId) {
      reqInfo.userId = req.userId;
      dbg(`UserId passed: ${req.userId}`);
    }

    // We need to wait for the route to finish to get the correct statusCode.
    res.on('finish', () => {
      dbg('Request ended');

      reqInfo.responseCode = res.statusCode;

      // Hiding the options (if any)
      if (reqInfo.method === 'POST' &&
          opts.hide && opts.hide.path &&
        (reqInfo.path.indexOf(opts.hide.path) !== -1) &&
        opts.hide.field && reqInfo.body && reqInfo.body[opts.hide.field]) {
        dbg(`Dropping hidded field: ${opts.hide.field}`);
        delete reqInfo.body[opts.hide.field];
      }

      dbg('Inserting found request data in the DB', { reqInfo, indexRequests, typeRequests });
      // TODO: Add pipelining
      db.index({ index: indexRequests, type: typeRequests, body: reqInfo })
        .then(() => dbg('New request info correctly inserted'))
        .catch((err) => { throw Error(`Adding the requests info: ${err.message}`); });
    });
  };
