'use strict';

/* eslint-disable import/no-extraneous-dependencies */
const test = require('tap').test;
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const makeReq = require('tiny-promisify')(require('request'), { multiArgs: true });
/* eslint-enable import/no-extraneous-dependencies */
const dbg = require('debug')('express-middleware-todb:test:mongo');

const toDb = require('../');

const port = 9999;
const url = 'mongodb://localhost:27017/requests-monitor';
const colName = 'requests2';

const idFunc = req => Promise.resolve(req.session.id);


dbg(`Starting, connecting to the DB: ${url}`);
MongoClient.connect(url)
.then((db) => {
  dbg('Correctly connected to the DB');

  test('with options (MongoDB)', (assert) => {
    assert.plan(14);

    const app = express();
    app.use(bodyParser.json());

    app.use(session({
      secret: 'keyboard cat',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: true },
    }));

    // The middleware needs an alive DB connection.
    app.use(toDb(db, { geo: true, idFunc, dbOpts: { colName } }));

    // Routes should be defined after the middlewares.
    app.get('/', (req, res) => res.send('Hello World!'));

    // So we need it ready before starting the app to avoid losing initial requests data.
    const server = app.listen(port, () => {
      dbg(`Example app listening on port: ${port}`);

      // When we run the tests locally we may have older ones.
      db.collection(colName).removeMany()
      .then(() => {
        makeReq(`http://127.0.0.1:${port}`)
        .then((httpRes) => {
          assert.equal(httpRes[1], 'Hello World!');

          // The middleware write to the DB in async to avoid force the server
          // to wait for these operation to answer more HTTP requests. So we have to
          // wait a bit here to let it finish.
          setTimeout(() => {
            db.collection(colName).find().toArray()
            .then((res) => {
              assert.equal(res.length, 1);
              assert.equal(res[0].path, '/');
              assert.equal(res[0].method, 'GET');
              assert.equal(res[0].protocol, 'http');
              assert.equal(res[0].ip, '::ffff:127.0.0.1');
              assert.equal(res[0].headers.host, '127.0.0.1:9999');
              assert.equal(res[0].headers.connection, 'close');
              assert.equal(res[0].originalUrl, '/');
              assert.equal(res[0].responseCode, 200);
              assert.equal(res[0].geo.ip, '127.0.0.1');
              assert.deepEqual(Object.keys(res[0].geo), [
                'ip', 'country_code', 'country_name', 'region_code',
                'region_name', 'city', 'zip_code', 'time_zone',
                'latitude', 'longitude', 'metro_code',
              ]);
              assert.type(res[0].userId, 'string');
              assert.equal(res[0].userId.length, 32);

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
