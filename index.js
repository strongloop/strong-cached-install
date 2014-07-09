var async = require('async');
var debug = require('debug')('strong-cached-install');
var exec = require('child_process').exec;
var fs = require('fs-extra');
var ncp = require('ncp');
var path = require('path');

module.exports = function install(appDir, cacheDir, cb) {
  fs.readJsonFile(
    path.resolve(appDir, 'package.json'),
    function installFromPackageJson(err, pkg) {
      if (err) return cb(err);

      async.eachSeries(
        Object.keys(pkg.dependencies),
        function installDependency(dep, next) {
          installPackage(appDir, cacheDir, dep, pkg.dependencies[dep], next);
        },
        cb);
    });
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
