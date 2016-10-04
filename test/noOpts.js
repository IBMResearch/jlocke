'use strict';

/* eslint-disable import/no-extraneous-dependencies */
const test = require('tap').test;
const express = require('express');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const makeReq = require('tiny-promisify')(require('request'), { multiArgs: true });
/* eslint-enable import/no-extraneous-dependencies */

const toDb = require('../');

const port = 8888;
const url = 'mongodb://localhost:27017/requests-monitor';
const col = 'requests';


console.log(`Starting, connecting to the DB: ${url}`); // eslint-disable-line no-console
MongoClient.connect(url)
.then((db) => {
  console.log('Correctly connected to the DB'); // eslint-disable-line no-console

  test('with no options', (assert) => {
    assert.plan(10);

    const app = express();
    app.use(bodyParser.json());
    // The middleware needs an alive DB connection.
    app.use(toDb(db));

    // Routes should be defined after the middlewares.
    app.get('/', (req, res) => { res.send('Hello World!'); });

    // So we need it ready before starting the app to avoid losing initial requests data.
    const server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Example app listening on port: ${port}`);

      // When we run the tests locally we may have older ones.
      db.collection(col).removeMany()
      .then(() => {
        makeReq(`http://127.0.0.1:${port}`)
        .then((httpRes) => {
          assert.equal(httpRes[1], 'Hello World!');

          // The middleware write to the DB in async to avoid force the server
          // to wait for these operation to answer more HTTP requests. So we have to
          // wait a bit here to let it finish.
          setTimeout(() => {
            db.collection(col).find().toArray()
            .then((res) => {
              assert.equal(res.length, 1);
              assert.deepEqual(Object.keys(res[0]), [
                '_id', 'path', 'method', 'protocol',
                'ip', 'headers', 'originalUrl',
              ]);
              assert.equal(res[0].path, '/');
              assert.equal(res[0].method, 'GET');
              assert.equal(res[0].protocol, 'http');
              assert.equal(res[0].ip, '::ffff:127.0.0.1');
              assert.equal(res[0].headers.host, '127.0.0.1:8888');
              assert.equal(res[0].headers.connection, 'close');
              assert.equal(res[0].originalUrl, '/');

              // We need to close to allow the test keep passing.
              db.close()
              .then(() => server.close())
              .catch(err => assert.fail(`Closing the DB: ${err.message}`));
            })
            .catch(err => assert.fail(`Getting the requests: ${err.message}`));
          }, 3000);
        })
        .catch(err => assert.fail(`Making the request: ${err.message}`));
      })
      .catch(err => assert.fail(`Dropping the old requests: ${err.message}`));
    });
  });
})
.catch((err) => { throw Error(`Connecting to the DB: ${err.message}`); });
