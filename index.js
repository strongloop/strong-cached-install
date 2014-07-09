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

  fs.readJsonFile(
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

function installPackage(appDir, cacheDir, name, version, cb) {
  var quotedVersion = version.replace(/^\^/, 'caret-').replace(/^~/, 'tilde-');
  var cachePath = path.join(cacheDir, name, quotedVersion);
  var dest = path.join(appDir, 'node_modules', name);

  fs.exists(cachePath, function(exists) {
    if (exists) {
      debug('installing package %s@%s from cache', name, version);
      fs.mkdirsSync(dest);
      ncp(cachePath, dest, cb);
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
  var options = {
    cwd: cwd,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    },
  };

  var command = 'npm install ' + what;
  debug(command);
  return exec(command, options, function(err, stdout, stderr) {
    debug('--npm install stdout--\n%s\n--npm install stderr--\n%s\n--end--',
      stdout, stderr);
    cb(err, stdout, stderr);
  });
}
