var _ = require('lodash');
var fs = require('fs');
var log = require('debug')('stylish-commit.lib.ScriptLoader');
var path = require('path');
var requireAll = require('require-all');

var ScriptLoader = function (packagePath) {
  this.package = require(packagePath);

  var dirName = path.dirname(packagePath);
  this.scriptsFolder = path.resolve(dirName, this.package['styleScripts'] || '.style');

  if (!fs.existsSync(this.scriptsFolder)) {
    log('WARN: no scripts folder found (checked %s).', this.scriptsFolder);
    this.scriptsFolder = null;
  } else {
    log('Scripts folder: ', this.scriptsFolder);
  }
};

ScriptLoader.prototype = {
  getScripts: function () {
    if (!this.scriptsFolder) {
      return [];
    }

    var scripts = requireAll(this.scriptsFolder);
    // Scripts must have a .validate() method
    var validScripts = _.filter(scripts, function (script) { return _.isFunction(script.validate); });
    if (validScripts.length === 0) {
      log('WARN: could not find any validation scripts.');
    } else {
      log('Found ' + validScripts.length + ' scripts.');
    }
    return validScripts;
  }
};

module.exports = ScriptLoader;
