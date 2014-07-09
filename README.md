# strong-cached-install

[![Build Status](https://travis-ci.org/strongloop/strong-cached-install.png?branch=master)](https://travis-ci.org/strongloop/strong-cached-install)
[![NPM version](https://badge.fury.io/js/strong-cached-install.png)](http://badge.fury.io/js/strong-cached-install)

## Overview

Strong-cached-install speeds up `npm install` in your tests by caching the
content of `node_modules` and using plain `cp -r` on subsequent runs.

## Installation

```sh
$ npm install strong-cached-install
```

## Usage

```js
var path = require('path');
var install = require('strong-cached-install');

describe('my yo generator', function() {
  before(resetSandbox);
  before(runGeneratorInSandbox);

  before(function installDependencies(done) {
    var appDir = SANDBOX;
    var cacheDir = path.resolve(__dirname, '.pkgcache');
    install(appDir, cacheDir, done);
  }

  // and the tests
});
```
