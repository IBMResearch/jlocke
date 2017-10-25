/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';

const Promise = require('bluebird');
/* eslint-disable import/no-extraneous-dependencies */
const test = require('tap').test;
const express = require('express');
const bodyParser = require('body-parser');
const elastic = require('elasticsearch');
const makeReq = require('tiny-promisify')(require('request'), { multiArgs: true });
/* eslint-enable import/no-extraneous-dependencies */
const dbg = require('debug')('jlocke-express-middleware:test:elastic');

const toDb = require('../');

const port = 7777;
const url = 'localhost:9200';
const index = 'test1';
const type = 'requests3';


dbg(`Starting, connecting to the DB: ${url}`);
const db = new elastic.Client({
  host: url,
  // log: 'trace',
});


test('with DB options', (assert) => {
  assert.plan(20);

  // To drop the old ones (from old test runs).
  dbg('Checking if the indexes exist ...');
  db.indices.exists({ index })
  .then((exists) => {
    let deleteIndex = Promise.resolve();
    if (exists) { deleteIndex = db.indices.delete({ index }); }

    deleteIndex
    .then(() => {
      const app = express();
      app.use(bodyParser.json());

      // The middleware needs an alive DB connection.
      app.use(toDb(url, { dbOpts: { index, type } }));

      // Routes should be defined after the middlewares.
      app.get('/', (req, res) => res.send('Hello World!'));

      // So we need it ready before starting the app to avoid losing initial requests data.
      const server = app.listen(port, () => {
        dbg(`Example app listening on port: ${port}`);

        makeReq(`http://127.0.0.1:${port}`)
        .then((httpRes) => {
          assert.equal(httpRes[1], 'Hello World!');

          // The middleware write to the DB in async to avoid force the server
          // to wait for these operation to answer more HTTP requests. So we have to
          // wait a bit here to let it finish.
          setTimeout(() => {
            db.search({ index, type })
            .then(
              (body) => {
                assert.deepEqual(Object.keys(body), ['took', 'timed_out', '_shards', 'hits']);
                // Only cheking some of them to KISS.
                assert.equal(body.timed_out, false);
                assert.equal(body.hits.total, 1);
                assert.equal(body.hits.max_score, 1);
                assert.equal(body.hits.hits.length, 1);
                /* eslint-disable no-underscore-dangle */
                assert.equal(body.hits.hits[0]._index, index);
                assert.equal(body.hits.hits[0]._type, type);
                assert.type(body.hits.hits[0]._id, 'string');
                assert.equal(body.hits.hits[0]._id.length, 20);
                assert.equal(body.hits.hits[0]._score, 1);
                assert.equal(body.hits.hits[0]._source.path, '/');
                assert.equal(body.hits.hits[0]._source.method, 'GET');
                assert.equal(body.hits.hits[0]._source.protocol, 'http');
                assert.equal(body.hits.hits[0]._source.ip, '127.0.0.1');
                assert.equal(body.hits.hits[0]._source.headers.host, '127.0.0.1:7777');
                assert.equal(body.hits.hits[0]._source.headers.connection, 'close');
                assert.equal(body.hits.hits[0]._source.originalUrl, '/');
                // Elastic returns it as an string.
                assert.type(body.hits.hits[0]._source.timestamp, 'string');
                assert.equal(body.hits.hits[0]._source.responseCode, 200);
                /* eslint-enable no-underscore-dangle */

                // We need to close to allow the test keep passing.
                server.close();
              },
              err => assert.fail(`Getting the requests: ${err.message}`)
            );
          }, 3000);
        })
        .catch(err => assert.fail(`Making the request: ${err.message}`));
      });
    })
    .catch(err => assert.fail(`Dropping the old requests: ${err.message}`));
  })
  .catch(err => assert.fail(`Checking the actual indexes: ${err.message}`));
});
