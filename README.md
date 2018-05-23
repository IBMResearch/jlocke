# jLocke

[![Continuos integration](https://travis-ci.org/IBMResearch/jlocke.svg?branch=master)](https://travis-ci.org/IBMResearch/jlocke)

[Express.js](http://expressjs.com) analytics for friends, based on [Elastic](https://www.elastic.co) and [Kibana](https://www.elastic.co/products/kibana). The idea is to monitor the API since the first moment with a quick setup, instead of having to define anything in advance (ie: traits).

Apart from the provided dashboards, anyone can build new custom ones using that stored info. Error reporting is also supported, to relate them with the requests data we have.

## Install

### Library

:coffee:

```sh
npm i --save jlocke
```

### Elastic & Kibana

Use your own deployments. If you need a quick way of setup Kibana to give it a try you could use [this repo](https://github.com/IBMResearch/quickbana).

#### Dashboard

To avoid replacing the active dashboard the default one is available [here](https://github.com/IBMResearch/jlocke/tree/master/kibana) but not loaded. So you need to import it manually.

## Use

:rocket: Please visit [the tests](./test) to see a full example.

### async `jLocke.init(uri, opts)` -> Promise

The middleware setup expects:

- `uri` (string) - The Elastic URI to connect to.
- `opts` (object) - DB optional values:
  - `trace` (boolean) - To enable Elastic tracing. (default: false)
  - `indexRequests` (string) - Name of the Elastic index to store the requests info. (default: "api-requests-MM-DD-YYY")
  - `indexErrors` (string) - Name of the Elastic index to store the errors info. (default: "api-errors-MM-DD-YYY")
  - `app` (string) - App name to monitor, needed to classify by app in Elastic. A field with "keyword" type will be added in all errors and express requests. (default: "app")

### async `jLocke.error(message, error, opts)` -> Promise

To track the errors, ie: uncaughException, unhandledPromise. The middleware setup expects:

- `message` (string) - Custom error message.
- `error` (object) - JavaScript `Error` object.
- `opts` (object) - Optional values:
  - `userId` (string) - User identifier to trace the error.

### `jLocke.express(opts)` -> function

To track the Express requests info. The middleware expects to receive the next parameters. Please visit [the tests](./test) for more details.

- `opts` (object) - Optional values:
  - `only` (string / array) - To store only the requests through this subpath. (default: null)
  - `allHeaders` (boolean) - To include all the user headers. (default: false)
  - `hideBody` (object) - To avoid to store sensitive data in the DB from a "body". (default: {})
    - `path` (string) - The substring of the path to exlude stuff (ie: "login"). If it's not defined but the others do all paths will be hidden.
    - `field` (string) - Name of the object field to exclude (ie: "password"). Same here, if it's not defined but the others do all the body content will be hidden.
    - `fun` (async / function) - Custom function to hide all the content of specific requests. It should return a boolean (`true` for hide) and receives de Express [request](http://expressjs.com/en/api.html#req) object as parameter. In this case it's defined the other two options are ignored.

NOTES:

- The "bodyParser" should be attached before this to capture the body of the POST requests.
- The routes need to be defined after connecting this middleware.

#### Adding more parameters

Apart from the ones included by Express you can attach to the `req` the user ID to allow tracing:

- `userId` (string) - User identifier.

Example [here](https://github.com/IBMResearch/jlocke/blob/master/test/acceptance.js#L70).

In the same wat, to support the `duration` field (ms.) you need to attach the ["response-time"](https://github.com/expressjs/response-time) middleware before with the option "suffix" set to false. Please notice that it should be the first one to get more accurate results. Example [here](https://github.com/IBMResearch/jlocke/blob/master/test/acceptance.js#L74).

## Developer guide

:sunglasses: If you want to help please check [this file](.github/CONTRIBUTING.md).
