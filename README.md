# express-middleware-todb

[![Continuos integration](https://api.travis-ci.org/IBMResearch/express-middleware-todb.svg)](https://travis-ci.org/IBMResearch/express-middleware-todb)
[![NSP Status](https://nodesecurity.io/orgs/ibmresearch/projects/ff6b7a19-f947-4807-80d1-320e8a842880/badge)](https://nodesecurity.io/orgs/ibmresearch/projects/ff6b7a19-f947-4807-80d1-320e8a842880)

Express middleware to store requests metadata to a DB. For now we support [MongoDB](https://www.mongodb.com/) and [Elastic](https://www.elastic.co/).


## Install

```sh
npm i --save express-middleware-todb
```


## Use

The middleware expects to receive the next parameters. Please visit [the tests](./tests) for more details.
- `db` (object) - MongoDB instance or Elastic client.
- `opts` is an object with the optional ones:
 - `geo` (boolean) - To make an extra request to get also the request IP address location. (default: false)
 - `idFunc(req, res)` (function) - Promise to add also the user ID with the request info. It's going to receive the Express ["Request"](http://expressjs.com/es/4x/api.html#req) and ["Response"](http://expressjs.com/es/4x/api.html#res) objects. So you can use them inside. (default: not used)
 - `hide`: To avoid to store sensitive data in the DB for a POST route.
 - `dbOpts` (object) - Specific DB options.

About the `hide`object:
- `path` (string) : The substring of the path to exlude stuff (ie: 'login').
- `field` (string) : Name of the object field to exclude (ie: 'password').

About the `dbOpts` object:
- `type` (string) - Type of the database ("mongo" or "elastic"). (default: "mongo")
The rest depend of the selected type:
- MongoDB:
 - `colName` (string) - Name of the "collection" to store the requests info. The "index" in the case of Elastic (default: 'requests')
- Elastic:
 - `indexName` (string) - Name of the "index" to store the requests info. (default: 'searchByRequest')
 - `elasType` (string) - Type of the element to store the requests info. (default: 'requests')


## Developer guide

Please check [this link](https://github.com/IBMResearch/backend-development-guide) before a contribution.
