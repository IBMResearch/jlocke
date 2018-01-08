/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';

const assert = require('assert');

// const dbg = require('debug')('jlocke-express-middleware:test:unit');
const today = require('../lib/today');


describe('Unit', () => {
  it('today() should return a proper date', async () => {
    const res = await today();

    const splitted = res.split('-');
    const year = parseInt(splitted[0], 10);
    const month = parseInt(splitted[1], 10);
    const day = parseInt(splitted[2], 10);
    assert.ok(year > 2017);
    assert.ok(month > 0 && month < 13);
    assert.ok(day > 0 && day < 32);
  });
});
