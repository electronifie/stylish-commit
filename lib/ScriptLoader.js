var _ = require('lodash');
var fs = require('fs');
var log = require('debug')('stylish-commit.lib.ScriptLoader');
var path = require('path');
var requireAll = require('require-all');

var ScriptLoader = function (packagePath) {
  this.scriptsFolder = this._getScriptsFolder(packagePath);
};

ScriptLoader.prototype = {
  _getScriptsFolder: function (packagePath) {
    if ( !fs.existsSync(packagePath) ) {
      log('WARN: could not find package.json.');
      return null;
    }
    var package = require(packagePath);

    var dirName = path.dirname(packagePath);
    scriptsFolder = path.resolve(dirName, package['styleScripts'] || '.style');

    if (!fs.existsSync(scriptsFolder)) {
      log('WARN: no scripts folder found (checked %s).', scriptsFolder);
      return null;
    }

    log('Scripts folder: ', scriptsFolder);
    return scriptsFolder;
  },

  getScripts: function () {
    if (!this.scriptsFolder) {
      return [];
    }

    var scripts = requireAll(this.scriptsFolder);
    // Scripts must have a .validate() method
    var validScripts = _.filter(scripts, function (script) { return !!script.validate; });
    if (validScripts.length === 0) {
      log('WARN: could not find any validation scripts.');
    } else {
      log('Found ' + validScripts.length + ' scripts.');
    }
    return validScripts;
  }
};

module.exports = ScriptLoader;
