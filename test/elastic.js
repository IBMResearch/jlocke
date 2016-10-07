/*
  MIT License

  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
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
const dbg = require('debug')('express-middleware-todb:test:elastic');

const toDb = require('../');

const port = 7777;
const url = 'localhost:9200';
const indexName = 'test1';
const elasType = 'requests3';


dbg(`Starting, connecting to the DB: ${url}`);
const db = new elastic.Client({
  host: url,
  // log: 'trace',
});


test('with DB options (Elastic)', (assert) => {
  assert.plan(24);

  const app = express();
  app.use(bodyParser.json());

  // The middleware needs an alive DB connection.
  app.use(toDb(db, { geo: true, dbOpts: { type: 'elastic', indexName, elasType } }));

  // Routes should be defined after the middlewares.
  app.get('/', (req, res) => res.send('Hello World!'));

  // So we need it ready before starting the app to avoid losing initial requests data.
  const server = app.listen(port, () => {
    dbg(`Example app listening on port: ${port}`);

    db.indices.exists({ index: indexName })
    .then((exists) => {
      let deleteIndex = Promise.resolve();
      // if (exists) { deleteIndex = deleteByQueryP({ index: indexName, type: elasType }); }
      if (exists) { deleteIndex = db.indices.delete({ index: indexName }); }

      // To drop the old ones (from old test runs).
      deleteIndex
      .then(() => {
        makeReq(`http://127.0.0.1:${port}`)
        .then((httpRes) => {
          assert.equal(httpRes[1], 'Hello World!');

          // The middleware write to the DB in async to avoid force the server
          // to wait for these operation to answer more HTTP requests. So we have to
          // wait a bit here to let it finish.
          setTimeout(() => {
            db.search({
              index: indexName,
              type: elasType,
            })
            .then(
              (body) => {
                assert.deepEqual(Object.keys(body), ['took', 'timed_out', '_shards', 'hits']);
                // Only cheking some of them to KISS.
                assert.equal(body.timed_out, false);
                assert.equal(body.hits.total, 1);
                assert.equal(body.hits.max_score, 1);
                assert.equal(body.hits.hits.length, 1);
                /* eslint-disable no-underscore-dangle */
                assert.equal(body.hits.hits[0]._index, indexName);
                assert.equal(body.hits.hits[0]._type, elasType);
                assert.type(body.hits.hits[0]._id, 'string');
                assert.equal(body.hits.hits[0]._id.length, 20);
                assert.equal(body.hits.hits[0]._score, 1);
                assert.equal(body.hits.hits[0]._source.path, '/');
                assert.equal(body.hits.hits[0]._source.method, 'GET');
                assert.equal(body.hits.hits[0]._source.protocol, 'http');
                assert.equal(body.hits.hits[0]._source.ip, '::ffff:127.0.0.1');
                assert.equal(body.hits.hits[0]._source.headers.host, '127.0.0.1:7777');
                assert.equal(body.hits.hits[0]._source.headers.connection, 'close');
                assert.equal(body.hits.hits[0]._source.originalUrl, '/');
                // Elastic returns it as an string.
                assert.type(body.hits.hits[0]._source.timestamp, 'string');
                assert.equal(body.hits.hits[0]._source.responseCode, 200);
                assert.equal(body.hits.hits[0]._source.geo.ip, '127.0.0.1');
                assert.deepEqual(Object.keys(body.hits.hits[0]._source.geo), [
                  'ip', 'country_code', 'country_name', 'region_code',
                  'region_name', 'city', 'zip_code', 'time_zone',
                  'latitude', 'longitude', 'metro_code',
                ]);
                assert.deepEqual(body.hits.hits[0]._source.location.lon, 0);
                assert.deepEqual(body.hits.hits[0]._source.location.lat, 0);

                /* eslint-enable no-underscore-dangle */

                // We need to close to allow the test keep passing.
                server.close();
              },
              err => assert.fail(`Getting the requests: ${err.message}`)
            );
          }, 3000);
        })
        .catch(err => assert.fail(`Making the request: ${err.message}`));
      })
      .catch(err => assert.fail(`Checking the actual indexes: ${err.message}`));
    })
    .catch(err => assert.fail(`Dropping the old requests: ${err.message}`));
  });
});
