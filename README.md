# API starter

[![Continuos integration](https://api.travis-ci.org/IBMResearch/express-middleware-todb.svg)](https://travis-ci.org/IBMResearch/express-middleware-todb)

Express middleware to store requests metadata to a MongoDB instance.


## Install
```sh
npm i express-middleware-todb
```


## Use

The middleware expects to receive the next parameters. Please visit [the tests](./tests) for more details.
- `db` (object) - MongoDB connected instance.
- `opts` is an object with the optional ones:
 - `col` (string) - Name of the collection to store the requests info. (default: 'requests')
 - `geo` (boolean) - To make an extra request to get also the request IP address location. (default: false)
 - `idFunc(req)` (function) - Function to add also the user ID with the request info. It should receive a `request` parameter (A Express common ["request"](http://expressjs.com/es/4x/api.html#req) object). (default: not used)


## Developer guide

- Use [GitHub pull requests](https://help.github.com/articles/using-pull-requests).
- We love ES6, so we use [ESLint](http://eslint.org/) and the [Airbnb](https://github.com/airbnb/javascript) style guide. It's the most complete, so it forces the developers to keep a consistent style.
- Please run to be sure your code fits with it and the tests keep passing:
```sh
npm test
```

### Debugging
To debug we use the [visionmedia module](alendar.google.com/calendar). So you have to use our environment variable. As you can see, the format is consistent with LoopBack one:
```sh
DEBUG=express-middleware-todb* npm start
```

### Commit messages rules:
- It should be formed by a one-line subject, followed by one line of white space. Followed by one or more descriptive paragraphs, each separated by one￼￼￼￼ line of white space. All of them finished by a dot.
- If it fixes an issue, it should include a reference to the issue ID in the first line of the commit.
- It should provide enough information for a reviewer to understand the changes and their relation to the rest of the code.
