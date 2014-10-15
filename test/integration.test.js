/*global describe, it, beforeEach */
var exec = require('child_process').exec;
var fs = require('fs-extra');
var path = require('path');
var which = require('which');
var install = require('../');

var debug = require('debug')('test');

var expect = require('chai').expect;

var SANDBOX = path.resolve(__dirname, 'sandbox');
var CACHE = path.resolve(__dirname, '.pkgcache');

describe('cached install', function() {
  // Increase the timeout to accomodate for slow `npm install`
  this.timeout(120*1000);

  beforeEach(resetCacheSync);
  beforeEach(resetSandboxSync);

  it('installs dependencies', function(done) {
    givenPackageWithDebugDependency('0.8.0');
    install(SANDBOX, CACHE, function(err) {
      if (err) return done(err);
      expectDebugVersionInstalled('0.8.0');
      done();
    });
  });

  it('installs dependencies from cache', function(done) {
    givenPackageWithDebugDependency('0.8.0');
    install(SANDBOX, CACHE, function(err) {
      if (err) return done(err);

      // modify the cached package.json
      var cachedPkgPath = path.resolve(CACHE, 'debug', '0.8.0', 'package.json');
      var pkg = fs.readJsonFileSync(cachedPkgPath);
      pkg.version = pkg.version + '+mod';
      fs.writeJsonFileSync(cachedPkgPath, pkg);

      resetSandboxSync();
      givenPackageWithDebugDependency('0.8.0');
      install(SANDBOX, CACHE, function(err) {
        if (err) return done(err);
        expectDebugVersionInstalled('0.8.0+mod');
        done();
      });
    });
  });

  it('creates .bin links when installing from cache', function(done) {
    // This test needs to install a package that is not already in PATH
    // mkdirp is a good candidate, let's verify it's not already there
    try {
      var mkdirpPath = which.sync('mkdirp');
      return done(new Error('mkdir is already installed in ' + mkdirpPath));
    } catch(err) {
    }

    var packageJson = {
      scripts: {
        test: 'mkdirp tested'
      },
      dependencies: {
        mkdirp: '0.5.0'
      }
    };

    givenPackage(packageJson);
    install(SANDBOX, CACHE, function(err) {
      if (err) return done(err);
      resetSandboxSync();
      givenPackage(packageJson);

      // Install mkdirp from the cache
      install(SANDBOX, CACHE, function(err) {
        if (err) return done(err);
        // Verify that `npm test` can call `mkdirp` in SANDBOX
        debug('executing `npm test`');

        exec('npm test', { cwd: SANDBOX }, function(err, stdout, stderr) {
          debug('--npm test stdout--\n%s\n--npm test stderr--\n%s\n--end--',
            stdout, stderr);
          done(err);
        });
      });
    });
  });

  it('is versioning cached modules', function(done) {
    givenPackageWithDebugDependency('0.8.0');
    install(SANDBOX, CACHE, function(err) {
      if (err) return done(err);

      resetSandboxSync();
      givenPackageWithDebugDependency('1.0.0');
      install(SANDBOX, CACHE, function(err) {
        if (err) return done(err);
        expectDebugVersionInstalled('1.0.0');
        done();
      });
    });
  });

  it('supports dev dependencies', function(done) {
    givenPackage({
      devDependencies: {
        debug: '0.8.0'
      }
    });
    install(SANDBOX, CACHE, ['devDependencies'], function(err) {
      if (err) return done(err);
      expectDebugVersionInstalled('0.8.0');
      done();
    });
  });

  function givenPackageWithDebugDependency(version) {
    givenPackage({
      dependencies: {
        debug: version
      }
    });
  }

  function givenPackage(packageJson) {
    fs.writeJsonFileSync(path.resolve(SANDBOX, 'package.json'), packageJson);
  }
  function expectDebugVersionInstalled(expectedVersion) {
    var pkgPath = path.join(SANDBOX, 'node_modules', 'debug', 'package.json');
    expect(fs.existsSync(pkgPath), 'node_modules/debug/package.json exists')
      .to.equal(true);

    var pkg = fs.readJsonFileSync(pkgPath);
    expect(pkg.version, 'debug version').to.equal(expectedVersion);
  }

  function resetSandboxSync() {
    fs.removeSync(SANDBOX);
    fs.mkdirsSync(SANDBOX);
  }

  function resetCacheSync() {
    fs.removeSync(CACHE);
  }
});
