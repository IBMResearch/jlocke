#!/usr/bin/env node

/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';

const elastic = require('elasticsearch');

const defaults = require('../defaults');

// NOTE: Pur your Elastic url and your index details, if you don't want to use the default.
const url = 'localhost:9200';
const indexName = defaults.index.name;
const indexType = defaults.index.type;


function mapping(name, type) {
  return {
    index: name,
    type,
    body: {
      properties: {
        path: { type: 'text' },
        method: { type: 'text' },
        protocol: { type: 'text' },
        ip: { type: 'text' },
        // We can't know what headers is the client sending in advance
        // and we don't want to lose information.
        // TODO: When we know well what we need we could be more specific here.
        headers: { type: 'object' },
        originalUrl: { type: 'text' },
        // TODO: Because of any reason it doesn't work in Elastic, and only in the POST requests.
        // responseCode: { type: 'short' },
        responseCode: { type: 'long' },
        timestamp: { type: 'date' },
        body: { type: 'object' },
        userId: { type: 'text' },
      },
    },
  };
}


/* eslint-disable no-console */
console.log('Connecting to Elastic ...');
const db = new elastic.Client({
  host: url,
  // log: 'trace',
});

console.log('Connected, checking if the index exist', { indexName, indexType });
// To avoid drop an index with data.
db.indices.exists({ index: indexName })
  .then((exists) => {
    if (exists) {
      console.log('Index found, skipping.');
      return;
    }
    console.log('Idex not found, creating it ...');
    db.indices.create({ index: indexName })
      .then(() => {
        console.log('Index created, mapping');
        db.indices.putMapping(mapping(indexName, indexType))
          .then(() => console.log('Mapping done'))
          .catch(err => console.error('Mapping', err));
      })
      .catch(err => console.error('Creating the index', err));
  })
  .catch(err => console.error('Checking if the indexes exist', err));
/* eslint-enable no-console */
