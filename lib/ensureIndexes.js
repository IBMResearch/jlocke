/*
  MIT License

  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>
                     Paco Martín <fmartinfdez@gmail.com>

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
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
