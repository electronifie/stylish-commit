var _ = require('lodash');
var fs = require('fs');
var log = require('debug')('stylish-commit.lib.Repository');
var path = require('path');
var parseDiff = require('parse-diff');
var run = require('sync-exec');
var sanitizeFilename = function (fn) { return fn.replace(/([$`"])/g, '\\$1'); };

var Repository = function (options) {
  options = options || {};
  this.rootDirectory = options.rootDirectory || run('git rev-parse --show-toplevel').stdout.replace(/^\s+/, '').replace(/\s+$/, '');

  if (!this.rootDirectory) {
    log('ERROR: could not find root directory.');
  }
};

Repository.prototype = {
  installPrecommitHook: function () {

    var destination = path.resolve(this.rootDirectory, '.git/hooks/pre-commit');
    if (fs.existsSync(destination)) {
      console.log('A precommit-hook is already installed. You will need to remove it from .git/hooks/pre-commit before proceeding.');
      console.log('Can not continue.');
      process.exit(1);
    }

    var hookScriptTemplatePath = path.resolve(__dirname, '../resources/precommit-hook');
    log('Installing precommit hook from ' + hookScriptTemplatePath);
    this._run('mkdir -p .git/hooks');
    this._run('cp "' + sanitizeFilename(hookScriptTemplatePath) + '" "' + sanitizeFilename(destination) + '"');
    this._run('chmod +x "' + sanitizeFilename(destination) + '"');
    console.log('Precommit hook installed.');
  },

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
