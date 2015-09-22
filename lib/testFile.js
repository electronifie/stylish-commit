var fs = require('fs');
var log = require('debug')('stylish-commit.lib.testFile');
var path = require('path');
var Prompt = require('./Prompt');
var Repository = require('./Repository');
var run = require('sync-exec');
var ScriptLoader = require('./ScriptLoader');
var ScriptRunner = require('./ScriptRunner');

module.exports = function (filePath) {
  var repository = new Repository();
  var packagePath = path.join(repository.rootDirectory || __dirname, 'package.json');
  var scriptLoader = new ScriptLoader(packagePath);
  var scriptRunner = new ScriptRunner(scriptLoader.getScripts());

  var absFilePath = path.resolve(__dirname, filePath);
  var fileContents = fs.readFileSync(absFilePath, { encoding: 'utf8' });
  var modifiedLines = fileContents.split('\n').map(function (text, lineNumber) { return { lineNumber: lineNumber, text: text }; });
  var diffs = [{
    file: filePath,
    canBeApplied: true,
    modifiedLines: modifiedLines
  }];
  log('== Got diffs ==\n', JSON.stringify(diffs, null, 2), '\n');

  var suggestions = scriptRunner.run(diffs);
  log('== Got suggestions ==\n', JSON.stringify(suggestions, null, 2), '\n');

  var prompt = new Prompt(suggestions);
  prompt.start(function (result) {
    log('== Got prompt result ==\n', JSON.stringify(result, null, 2), '\n');

    switch (result.action) {
      case Prompt.Actions.ABORT_COMMIT:
        log('Aborting.');
        process.exit(1);
        break;

      case Prompt.Actions.IGNORE_CHANGES:
        log('Ignoring.');
        process.exit(0);
        break;

      case Prompt.Actions.APPLY_CHANGES:
        log('Applying.');
        console.log('Skipping apply (testing).');
        process.exit(0);
        break;

      default:
        throw new Error('Unknown action: ' + result.action);
    }
  });
};
