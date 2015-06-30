var log = require('debug')('stylish-commit.lib.run');
var path = require('path');
var Prompt = require('./Prompt');
var Repository = require('./Repository');
var ScriptLoader = require('./ScriptLoader');
var ScriptRunner = require('./ScriptRunner');

module.exports = function () {
  var repository = new Repository();

  // Assume for now the package is in the root directory. TODO: fallback to the current directory
  var packagePath = path.join(repository.rootDirectory || this.__dirname, 'package.json');
  var scriptLoader = new ScriptLoader(packagePath);
  var scriptRunner = new ScriptRunner(scriptLoader.getScripts());

  var diffs = repository.stagedChanges();
  var suggestions = scriptRunner.run(diffs);
  var prompt = new Prompt(suggestions);

  prompt.start(function (result) {
    switch (result.action) {
      case Prompt.Actions.ABORT_COMMIT:
        log('Aborting.');
        process.exit(1);
        break;
      case Prompt.Actions.IGNORE_CHANGES:
        log('Ignoring.');
        process.exit(0);
        break;
      default:
        throw new Error('Unknown action: ' + result.action);
    }
  });
};
