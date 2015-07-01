var _ = require('lodash');
var fs = require('fs');
var log = require('debug')('stylish-commit.lib.Repository');
var path = require('path');
var parseDiff = require('parse-diff');
var run = require('sync-exec');
var sanitizeFilename = function (fn) { return fn.replace(/([$`"])/g, '\\$1'); }; // pretty naive

var Repository = function (options) {
  options = options || {};
  this.rootDirectory = options.rootDirectory || run('git rev-parse --show-toplevel').stdout.replace(/^\s+/, '').replace(/\s+$/, '');

  if (!this.rootDirectory) {
    log('ERROR: could not find root directory.');
    return;
  }

  this.hookPath = path.resolve(this.rootDirectory, '.git/hooks/pre-commit');
};

Repository.prototype = {
  _path: function (fileName) { return path.resolve(this.rootDirectory, fileName); },

  uninstallPrecommitHook: function () {
    if (!this.rootDirectory) {
      console.log('Could not find repository root to perform install.');
      console.log('Aborting.');
      process.exit(0);
    }

    if ( fs.existsSync(this.hookPath) ) {
      if ((fs.readFileSync(this.hookPath, { encoding: 'utf8' }).indexOf('stylish-commit precommit hook') >= 0)) {
        this.runAtRoot('rm "' + sanitizeFilename(this.hookPath) + '"');
        console.log('Precommit hook removed.');
      } else {
        console.log('A precommit-hook is installed, but it\'s not stylish-commit. It might be important, so leaving intact.');
        console.log('You will need to remove it from .git/hooks/pre-commit before proceeding.');
        console.log('Aborting.');
        process.exit(1);
      }
    }
  },

  installPrecommitHook: function () {
    if (!this.rootDirectory) {
      console.log('Could not find repository root to perform install.');
      console.log('Aborting.');
      process.exit(0);
    }

    this.uninstallPrecommitHook();

    var destination = this.hookPath;

    var hookScriptTemplatePath = path.resolve(__dirname, '../resources/precommit-hook');
    log('Installing precommit hook from ' + hookScriptTemplatePath);
    this.runAtRoot('mkdir -p .git/hooks');
    this.runAtRoot('cp "' + sanitizeFilename(hookScriptTemplatePath) + '" "' + sanitizeFilename(destination) + '"');
    this.runAtRoot('chmod +x "' + sanitizeFilename(destination) + '"');
    console.log('Precommit hook added.');
  },

  stagedChanges: function () {
    var stagedOutput = this.runAtRoot('git diff --cached -U0 --minimal --no-color');
    var unstagedFiles = this.runAtRoot('git diff --name-only').split('\n').map(_.trim);
    var unstagedFileIndex = _.indexBy(unstagedFiles, function (file) { return file; });

    var parsedDiff = parseDiff(stagedOutput);
    log('Parsed diff: ', parsedDiff);
    log('Unstaged files:', unstagedFiles.join(', '))

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
        log('Lines for %sfile %s: %s', (file.to in unstagedFileIndex) ? '[dirty] ' : '' , file.to, JSON.stringify(modifiedLines));

        return {
          file: file.to,
          canBeApplied: ! (file.to in unstagedFileIndex),
          modifiedLines: modifiedLines
        }
      })
      .value();

    return files;
  },

  applySuggestions: function (suggestions) {
    // Naive implementation. Would be better if we streamed the file, and made
    // multiple changes as it streamed, and if we thought about different encodings
    // and line endings.
    suggestions.forEach(function (suggestion) {
      // TODO: verify the file doesn't have unstaged changes

      var filePath = this._path(suggestion.file);
      var lineNumber = suggestion.lineNumber - 1; // 1 based -> 0 based
      var newText = suggestion.newText;
      var oldText = suggestion.oldText;

      var fileContents = fs.readFileSync(filePath, { encoding: 'utf8' }).split('\n');
      log('Attempting to replace in file %s:', filePath);
      log(' - %s', fileContents[lineNumber]);
      log(' + %s', newText);
      if (fileContents[lineNumber] !== oldText) {
        throw new Error('Expected "' + fileContents[lineNumber] + '" to equal "' + oldText + '"');
      }

      fileContents[lineNumber] = newText;
      fs.writeFileSync(filePath, fileContents.join('\n'), { encoding: 'utf8' });

      this.runAtRoot('git add "' + filePath + '"');
    }.bind(this));
  },

  runAtRoot: function (cmd) {
    var output = run(cmd, { cwd: this.rootDirectory });
    log('Running `' + cmd + '`');
    log('==OUTPUT==');
    log(output.stdout);
    log(output.stderr);
    log('==------==');
    if (output.status !== 0) { throw new Error('Error running "' + cmd + '":' + JSON.stringify(output)); }
    return output.stdout;
  }
};

module.exports = Repository;
