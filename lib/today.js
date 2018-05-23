#!/usr/bin/env node

/**
 * @license
 *
 * Copyright (c) 2016-present, IBM Research.
 *
 * This source code is licensed under the Apache license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

'use strict';


module.exports = () => new Date().toJSON().slice(0, 10);
