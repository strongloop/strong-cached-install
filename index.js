// Copyright IBM Corp. 2014,2017. All Rights Reserved.
// Node module: strong-cached-install
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

var async = require('async');
var debug = require('debug')('strong-cached-install');
var exec = require('child_process').exec;
var fs = require('fs-extra');
var ncp = require('ncp');
var path = require('path');

/**
 * Install dependencies of the package in `appDir` directory.
 * @param {string} appDir Application's root directory.
 * @param {string} cacheDir Directory where to keep cached files.
 * @param {Array<string>=} depTypes Optiona list of dependency types to install,
 * e.g. `['dependencies', 'devDependencies']`. Defaults to `['dependencies']`.
 * @param {function(Error=)} cb The callback.
 */
module.exports = function install(appDir, cacheDir, depTypes, cb) {
  if (typeof depTypes === 'function' && cb === undefined) {
    cb = depTypes;
    depTypes = ['dependencies'];
  }

  fs.readJson(
    path.resolve(appDir, 'package.json'),
    function installFromPackageJson(err, pkg) {
      if (err) return cb(err);

      var deps = [];
      depTypes.forEach(function(dt) {
        deps = deps.concat(toKeyValuePairs(pkg[dt]));
      });

      async.eachSeries(
        deps,
        function installDependency(dep, next) {
          installPackage(appDir, cacheDir, dep[0], dep[1], next);
        },
        cb);
    });

  function toKeyValuePairs(map) {
    return Object.keys(map || {})
      .map(function(key) { return [key, map[key]]; });
  }
};

module.exports.package = installPackage;

/**
 * Install a single package with a given version.
 * @param {string} appDir Application's root directory.
 * @param {string} cacheDir Directory where to keep cached files.
 * @param {string} name Package name, e.g. "loopback"
 * @param {string} version Version specifier, e.g. "2.5.0" or "^2.6.5"
 * @param {function(Error=)} cb The callback.
 */
function installPackage(appDir, cacheDir, name, version, cb) {
  var quotedVersion = version.replace(/^\^/, 'caret-').replace(/^~/, 'tilde-');
  var cachePath = path.join(cacheDir, name, quotedVersion);
  var dest = path.join(appDir, 'node_modules', name);

  fs.exists(cachePath, function(exists) {
    if (exists) {
      debug('installing package %s@%s from cache', name, version);
      fs.mkdirsSync(dest);
      ncp(cachePath, dest, function(err) {
        if (err) return cb(err);
        debug('running npm build for %s@%s', name, version);
        execNpmCommand('build .', dest, cb);
      });
      return;
    }

    debug('installing package %s@%s from npm', name, version);
    execNpmInstall(name + '@' + version, appDir, function(err) {
      if (err) return cb(err);
      fs.mkdirs(cachePath, function(err) {
        if (err) return cb(err);
        ncp(dest, cachePath, cb);
      });
    });
  });
}

function execNpmInstall(what, cwd, cb) {
  execNpmCommand('install --spin=false --global-style ' + what, cwd, cb);
}

function execNpmCommand(commandWithArgs, cwd, cb) {
  debug('NPM ENV', process.env);

  var options = {
    cwd: cwd,
  };

  var script = 'npm ' + commandWithArgs;
  if (/^win/.test(process.platform)) {
    // On Windows, "^" is a reserved character that must be escaped as "^^"
    // Strangely enough, we need to escape it twice, as if there were
    // two CMD shells invoked under the hood
    script = script.replace('^', '^^^^');
  }

  debug(script);
  return exec(script, options, function(err, stdout, stderr) {
    debug('--npm stdout--\n%s\n--npm stderr--\n%s\n--end--',
      stdout, stderr);
    cb(err, stdout, stderr);
  });

}
