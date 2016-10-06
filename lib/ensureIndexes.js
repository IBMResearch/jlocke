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
        // TODO: Still not sure about all the possible fields, for now:
        // { host: '127.0.0.1:8888', connection: 'close' }
        headers: { type: 'object' },
        originalUrl: { type: 'string' },
        responseCode: { type: 'short' },
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
        location: { type: 'geo_point' },
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
        createIndex = db.indices.create({ index: indexName })
          .then(db.indices.putMapping(mapping(indexName, typeName)));
      }

      createIndex
      .then(resolve)
      .catch(err => reject(new Error(`Creating the index (Elastic): ${err.message}`)));
    })
    .catch(err => reject(new Error(`Checking if the indexes exist (Elastic): ${err.message}`)));
  });
