'use strict';

const express = require('express'); // eslint-disable-line import/no-extraneous-dependencies
const bodyParser = require('body-parser'); // eslint-disable-line import/no-extraneous-dependencies
const MongoClient = require('mongodb').MongoClient;
const toDb = require('../');

const port = 8888;
const url = 'mongodb://localhost:27017/requests-monitor';
const app = express();

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

console.log(`Starting, connecting to the DB: ${url}`); // eslint-disable-line no-console
MongoClient.connect(url)
.then((db) => {
  console.log('Correctly connected to the DB'); // eslint-disable-line no-console

  // The middleware needs an alive DB connection.
  app.use(toDb(db));

  // Routes should be defined after the middlewares.
  app.get('/', (req, res) => {
    res.send('Hello World!');
  });

  // So we need it ready before starting the app to avoid losing initial requests data.
  // eslint-disable-next-line no-console
  app.listen(port, () => { console.log(`Example app listening on port: ${port}`); });
})// eslint-disable-next-line no-console
.catch((err) => { console.error(`Connecting to the DB: ${err.message}`); });
