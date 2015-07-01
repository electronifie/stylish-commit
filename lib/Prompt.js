var _ = require('lodash');
var colors = require('colors/safe');                                              // https://github.com/marak/colors.js/
var Handlebars = require('handlebars');                                       // https://github.com/wycats/handlebars.js
var inquirer = require('inquirer');                                          // https://github.com/SBoudrias/Inquirer.js
var log = require('debug')('stylish-commit.lib.Prompt');
var jsdiff = require('diff');                                                      // https://github.com/kpdecker/jsdiff

var MAIN_MESSAGE = Handlebars.compile(colors.reset(
  colors.bold(       'Recommended changes ({{applicationMessage}}):\n') +
                     '{{#suggestions}}' +
  colors.reset.gray( '  - [{{scriptName}}] {{location}}  {{{diff}}}\n' )+
                     '{{/suggestions}}'
));

var CONFIRM_APPLY_MESSAGE = Handlebars.compile(colors.reset(
  'Applying suggestions is an experimental feature. It is ' + colors.red('highly recommended') +
  ' you check the changes before committing them.\n\n' +
  'How do you wish to proceed?'
));

var Prompt = function (suggestions) {
  this.suggestions = suggestions;
  this.canApplySuggestions = this._canApplySuggestions();
};

Prompt.prototype = {
  start: function (cb) {
    if (this.suggestions.length === 0) {
      log('No suggestions found. Proceeding with ignore.');
      return cb({ action: Prompt.Actions.IGNORE_CHANGES });
    } else {
      this._askMain(function (err, mainAction) {
        if (err) throw err;
        switch (mainAction) {
          case Prompt.Actions.APPLY_CHANGES:
            this._askApplyConfirm(function (err, applyConfirmAction, payload) {
              if (err) throw err;
              return cb({ action: applyConfirmAction, payload: payload });
            });
            break;
          default:
            return cb({ action: mainAction, payload: null });
        }
      }.bind(this))
    }
  },

  _askMain: function (cb) {
    log('Prompting with main message.');
    this._ask({
      name: 'main',
      type: 'list',
      message: MAIN_MESSAGE(this._dataForMainMessage()),
      choices: _.compact(['ignore changes', this.canApplySuggestions ? 'apply changes' : '', 'cancel commit'])
    }, function (response) {
      switch (response) {
        case 'cancel commit': return cb(null, Prompt.Actions.ABORT_COMMIT); break;
        case 'apply changes': return cb(null, Prompt.Actions.APPLY_CHANGES); break;
        case 'ignore changes': return cb(null, Prompt.Actions.IGNORE_CHANGES); break;
        default: return cb(new Error('Unexpected response: ' + response)); break;
      }
    });
  },

  _askApplyConfirm: function (cb) {
    log('Prompting to confirm apply intent.');
    this._ask({
      name: 'applyConfirm',
      type: 'list',
      message: CONFIRM_APPLY_MESSAGE({ }),
      choices: _.compact(['apply changes and cancel commit', 'apply changes and commit', 'ignore changes', 'cancel commit'])
    }, function (response) {

      switch (response) {
        case 'apply changes and cancel commit':
          return cb(null,
            Prompt.Actions.APPLY_CHANGES,
            { suggestions: this._suggestionsToApply(), abortCommit: true }
          );
          break;
        case 'apply changes and commit':
          return cb(null,
            Prompt.Actions.APPLY_CHANGES,
            { suggestions: this._suggestionsToApply(), abortCommit: false }
          );
          break;
        case 'ignore changes': return cb(null, Prompt.Actions.IGNORE_CHANGES, null); break;
        case 'cancel commit': return cb(null, Prompt.Actions.ABORT_COMMIT, null); break;
        default: return cb(new Error('Unexpected response: ' + response)); break;
      }
    }.bind(this));
  },

  _canApplySuggestions: function () {
    return !_.find(this.suggestions, function (suggestion) { return !suggestion.canBeApplied; });
  },

  _suggestionsToApply: function () {
    var suggestions = _.chain(this.suggestions).map(function (suggestion) {
      return _.chain(suggestion.results).map(function (line) {
        return _.map(line.suggestions, function (scriptSuggestion) {
          return {
            file: suggestion.file,
            lineNumber: line.lineNumber,
            oldText: line.text,
            newText: scriptSuggestion.suggested
          };
        }.bind(this));
      }.bind(this)).flatten().value();
    }.bind(this)).flatten().value();

    return suggestions;
  },

  _dataForMainMessage: function () {
    var maxScriptNameLength = 0;
    var maxLocationNameLength = 0;

    var suggestions = _.chain(this.suggestions).map(function (suggestion) {
      return _.chain(suggestion.results).map(function (line) {
          return _.map(line.suggestions, function (scriptSuggestion) {
            var scriptName = scriptSuggestion.scriptName;
            var locationName = suggestion.file + ':' + line.lineNumber;

            maxScriptNameLength = _.max([maxScriptNameLength, scriptName.length]);
            maxLocationNameLength = _.max([maxLocationNameLength, locationName.length]);

            return {
              scriptName: scriptName,
              location: locationName,
              diff: this._diff(line.text, scriptSuggestion.suggested)
            };
          }.bind(this));
        }.bind(this)).flatten().value();
    }.bind(this)).flatten().value();

    _.each(suggestions, function (suggestion) {
      suggestion.scriptName = _.padRight(suggestion.scriptName, maxScriptNameLength);
      suggestion.location =   _.padRight(suggestion.location, maxLocationNameLength);
    });

    return { suggestions: suggestions, applicationMessage: 'can ' + (this.canApplySuggestions ? '' : colors.red('not ')) + 'be automatically applied' };
  },

  _ask: function (question, cb) {
    inquirer.prompt([question], function (answers) { cb(answers[question.name]); });
  },

  _diff: function (original, suggested) {
    var diff = jsdiff.diffChars(original, suggested);
    return this._formatDiff(diff);
  },

  _formatDiff: function (diff) {
    var diffText = _.reduce(diff, function (memo, change) {
      //var indicator = change.added ? colors.reset.green : change.removed colors.reset.red ? '-' : '';

      var changeText = change.value;
      if (change.added) {
        changeText = colors.reset.bgGreen.white(changeText);
      } else if (change.removed) {
        changeText = colors.reset.bgRed.white(changeText);
      } else {
        changeText = colors.reset.bgBlack.white(changeText);
      }

      return memo + changeText;
    }, '');
    return diffText;
  }
};

Prompt.Actions = {
  ABORT_COMMIT:   'ABORT',
  IGNORE_CHANGES: 'IGNORE_CHANGES',
  APPLY_CHANGES: 'APPLY_CHANGES'
};

module.exports = Prompt;
