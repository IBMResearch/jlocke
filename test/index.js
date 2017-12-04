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

const dbg = require('debug')('jlocke-express-middleware:test:elastic');
const toDb = require('../');
const defaults = require('../defaults');

const port = 7777;
const url = 'localhost:9200';
// Random to avoid the deletion when running the tests locally.
// const index = Math.random().toString(36).substr(2, 10);
const index = defaults.index.name;
const { type } = defaults.index;
const excludePath = 'login';
const excludeField = 'password';
const testUser = 'ola';
let server;


dbg(`Starting, connecting to the DB: ${url}`);
const db = new elastic.Client({
  host: url,
  // log: 'trace',
});


describe('With custom options', () => {
  // TODO: Not working.
  // beforeEach(async () => {
  before((done) => {
    const app = express();
    app.use(bodyParser.json());
    // The middleware needs an alive DB connection.
    app.use(toDb(url, {
      dbOpts: { index, type },
      hide: { path: excludePath, field: excludeField },
    }));
    // Routes should be defined after the middlewares.
    app.get('/', (req, res) => res.send('Hello World!'));
    app.post('/login', (req, res) => res.send({ username: 'test', token: 'aaa' }));
    // We need it ready before starting the app to avoid losing initial requests data.
    dbg('Starting the Express server ...');
    // const listen = util.promisify(app.listen);
    // server = await listen(port);
    server = app.listen(port, () => {
      dbg(`Example app listening on port: ${port}`);
      done();
    });
  });


  it('should save all data for non hidden fields', async () => {
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
    const body = await db.search({ index, type });
    dbg('Response got:', body);
    assert.deepEqual(Object.keys(body), ['took', 'timed_out', '_shards', 'hits']);
    // Only cheking some of them to KISS.
    assert.equal(body.timed_out, false);
    assert.equal(body.hits.total, 1);
    assert.equal(body.hits.max_score, 1);
    assert.equal(body.hits.hits.length, 1);
    /* eslint-disable no-underscore-dangle */
    assert.equal(body.hits.hits[0]._index, index);
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
    /* eslint-enable no-underscore-dangle */
  });


  it('should hide desired fields', async () => {
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
    const body = await db.search({ index, type });
    dbg('Response got:', body);
    assert.deepEqual(Object.keys(body), ['took', 'timed_out', '_shards', 'hits']);
    // Only cheking some of them to KISS.
    assert.equal(body.timed_out, false);
    assert.equal(body.hits.total, 2);
    assert.equal(body.hits.hits.length, 2);
    /* eslint-disable no-underscore-dangle */
    assert.equal(body.hits.hits[0]._source.path, '/login');
    assert.equal(body.hits.hits[0]._source.method, 'POST');
    assert.equal(body.hits.hits[0]._source.body[excludeField], undefined);
    assert.equal(body.hits.hits[0]._source.body.username, testUser);
    /* eslint-enable no-underscore-dangle */
    server.close();
  });
});
