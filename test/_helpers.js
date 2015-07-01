var assert = require('chai').assert;
var fs = require('fs-extra');
var log = require('debug')('stylish-commit.test.helper');
var path = require('path');
var run = require('sync-exec');

var Repository = function () {
  this.dirName = '/tmp/stylish_commit_test_' + Date.now() + '_' + (Math.random() * 1000 | 0);
  log('Creating ' + this.dirName);
  fs.mkdirSync(this.dirName);
  this.runAtRoot('git init');
};

Repository.prototype = {
  // File actions
  _path: function (fileName) { return path.normalize(this.dirName + '/' + fileName); },
  createFile: function (fileName, initialContents) { this.updateFile(fileName, initialContents); },
  updateFile: function (fileName, fileContents) {
    log('Writing to "' + fileName + '": ' + fileContents);
    fs.writeFileSync(this._path(fileName), fileContents);
  },
  getFileContents: function (fileName) { return fs.readFileSync(this._path(fileName), { encoding: 'utf8' }); },
  containsFile: function (fileName) { return fs.existsSync(this._path(fileName)); },

  // Git actions
  commit: function (commitMessage) { this.runAtRoot('git commit -m "' + (commitMessage || 'committing') + '"'); },
  stageFile: function (fileName) { this.runAtRoot('git add "' + fileName + '"'); },

  // Misc
  runAtRoot: function (cmd) {
    var output = run(cmd, { cwd: this.dirName });
    log('Running `' + cmd + '`', output);

    if (output.status !== 0) {
      assert.deepEqual(output.stderr, '');
      throw new Error('Error running "' + cmd + '":' + JSON.stringify(output));
    }
    return output.stdout;
  },
  getDirectory: function() { return this.dirName; },
  delete: function () {
    log('Deleting ' + this.dirName);
    fs.removeSync(this.dirName);
  }
};

module.exports = {
  Repository: Repository
};
