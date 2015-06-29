var _ = require('lodash');
var log = require('debug')('stylish-commit.lib.ScriptRunner');
var minimatch = require('minimatch');

var ScriptRunner = function (scripts) {
  this.scripts = scripts;
};

ScriptRunner.prototype = {
  run: function (fileDiffs) {
    var fileResults = _.map(fileDiffs, function (fileDiff) {
      var lineTexts = _.pluck(fileDiff.modifiedLines, 'text');

      var scriptResults = _.map(this.scripts, function (script) {
        if ( (! script.appliesTo) || minimatch(fileDiff.file, script.appliesTo) ) {
          return {
            scriptName: script.name,
            results: script.validate(lineTexts)
          };
        }
      }.bind(this));

      var failingLineResults = _.map(fileDiff.modifiedLines, function (line, i) {
        var lineText = line.text;
        var failingScriptResults = _.map(scriptResults, function (scriptResult) {
          if (! (scriptResult && scriptResult.results)) {
            return;
          }

          var resultForLine = scriptResult.results[i];
          if ( resultForLine !== lineText ) {
            return {
              scriptName: scriptResult.scriptName,
              suggested: resultForLine
            };
          }
        });

        var compactFailingScriptResults = _.compact(failingScriptResults);
        if (compactFailingScriptResults.length > 0) {
          return {
            lineNumber: line.lineNumber,
            text: line.text,
            suggestions: compactFailingScriptResults
          };
        } else {
          return undefined;
        }
      }.bind(this));

      var compactFailingLineResults = _.compact(failingLineResults);
      return {
        file: fileDiff.file,
        results: compactFailingLineResults
      };
    }.bind(this));

    var filesWithFailures = _.filter(fileResults, function (fileResult) { return fileResult.results.length > 0; })
    return filesWithFailures;
  }
};

module.exports = ScriptRunner;
