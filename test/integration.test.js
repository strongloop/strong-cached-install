/*global describe, it, beforeEach */
var exec = require('child_process').exec;
var fs = require('fs-extra');
var path = require('path');
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
      var pkg = fs.readJsonSync(cachedPkgPath);
      pkg.version = pkg.version + '+mod';
      fs.writeJsonSync(cachedPkgPath, pkg);

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
    // cowsay is a good candidate, let's verify it's not already there
    try {
      var cowsayPath = path.resolve(SANDBOX, 'node_modules', '.bin', 'cowsay');
      if (fs.accessSync(cowsayPath) || fs.accessSync(cowsayPath + '.cmd')) {
        return done(new Error('cowsay is already installed in ' + cowsayPath));
      }
    } catch(err) {
    }

    var packageJson = {
      scripts: {
        test: './node_modules/.bin/cowsay tested'
      },
      dependencies: {
        cowsay: '1.1.2'
      }
    };

    givenPackage(packageJson);
    install(SANDBOX, CACHE, function(err) {
      if (err) return done(err);
      resetSandboxSync();
      givenPackage(packageJson);

      // Install cowsay from the cache
      install(SANDBOX, CACHE, function(err) {
        if (err) return done(err);
        // Verify that `npm test` can call `cowsay` in SANDBOX
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
    fs.writeJsonSync(path.resolve(SANDBOX, 'package.json'), packageJson);
  }
  function expectDebugVersionInstalled(expectedVersion) {
    var pkgPath = path.join(SANDBOX, 'node_modules', 'debug', 'package.json');
    expect(fs.existsSync(pkgPath), 'node_modules/debug/package.json exists')
      .to.equal(true);

    var pkg = fs.readJsonSync(pkgPath);
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
