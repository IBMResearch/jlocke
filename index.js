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
const dbg = require('debug')('jlocke');
const lodash = require('lodash');
const isPromise = require('is-promise');

const defaults = require('./defaults');
const ensureIndex = require('./lib/ensureIndex');
const today = require('./lib/today');


const errInit = 'URI not found, call "init" before';
let indexReady = false;
let db;
// We can't do it for each day in run time due to performance reasons.
let indexRequests;
let indexErrors;
const typeRequests = 'request';
const typeErrors = 'error';
let app = 'app';


function sendToDb(index, type, body) {
  dbg('Inserting found request data in the DB', { index, type, body });
  // TODO: Add pipelining
  db.index({ index, type, body })
    .then(() => dbg('New request info correctly inserted'))
    .catch((err) => { throw Error(`Adding the requests info: ${err.message}`); });
}


module.exports.init = async (uri, opts = {}) => {
  if (!uri) { throw new Error(errInit); }

  dbg(`Connecting to DB: ${uri}`);

  const optsElastic = { host: uri };
  if (opts.trace) { optsElastic.log = 'trace'; }

  if (opts.app) {
    dbg(`"app" options passed: ${opts.app}`);

    if (typeof opts.app !== 'string') {
      throw new Error('Bad app name');
    }

    // eslint-disable-next-line prefer-destructuring
    app = opts.app;
  }

  try {
    db = new elastic.Client(optsElastic);
  } catch (err) {
    throw new Error(`Creating the Elastic client: ${err.message}`);
  }

  // Each new deploy indexes are created including the date in the name.
  // We can't do it for each day in run time due to performance reasons.
  const todayStr = today();
  indexRequests = `${opts.indexRequests || defaults.indexes.api.name}-${todayStr}`;
  indexErrors = `${opts.indexErrors || defaults.indexes.error.name}-${todayStr}`;

  dbg('Creating proper indexes', {
    indexRequests, indexErrors,
  });
  // We don't drop if it already exists, ie: same day deploy.
  try {
    await Promise.all([
      ensureIndex(db, indexRequests, typeRequests),
      ensureIndex(db, indexErrors, typeErrors),
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
    app,
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
module.exports.express = (opts = {}) => {
  dbg('Checking the passed options');

  let only;
  if (opts.only) {
    if (typeof opts.only !== 'string' && !lodash.isArray(opts.only)) {
      throw new Error('"only" should be string or array');
    }

    // Array or string supported.
    // eslint-disable-next-line prefer-destructuring
    only = opts.only;
    if (typeof only === 'string') { only = [only]; }
  }

  // To keep backward compatibility.
  // eslint-disable-next-line no-param-reassign
  if (!opts.hideBody && opts.hide) { opts.hideBody = opts.hide; }

  if (opts.hideBody) {
    if (typeof opts.hideBody !== 'object') {
      throw new Error('"hide" should be an object');
    }

    if (
      opts.hideBody.fun &&
      (typeof opts.hideBody.fun !== 'function' || isPromise(opts.hideBody.fun))
    ) {
      throw new Error('"hide" should be a function or a promise');
    }
  }

  // TODO: Add also checks for subfields.


  return (req, res, next) => {
    dbg('New request');


    next();


    if (!indexReady) {
      // eslint-disable-next-line no-console
      console.warn('Request not logged (index not created)', req);
      return;
    }

    // "originalUrl" is unique always present (vs "path" and "baseUrl").
    if (only) {
      const matchAny = !lodash.some(only, (itemOnly) => {
        if (only && req.originalUrl.indexOf(itemOnly) === -1) {
          return true;
        }

        return false;
      });

      // We don't want to debug the originalUrl because it includes the user token.
      dbg('Request checked (hidden path)', { path: req.path, baseUrl: req.baseUrl, matchAny });

      if (!matchAny) { return; }
    }

    const reqInfo = {
      app,
      path: req.path,
      method: req.method,
      protocol: req.protocol,
      originalUrl: req.originalUrl,
      timestamp: new Date(),
    };

    if (req.headers['user-agent']) { reqInfo.agent = req.headers['user-agent']; }

    // TODO: If not optional add at the object creation.
    if (req.headers.host) { reqInfo.host = req.headers.host; }

    if (opts.allHeaders) { reqInfo.headers = req.headers; }

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

    if (req.userId) {
      reqInfo.userId = req.userId;
      dbg(`UserId passed: ${req.userId}`);
    }


    // We need to wait for the route to finish to get the correct statusCode and duration.
    // https://nodejs.org/api/http.html#http_event_finish
    res.on('finish', () => {
      dbg('Request ended');

      const duration = res.getHeader('x-response-time');
      if (duration) { reqInfo.duration = duration; }

      reqInfo.responseCode = res.statusCode;

      // Adding the body.
      if (
        (!req.body || Object.keys(req.body).length < 1) || // with non empty body
        !opts.hideBody
      ) {
        dbg('No "hide" or no body, sending ...');
        sendToDb(indexRequests, typeRequests, reqInfo);
      } else {
        reqInfo.body = req.body;

        // Hiding the options (if "hideBody")
        // We use async stuff here so better inside this callback to
        // avoid a mess.
        // path    field     fun
        // No       No       Yes -> Hide full body for all paths if fun
        // Yes      No       No  -> Hide full body for this path
        // Yes      No       Yes -> Hide full body for this path if fun
        // No       Yes      No  -> Hide field for all paths
        // No       Yes      Yes -> Hide field for all paths if fun
        // Yes      Yes      No  -> Hide field for this path
        // Yes      Yes      Yes -> Hide field for this path if fun
        const hidePath = (opts.hideBody.path && reqInfo.path.indexOf(opts.hideBody.path) !== -1);

        if (opts.hideBody.fun) {
          let condPromise = opts.hideBody.fun(req);
          dbg('To hide (path):', { hidePath });

          if (!isPromise(condPromise)) { condPromise = Promise.resolve(condPromise); }

          condPromise
            .then((hideFun) => {
              dbg('To hide (fun):', { hideFun });

              if (hideFun) {
                dbg('Deleting body');
                // TODO: Try to avoid this delete to improve performance.
                delete reqInfo.body; // "Hide full body"
              }
              sendToDb(indexRequests, typeRequests, reqInfo);
            })
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.error('Running the "hide.fun" promise, not storing' +
                            'the data due to privacy reasons', err);
            });
        } else if (
          !opts.hideBody.field && // "hide.field" not present
          (!opts.hideBody.path || hidePath) // "path" is not blocking
        ) {
          dbg('Deleting body');

          // TODO: Try to avoid this delete to improve performance.
          delete reqInfo.body;
          sendToDb(indexRequests, typeRequests, reqInfo);
        } else {
          dbg('Checking if we need to delete any field');
          const hideField = (opts.hideBody.field && reqInfo.body[opts.hideBody.field]);

          // Dropping specific fields.
          if (
            hideField && // only if field name matches.
            (!opts.hideBody.path || hidePath)
          ) {
            dbg(`Dropping hidden field: ${opts.hideBody.field}`);

            delete reqInfo.body[opts.hideBody.field];
          }

          sendToDb(indexRequests, typeRequests, reqInfo);
        }
      }
    });
  };
};
