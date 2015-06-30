var _ = require('lodash');
var Handlebars = require('handlebars'); // https://github.com/wycats/handlebars.js
var inquirer = require('inquirer');     // https://github.com/SBoudrias/Inquirer.js
var jsdiff = require('diff');             // https://github.com/kpdecker/jsdiff

var BASE_MESSAGE = Handlebars.compile(
  'Some suggested changes for your consideration:\n' +
  '{{#fileSuggestions}}' +
  '  {{path}}:\n' +
    '{{#lineSuggestions}}' +
  '    - [{{scriptName}}] {{diff}}\n' +
    '{{/lineSuggestions}}' +
  '{{/fileSuggestions}}'
) ;

var Prompt = function (suggestions) {
  this.suggestions = suggestions;
};

Prompt.prototype = {
  start: function (cb) {
    if (this.suggestions.length === 0) {
      return cb({ action: Prompt.Actions.IGNORE_CHANGES });
    } else {
      this._ask({
        message: BASE_MESSAGE({ fileSuggestions: this._dataForBaseMessage() }),
        choices: ['abort', 'ignore']
      }, function (response) {
        var action;
        switch (response) {
          case 'abort':  action = Prompt.Actions.ABORT_COMMIT; break;
          case 'ignore': action = Prompt.Actions.IGNORE_CHANGES; break;
          default: throw new Error('Unexpected response: ' + response)
        }
        cb({ action: action });
      });
    }
  },

  _dataForBaseMessage: function () {
    return this.suggestions.map(function (suggestion) {
      return {
        path: suggestion.file,
        lineSuggestions: _.chain(suggestion.results).map(function (line) {
          return _.map(line.suggestions, function (scriptSuggestion) {
            return {
              scriptName: scriptSuggestion.scriptName,
              lineNumber: line.lineNumber,
              diff: this._diff(line.text, scriptSuggestion.suggested)
            };
          }.bind(this));
        }.bind(this)).flatten().value()
      }
    }.bind(this));
  },

  _ask: function (question, cb) {

  },

  _diff: function (original, suggested) {
    var diff = jsdiff.diffWordsWithSpace(original, suggested);
    return this._formatDiff(diff);
  },

  _formatDiff: function (diff) {
    return _.reduce(diff, function (memo, change) {
      var indicator = change.added ? '+' : change.removed ? '-' : '';
      return memo + indicator + change.value + indicator;
    }, '');
  }
};

Prompt.Actions = {
  ABORT_COMMIT:   'ABORT',
  IGNORE_CHANGES: 'IGNORE_CHANGES'
};

module.exports = Prompt;
