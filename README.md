# jlocke-express-middleware

[![Continuos integration](https://travis-ci.org/IBMResearch/jlocke-express-middleware.svg?branch=master)](https://travis-ci.org/IBMResearch/jlocke-express-middleware)
[![NSP Status](https://nodesecurity.io/orgs/ibmresearch/projects/4b853cee-b5b6-48e6-a5c8-4d1205fa095b/badge)](https://nodesecurity.io/orgs/ibmresearch/projects/4b853cee-b5b6-48e6-a5c8-4d1205fa095b)

Express middleware to store requests metadata to an [Elastic](https://www.elastic.co) instance. We use it [JLocke](https://api.travis-ci.org/IBMResearch/jlocke) project and other internal ones.

## Install

```sh
npm i --save jlocke-express-middleware
```

## Setup

Add your Elastic URL to this script and run it once before the first deployment.

```sh
node scripts/ensureIndexes.js
```

## Use

### `jlocke(uri, opts)`

The middleware expects to receive the next parameters. Please visit [the tests](./tests) for more details.

- `uri` (string) - The database uri to connect to.
- `opts` (object) - Optional values:
  - `idFun(req, res)` (function) - Promise to add also the user ID with the request info. It's going to receive the Express ["Request"](http://expressjs.com/es/4x/api.html#req) and ["Response"](http://expressjs.com/es/4x/api.html#res) objects. So you can use them inside. (default: null)
  - `hide` (object) - To avoid to store sensitive data in the DB for a POST route. (default: {})
    - `path` (string) - The substring of the path to exlude stuff (ie: "login").
    - `field` (string) - Name of the object field to exclude (ie: "password").
  - `dbOpts` (object) - Specific DB options.
    - `index` (string) - Name of the Elastic index to store the requests info. (default: "searchByRequest")
    - `type` (string) - Elastic type of the element to store the requests info. (default: "requests")

## Developer guide

Please check [this link](https://github.com/IBMResearch/contributing) before a contribution.
