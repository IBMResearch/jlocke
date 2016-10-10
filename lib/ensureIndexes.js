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
        ip: { type: 'ip' },
        // We can't know what headers is the client sending in advance
        // and we don't want to lose information.
        // TODO: When we know well what we need we could be more specific here.
        headers: { type: 'object' },
        originalUrl: { type: 'string' },
        responseCode: { type: 'short' },
        timestamp: { type: 'date' },
        geo: {
          properties: {
            ip: { type: 'ip' },
            country_code: { type: 'string' },
            country_name: { type: 'string' },
            region_code: { type: 'string' },
            region_name: { type: 'string' },
            city: { type: 'string' },
            zip_code: { type: 'string' },
            time_zone: { type: 'string' },
            latitude: { type: 'short' },
            longitude: { type: 'short' },
            metro_code: { type: 'short' },
          },
        },
        body: { type: 'string' },
        location: {
          type: 'geo_point',
          // Not needed for now, just in case we keep them here.
          // geohash: true,
          // lat_lon: true,
        },
        userId: { type: 'string' },
      },
    },
  };
}


module.exports = (db, opts) =>
  new Promise((resolve, reject) => {
    if (opts.type === 'mongo') {
      db.collection(opts.mongo.col).createIndex({ location: '2dsphere' })
      .then(resolve)
      .catch(err => reject(new Error(`Creating the index (Mongo): ${err.message}`)));

      return;
    }

    const indexName = opts.elastic.index;
    const typeName = opts.elastic.type;

    db.indices.exists({ index: indexName })
    .then((exists) => {
      let createIndex = Promise.resolve();

      if (!exists) {
        // TODO: Refactor this without broking anything.
        createIndex = new Promise((resolve2, reject2) => {
          db.indices.create({ index: indexName })
          .then(() => {
            db.indices.putMapping(mapping(indexName, typeName))
            .then(resolve2)
            .catch(reject2);
          })
          .catch(reject2);
        });
      }

      createIndex
      .then(resolve)
      .catch(err => reject(new Error(`Creating the index/mapping (Elastic): ${err.message}`)));
    })
    .catch(err => reject(new Error(`Checking if the indexes exist (Elastic): ${err.message}`)));
  });
