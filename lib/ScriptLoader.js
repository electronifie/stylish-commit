var _ = require('lodash');
var log = require('debug')('stylish-commit.lib.ScriptLoader');
var path = require('path');
var requireAll = require('require-all');

var ScriptLoader = function (packagePath) {
  this.package = require(packagePath);

  var dirName = path.dirname(packagePath);
  this.scriptsFolder = path.resolve(dirName, this.package['styleScripts'] || '.style');
  log('Scripts folder: ', this.scriptsFolder);
};

ScriptLoader.prototype = {
  getScripts: function () {
    var scripts = requireAll(this.scriptsFolder);
    // Scripts must have a .validate() method
    var validScripts = _.filter(scripts, function (script) { return _.isFunction(script.validate); });
    return validScripts;
  }
};

module.exports = ScriptLoader;
