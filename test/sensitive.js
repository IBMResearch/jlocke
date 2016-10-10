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

/* eslint-disable import/no-extraneous-dependencies */
const test = require('tap').test;
const express = require('express');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const makeReq = require('tiny-promisify')(require('request'), { multiArgs: true });
/* eslint-enable import/no-extraneous-dependencies */
const dbg = require('debug')('express-middleware-todb:test:noOpts');

const toDb = require('../');

const port = 5555;
const url = 'mongodb://localhost:27017/requests-monitor';
// The default one because we're not passing anyone.
const col = 'requests';
const badLoginMsg = 'login failed';
const excludePath = 'login';
const excludeField = 'password';


dbg(`Starting, connecting to the DB: ${url}`);
MongoClient.connect(url)
.then((db) => {
  dbg('Correctly connected to the DB');

  test('with sensitive body content', (assert) => {
    assert.plan(13);

    const app = express();

    app.use(bodyParser.json());
    app.use(toDb(db, { hide: { path: excludePath, field: excludeField } }));
    app.get('/', (req, res) => res.send('Hello World!'));
    app.post('/login', (req, res) => {
      if (req.body.username === 'ola') {
        res.send({ username: 'test', token: 'aaa' });
      } else {
        res.status(401).send(badLoginMsg);
      }
    });

    const server = app.listen(port, () => {
      dbg(`Example app listening on port: ${port}`);
      const reqOpts = {
        url: `http://127.0.0.1:${port}/login`,
        method: 'POST',
        json: { username: 'ola', password: 'kase' },
      };

      db.collection(col).removeMany()
      .then(() => {
        makeReq(reqOpts)
        .then((httpRes) => {
          assert.equal(httpRes[0].statusCode, 200);

          setTimeout(() => {
            db.collection(col).find().toArray()
            .then((res) => {
              assert.equal(res.length, 1);
              assert.equal(res[0].path, '/login');
              assert.equal(res[0].method, 'POST');
              assert.equal(res[0].protocol, 'http');
              assert.equal(res[0].ip, '::ffff:127.0.0.1');
              assert.equal(res[0].headers.host, '127.0.0.1:5555');
              assert.equal(res[0].headers.connection, 'close');
              assert.equal(res[0].originalUrl, '/login');
              assert.type(res[0].timestamp, 'object');
              assert.equal(res[0].responseCode, 200);
              assert.equal(res[0].body.username, 'ola');
              assert.equal(res[0].body[excludeField], undefined);

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
