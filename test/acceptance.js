/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';

const assert = require('assert');

/* eslint-disable import/no-extraneous-dependencies */
const express = require('express');
const bodyParser = require('body-parser');
const elastic = require('elasticsearch');
const makeReq = require('request-promise-native');
const sleep = require('system-sleep');
/* eslint-enable import/no-extraneous-dependencies */

const dbg = require('debug')('jlocke-express-middleware:test:acceptance');
const jLocke = require('../');
const today = require('../lib/today');
// const defaults = require('../defaults');

const port = 7777;
const url = 'localhost:9200';
// Random to avoid confusion running the tests locally.
const index = Math.random().toString(36).substr(2, 10);
const indexFull = `${index}-${today()}`;
const indexErrors = `${index}-error`;
const indexErrorsFull = `${indexErrors}-${today()}`;
const type = 'test';
const typeErrors = 'testErr';
const excludePath = 'login';
const excludeField = 'password';
const testUser = 'ola';
const testUserId = 'AAA';
let server;


dbg(`Starting, initing the DB connection: ${url}`);
const db = new elastic.Client({
  host: url,
  log: 'trace',
});


describe('Acceptance', () => {
  // TODO: Not working.
  // before(async () => {
  // beforeEach(async () => {
  before((done) => {
    jLocke.init(url, {
      indexRequests: index,
      typeRequests: type,
      indexErrors,
      typeErrors,
    })
      .then(() => {
        const app = express();
        app.use(bodyParser.json());

        // To save also the "userId" field.
        // Probably you need something in runtime here.
        app.use((req, res, next) => {
          req.userId = (() => testUserId)();
          next();
        });
        app.use(jLocke.express({ hide: { path: excludePath, field: excludeField } }));

        // NOTE: Routes needs to be defined after the middleware.
        app.get('/', (req, res) => res.send('Hello World!'));
        app.post('/login', (req, res) => res.send({ username: 'test', token: 'aaa' }));


        dbg('Starting the Express server ...');
        // TODO: Not working.
        // const listen = util.promisify(app.listen);
        // server = await listen(port);
        server = app.listen(port, () => {
          dbg(`Example app listening on port: ${port}`);

          // Lets give a time to end the index creation.
          sleep(10000);
          done();
        });
      });
  });


  it('express() should save all data when non hidden fields', async () => {
    dbg('Making the HTTP request ...');
    const httpRes = await makeReq(`http://127.0.0.1:${port}`);
    dbg('HTTP request done');
    assert.equal(httpRes, 'Hello World!');
    dbg('HTTP request confirmed ...');
    // The middleware write to the DB in async to avoid force the server
    // to wait for these operation to answer more HTTP requests. So we have to
    // wait a bit here to let it finish.
    sleep(10000);
    dbg('Checking the saved stuff ...');
    const body = await db.search({ index: indexFull, type });
    dbg('Response got:', body);
    // Only cheking some of them to KISS.
    assert.equal(body.timed_out, false);
    assert.equal(body.hits.total, 1);
    assert.equal(body.hits.max_score, 1);
    assert.equal(body.hits.hits.length, 1);
    /* eslint-disable no-underscore-dangle */
    assert.equal(body.hits.hits[0]._index, indexFull);
    assert.equal(body.hits.hits[0]._type, type);
    assert.equal(typeof body.hits.hits[0]._id, 'string');
    assert.equal(body.hits.hits[0]._id.length, 20);
    assert.equal(body.hits.hits[0]._score, 1);
    assert.equal(body.hits.hits[0]._source.path, '/');
    assert.equal(body.hits.hits[0]._source.method, 'GET');
    assert.equal(body.hits.hits[0]._source.protocol, 'http');
    assert.equal(body.hits.hits[0]._source.headers.host, '127.0.0.1:7777');
    assert.equal(body.hits.hits[0]._source.headers.connection, 'close');
    assert.equal(body.hits.hits[0]._source.originalUrl, '/');
    // Elastic returns it as an string.
    assert.equal(typeof body.hits.hits[0]._source.timestamp, 'string');
    assert.equal(body.hits.hits[0]._source.responseCode, 200);
    assert.equal(body.hits.hits[0]._source.userId, testUserId);
    /* eslint-enable no-underscore-dangle */
  });


  it('express() should hide desired fields', async () => {
    dbg('Making the HTTP request ...');
    const reqOpts = {
      uri: `http://127.0.0.1:${port}/login`,
      method: 'POST',
      body: { username: testUser, password: 'kase' },
      json: true,
    };

    await makeReq(reqOpts);
    dbg('HTTP request done');

    sleep(10000);
    dbg('Checking the saved stuff ...');
    const body = await db.search({ index: indexFull, type });
    dbg('Response got:', body);
    // Only cheking some of them to KISS.
    assert.equal(body.timed_out, false);
    assert.equal(body.hits.total, 2);
    assert.equal(body.hits.hits.length, 2);
    /* eslint-disable no-underscore-dangle */
    assert.equal(body.hits.hits[1]._source.path, '/login');
    assert.equal(body.hits.hits[1]._source.method, 'POST');
    assert.equal(body.hits.hits[1]._source.body[excludeField], undefined);
    assert.equal(body.hits.hits[1]._source.body.username, testUser);
    /* eslint-enable no-underscore-dangle */

    server.close();
    dbg('Express service stopped');
  });


  it('error() should save the error', async () => {
    dbg('Making the error request ...');
    const errMsgCustom = 'Test custom';
    const errMsg = 'Test error';
    const userId = 'testUserId';

    await jLocke.error(errMsgCustom, new Error(errMsg), { userId });

    dbg('Error request done');
    sleep(10000);
    dbg('Checking the error saved stuff ...');
    const result = await db.search({ index: indexErrorsFull, type: typeErrors });
    dbg('Response got:', result);

    // Only cheking some of them to KISS.
    assert.equal(result.timed_out, false);
    assert.equal(result.hits.total, 1);
    assert.equal(result.hits.max_score, 1);
    assert.equal(result.hits.hits.length, 1);
    /* eslint-disable no-underscore-dangle */
    assert.equal(result.hits.hits[0]._index, indexErrorsFull);
    assert.equal(result.hits.hits[0]._type, typeErrors);
    assert.equal(typeof result.hits.hits[0]._id, 'string');
    assert.equal(result.hits.hits[0]._id.length, 20);
    assert.equal(result.hits.hits[0]._score, 1);
    assert.equal(result.hits.hits[0]._source.message, errMsgCustom);
    assert.equal(result.hits.hits[0]._source.errorMessage, errMsg);
    assert.equal(typeof result.hits.hits[0]._source.errorStack, 'string');
    assert.equal(result.hits.hits[0]._source.userId, userId);
    // Elastic returns it as an string.
    assert.equal(typeof result.hits.hits[0]._source.timestamp, 'string');
    /* eslint-enable no-underscore-dangle */
  });
});
