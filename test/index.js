'use strict';

/* eslint-disable import/no-extraneous-dependencies */
const Promise = require('bluebird');
const request = require('request');
const test = require('tap').test;
const express = require('express');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
/* eslint-enable import/no-extraneous-dependencies */

const toDb = require('../');


const makeReq = Promise.promisify(request, { multiArgs: true });
const port = 8888;
const url = 'mongodb://localhost:27017/requests-monitor';
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

console.log(`Starting, connecting to the DB: ${url}`); // eslint-disable-line no-console
MongoClient.connect(url)
.then((db) => {
  console.log('Correctly connected to the DB'); // eslint-disable-line no-console

  // The middleware needs an alive DB connection.
  app.use(toDb(db));

  // Routes should be defined after the middlewares.
  app.get('/', (req, res) => { res.send('Hello World!'); });

  // So we need it ready before starting the app to avoid losing initial requests data.
  // eslint-disable-next-line no-console
  const server = app.listen(port, () => { console.log(`Example app listening on port: ${port}`); });

  test('with a valid server', (assert) => {
    assert.plan(10);

    makeReq(`http://127.0.0.1:${port}`)
    .then((httpRes) => {
      assert.equal(httpRes[1], 'Hello World!');

      db.collection('requests').find().toArray()
      .then((res) => {
        assert.equal(res.length, 1);
        assert.deepEqual(Object.keys(res[0]), [
          '_id', 'path', 'method', 'protocol', 'ip',
          'headers', 'originalUrl',
        ]);
        assert.equal(res[0].path, '/');
        assert.equal(res[0].method, 'GET');
        assert.equal(res[0].protocol, 'http');
        assert.equal(res[0].ip, '::ffff:127.0.0.1');
        assert.equal(res[0].headers.host, '127.0.0.1:8888');
        assert.equal(res[0].headers.connection, 'close');
        assert.equal(res[0].originalUrl, '/');

        // We need to close to allow the test keep passing.
        db.close();
        server.close();
      })
      .catch((err) => { assert.fail(`Getting the requests: ${err.message}`); });
    });
  });
})
.catch((err) => { throw Error(`Connecting to the DB: ${err.message}`); });
