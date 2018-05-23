/**
 * @license
 *
 * Copyright (c) 2016-present, IBM Research.
 *
 * This source code is licensed under the Apache license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

'use strict';

const assert = require('assert');

/* eslint-disable import/no-extraneous-dependencies */
const elastic = require('elasticsearch');
const sleep = require('system-sleep');
/* eslint-enable import/no-extraneous-dependencies */

const dbg = require('debug')('jlocke:test:acceptance');
const jLocke = require('../..');
const today = require('../../lib/today');
// const defaults = require('../defaults');

const url = 'localhost:9200';
// Random to avoid confusion running the tests locally.
const index = Math.random().toString(36).substr(2, 10);
const indexErrors = `${index}-error`;
const indexErrorsFull = `${indexErrors}-${today()}`;
const appName = 'testName';


dbg(`Starting, initing the DB connection: ${url}`);
const db = new elastic.Client({
  host: url,
  // log: 'trace',
});


describe('error()', () => {
  before(async () => {
    await jLocke.init(url, {
      // trace: true,
      app: appName,
      indexRequests: index,
      indexErrors,
    });

    dbg('jLocke started, waiting a bit for index creation to finish');
    sleep(10000);
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
    const result = await db.search({ index: indexErrorsFull, type: 'error' });
    dbg('Response got:', result);

    // Only cheking some of them to KISS.
    assert.equal(result.timed_out, false);
    assert.equal(result.hits.total, 1);
    /* eslint-disable no-underscore-dangle */
    assert.equal(result.hits.hits[0]._index, indexErrorsFull);
    assert.equal(typeof result.hits.hits[0]._id, 'string');
    assert.equal(result.hits.hits[0]._id.length, 20);
    assert.equal(result.hits.hits[0]._source.app, appName);
    assert.equal(result.hits.hits[0]._source.message, errMsgCustom);
    assert.equal(result.hits.hits[0]._source.errorMessage, errMsg);
    assert.equal(typeof result.hits.hits[0]._source.errorStack, 'string');
    assert.equal(result.hits.hits[0]._source.userId, userId);
    // Elastic returns it as an string.
    assert.equal(typeof result.hits.hits[0]._source.timestamp, 'string');
    /* eslint-enable no-underscore-dangle */
  });
});
