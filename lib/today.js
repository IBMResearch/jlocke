#!/usr/bin/env node

/*
  Copyright (c) 2016 IBM Research Emergent Solutions
                     Jesús Pérez <jesusprubio@gmail.com>

  This code may only be used under the MIT style license found at
  https://ibmresearch.github.io/LICENSE.txt
*/

'use strict';


module.exports = () => new Date().toJSON().slice(0, 10);
