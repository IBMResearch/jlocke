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


const mapping = {
  // eslint-disable-next-line arrow-body-style
  request: (name, type) => {
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
          duration: { type: 'float' },
          body: { type: 'object' },
          userId: { type: 'text' },
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
          message: { type: 'text' },
          errorMessage: { type: 'text' },
          errorStack: { type: 'text' },
          timestamp: { type: 'date' },
          userId: { type: 'text' },
        },
      },
    };
  },
};


module.exports = (db, index, type, map) =>
  new Promise((resolve, reject) => {
    dbg('Checking if index exists ...', {
      index, type, map,
    });

    db.indices.exists({ index })
      .then((exists) => {
        let createIndex = Promise.resolve();

        if (!exists) {
          dbg('Not existent index, creating it ...', {
            index, type, map,
          });
          createIndex = new Promise((resolve2, reject2) => {
            db.indices.create({ index })
              .then(() => {
                db.indices.putMapping(mapping[map](index, type))
                  .then(resolve2)
                  .catch(reject2);
              })
              .catch(reject2);
          });
        }

        createIndex
          .then(() => {
            dbg('Index creation request done ...', {
              index, type, map,
            });
            resolve();
          })
          .catch(err => reject(new Error(`Creating the index/mapping: ${err.message}`)));
      })
      .catch(err => reject(new Error(`Checking if the indexes exist: ${err.message}`)));
  });
