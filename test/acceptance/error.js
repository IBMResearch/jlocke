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
const elastic = require('elasticsearch');
const sleep = require('system-sleep');
/* eslint-enable import/no-extraneous-dependencies */

const dbg = require('debug')('jlocke-express-middleware:test:acceptance');
const jLocke = require('../..');
const today = require('../../lib/today');
// const defaults = require('../defaults');

const url = 'localhost:9200';
// Random to avoid confusion running the tests locally.
const index = Math.random().toString(36).substr(2, 10);
const indexErrors = `${index}-error`;
const indexErrorsFull = `${indexErrors}-${today()}`;
const type = 'test';
const typeErrors = 'testErr';


dbg(`Starting, initing the DB connection: ${url}`);
const db = new elastic.Client({
  host: url,
  log: 'trace',
});


describe('error()', () => {
  // TODO: Not working.
  // before(async () => {
  // beforeEach(async () => {
  before((done) => {
    jLocke.init(url, {
      trace: true,
      indexRequests: index,
      typeRequests: type,
      indexErrors,
      typeErrors,
    })
      .then(() => {
        dbg('jLocke started');

        // Lets give a time to end the index creation.
        sleep(10000);
        done();
      });
  });


  it('should save the error', async () => {
    dbg('Making the error request ...');
    const errMsgCustom = 'Test custom';
    const errMsg = 'Test error';
    const userId = 'testUserId';

    await jLocke.error(errMsgCustom, new Error(errMsg), { userId });
    dbg('Error request done');

    dbg('Waiting a bit ...');
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
