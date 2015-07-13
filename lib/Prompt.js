require('./_inquirerPatch');

var _ = require('lodash');
var colors = require('colors/safe');                                               // https://github.com/marak/colors.js
var figures = require('figures');                                             // https://github.com/sindresorhus/figures
var Handlebars = require('handlebars');                                       // https://github.com/wycats/handlebars.js
var inquirer = require('inquirer');                                          // https://github.com/SBoudrias/Inquirer.js
var log = require('debug')('stylish-commit.lib.Prompt');
var jsdiff = require('diff');                                                      // https://github.com/kpdecker/jsdiff

var SUGGESTION_TEMPLATE = colors.reset.gray( '{{selectionMarker}} [{{scriptName}}] {{location}}  {{{diff}}}' );

var MAIN_MESSAGE = Handlebars.compile(colors.reset(
  colors.bold(       'Suggested changes ({{applicationMessage}}):\n') +
                     '{{#suggestions}}' +
                       '  ' + SUGGESTION_TEMPLATE + '\n' +
                     '{{/suggestions}}'
));

var SUGGESTION_MESSAGE = Handlebars.compile(SUGGESTION_TEMPLATE);

var CONFIRM_APPLY_MESSAGE = Handlebars.compile(colors.reset(
  'Applying suggestions is an experimental feature. It is ' + colors.yellow('highly recommended') +
  ' you check the changes before committing them.\n\n' +
  'How do you wish to proceed?'
));

var SELECT_APPLY_MESSAGE = Handlebars.compile(colors.reset('Select suggestions to apply (space to toggle, enter to go back):'));

var Prompt = function (suggestions) {
  this.suggestions = suggestions;
  this.suggestionsToIgnore = [];
  this.canApplySuggestions = this._canApplySuggestions();
};

Prompt.prototype = {
  start: function (cb) {
    if (this.suggestions.length === 0) {
      log('No suggestions found. Proceeding with ignore.');
      return cb({ action: Prompt.Actions.IGNORE_CHANGES });
    }

    // @recursive
    var doMainPrompt = function () {
      this._askMain(function (err, mainAction) {
        if (err) throw err;
        switch (mainAction) {
          case Prompt.Actions.SELECT_CHANGES:
            this._askSelect(function (err) {
              if (err) throw err;
              doMainPrompt();
            }.bind(this));
            break;
          case Prompt.Actions.APPLY_CHANGES:
            this._askApplyConfirm(function (err, applyConfirmAction, payload) {
              if (err) throw err;
              return cb({ action: applyConfirmAction, payload: payload });
            }.bind(this));
            break;
          default:
            return cb({ action: mainAction, payload: null });
        }
      }.bind(this));
    }.bind(this);

    doMainPrompt();
  },

  _askMain: function (cb) {
    log('Prompting with main message.');

    var numberOfChanges = this._suggestionsToApply().length;

    var IGNORE_CHANGES = 'continue (ignores suggestions)';
    var APPLY_CHANGES = this.canApplySuggestions ? 'apply ' + colors.bold(numberOfChanges) + ' suggestion' + (numberOfChanges === 1 ? '' : 's') : '';
    var SELECT_CHANGES = this.canApplySuggestions ? 'select suggestions to apply' : '';
    var ABORT = 'cancel';

    this._ask({
      name: 'main',
      type: 'list',
      message: MAIN_MESSAGE(this._dataForMainMessage()),
      choices: _.compact([IGNORE_CHANGES, APPLY_CHANGES, SELECT_CHANGES, ABORT])
    }, function (response) {
      switch (response) {
        case IGNORE_CHANGES: return cb(null, Prompt.Actions.IGNORE_CHANGES); break;
        case APPLY_CHANGES:  return cb(null, Prompt.Actions.APPLY_CHANGES); break;
        case SELECT_CHANGES: return cb(null, Prompt.Actions.SELECT_CHANGES); break;
        case ABORT:          return cb(null, Prompt.Actions.ABORT_COMMIT); break;
        default:             return cb(new Error('Unexpected response: ' + response)); break;
      }
    });
  },

  _askSelect: function (cb) {
    log('Prompting to select suggestions to apply.');

    var choices = this._dataForSuggestionMessages({ showSelected: false }).map(function (s, i) {
      return {
        name: SUGGESTION_MESSAGE(s),
        checked: !_.contains(this.suggestionsToIgnore, i),
        value: i
      };
    }.bind(this));

    this._ask({
      name: 'applySelect',
      type: 'checkbox',
      message: SELECT_APPLY_MESSAGE({ }),
      choices: choices
    }, function (response) {
      this.suggestionsToIgnore = _.xor(_.range(0, choices.length), response);
      cb();
    }.bind(this));
  },

  _askApplyConfirm: function (cb) {
    log('Prompting to confirm apply intent.');

    var suggestions = this._suggestionsToApply();

    var APPLY = 'apply ' + colors.bold(suggestions.length) + ' suggestion' + (suggestions.length === 1 ? '' : 's');

    var APPLY_AND_CANCEL = APPLY + ' and cancel commit';
    var APPLY_AND_COMMIT = APPLY + ' and commit';
    var IGNORE_CHANGES = 'commit only (ignores suggestions)';
    var ABORT = 'cancel';

    this._ask({
      name: 'applyConfirm',
      type: 'list',
      message: MAIN_MESSAGE(this._dataForMainMessage()) + '\n' + CONFIRM_APPLY_MESSAGE({ }),
      choices: _.compact([APPLY_AND_CANCEL, APPLY_AND_COMMIT, IGNORE_CHANGES, ABORT])
    }, function (response) {

      switch (response) {
        case APPLY_AND_CANCEL:
          return cb(null,
            Prompt.Actions.APPLY_CHANGES,
            { suggestions: suggestions, abortCommit: true }
          );
        case APPLY_AND_COMMIT:
          return cb(null,
            Prompt.Actions.APPLY_CHANGES,
            { suggestions: suggestions, abortCommit: false }
          );
        case IGNORE_CHANGES:
          return cb(null, Prompt.Actions.IGNORE_CHANGES, null);
        case ABORT:
          return cb(null, Prompt.Actions.ABORT_COMMIT, null);
        default:
          return cb(new Error('Unexpected response: ' + response));
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

    var suggestionsWithoutIgnored = _.reject(suggestions, function (suggestion, i) {
      return _.contains(this.suggestionsToIgnore, i);
    }.bind(this));

    return suggestionsWithoutIgnored;
  },

  _dataForMainMessage: function () {
    return {
      suggestions: this._dataForSuggestionMessages({ showSelected: this.canApplySuggestions }),
      applicationMessage: 'can ' + (this.canApplySuggestions ? '' : colors.red('not ')) + 'be automatically applied'
    };
  },

  _dataForSuggestionMessages: function (options) {
    var showSelected = options.showSelected;

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

    _.each(suggestions, function (suggestion, i) {
      suggestion.scriptName = _.padRight(suggestion.scriptName, maxScriptNameLength);
      suggestion.location =   _.padRight(suggestion.location, maxLocationNameLength);
      suggestion.selectionMarker = showSelected ? (_.includes(this.suggestionsToIgnore, i) ? colors.grey(figures.radioOff) : colors.green(figures.radioOn)) : ''
    }.bind(this));

    return suggestions;
  },

  _ask: function (question, cb) {

    var prompt = inquirer.prompt([question], function (answers) { cb(answers[question.name]); });
    prompt.clean(100);
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
  APPLY_CHANGES:  'APPLY_ALL_CHANGES',
  SELECT_CHANGES: 'APPLY_SOME_CHANGES'
};

module.exports = Prompt;
