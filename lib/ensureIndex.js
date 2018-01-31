#!/usr/bin/env node

/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';


const dbg = require('debug')('jlocke:ensureIndex');


// TODO: Move to a file.
const mapping = {
  // eslint-disable-next-line arrow-body-style
  request: (name, type) => {
    return {
      index: name,
      type,
      body: {
        properties: {
          method: { type: 'keyword' },
          protocol: { type: 'keyword' },
          ip: { type: 'keyword' },
          // We can't know what headers is the client sending in advance
          // and we don't want to lose information.
          // TODO: When we know well what we need we could be more specific here.
          headers: { type: 'object' },
          agent: { type: 'keyword' },
          // TODO: Because of any reason it doesn't work in Elastic, and only in the POST requests.
          // responseCode: { type: 'short' },
          responseCode: { type: 'long' },
          timestamp: { type: 'date' },
          duration: { type: 'float' },
          body: { type: 'object' },
          userId: { type: 'keyword' },
          // TODO: If we don't need full text search use keyword to allow aggregations.
          originalUrl: { type: 'text' },
          path: { type: 'keyword' },
        },
      },
    };
  },
  // eslint-disable-next-line arrow-body-style
  error: (name, type) => {
    return {
      index: name,
      type,
      body: {
        properties: {
          // TODO: If we don't need full text search use keyword to allow aggregations.
          message: { type: 'keyword' },
          errorMessage: { type: 'text' },
          errorStack: { type: 'text' },
          timestamp: { type: 'date' },
          userId: { type: 'keyword' },
        },
      },
    };
  },
};


module.exports = async (db, index, type, map) => {
  dbg('Checking if index exists ...', {
    index, type, map,
  });

  let exists;
  try {
    exists = await db.indices.exists({ index });
  } catch (err) {
    throw new Error(`Checking if the indexes exist: ${err.message}`);
  }

  if (!exists) {
    dbg('Not existent index, creating it ...', {
      index, type, map,
    });

    try {
      await db.indices.create({ index });
      await db.indices.putMapping(mapping[map](index, type));
    } catch (err) {
      throw new Error(`Creating the index/mapping: ${err.message}`);
    }
  }

  dbg('Index creation request done ...', {
    index, type, map,
  });
};
