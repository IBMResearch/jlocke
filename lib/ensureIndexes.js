/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';

const Promise = require('bluebird');


function mapping(name, type) {
  return {
    index: name,
    type,
    body: {
      properties: {
        path: { type: 'string' },
        method: { type: 'string' },
        protocol: { type: 'string' },
        ip: { type: 'string' },
        // We can't know what headers is the client sending in advance
        // and we don't want to lose information.
        // TODO: When we know well what we need we could be more specific here.
        headers: { type: 'object' },
        originalUrl: { type: 'string' },
        // TODO: Because of any reason it doesn't work in Elastic, and only in the POST requests.
        // responseCode: { type: 'short' },
        responseCode: { type: 'long' },
        timestamp: { type: 'date' },
        body: { type: 'object' },
        userId: { type: 'string' },
      },
    },
  };
}


module.exports = (db, index, type) =>
  new Promise((resolve, reject) => {
    db.indices.exists({ index })
    .then((exists) => {
      let createIndex = Promise.resolve();

      if (!exists) {
        // TODO: Refactor this without broking anything.
        createIndex = new Promise((resolve2, reject2) => {
          db.indices.create({ index })
          .then(() => {
            db.indices.putMapping(mapping(index, type))
            .then(resolve2)
            .catch(reject2);
          })
          .catch(reject2);
        });
      }

      createIndex
      .then(resolve)
      .catch(err => reject(new Error(`Creating the index/mapping: ${err.message}`)));
    })
    .catch(err => reject(new Error(`Checking if the indexes exist: ${err.message}`)));
  });
