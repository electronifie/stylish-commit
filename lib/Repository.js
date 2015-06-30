var _ = require('lodash');
var log = require('debug')('stylish-commit.lib.Repository');
var parseDiff = require('parse-diff');
var run = require('sync-exec');

var Repository = function (options) {
  options = options || {};
  this.rootDirectory = options.rootDirectory || run('git rev-parse --show-toplevel').stdout.replace(/^\s+/, '').replace(/\s+$/, '');

  if (!this.rootDirectory) {
    log('ERROR: could not find root directory.');
  }
};

Repository.prototype = {
  stagedChanges: function () {
    var output = this._run('git diff --cached -U0 --minimal --no-color');

    var parsedDiff = parseDiff(output);
    log('Parsed diff: ', parsedDiff);

    // Generate a list of changed files
    var files = _.chain(parsedDiff)
      .filter(function (file) { return file.additions > 0; })
      .map(function (file) {

        // Convert each line
        var modifiedLines = _.chain(file.lines)
          .filter(function (line) { return line.type === 'add' })
          .map(function (line) {
            return {
              lineNumber: line.ln,
              text: line.content.replace(/^\+/, '')
            }
          })
          .value();
        log('Lines for file ' + file.to, modifiedLines);

        return {
          file: file.to,
          modifiedLines: modifiedLines
        }
      })
      .value();

    return files;
  },

  _run: function (cmd) {
    var output = run(cmd, { cwd: this.rootDirectory });
    log('Running `' + cmd + '`');
    log('==OUTPUT==');
    log(output.stdout);
    log(output.stderr);
    log('==------==');
    if (output.status !== 0) { throw new Error('Error running "' + cmd + '":' + JSON.stringify(output)); }
    return output.stdout;
  },
};

module.exports = Repository;
