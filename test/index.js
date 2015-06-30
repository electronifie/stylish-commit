var _ = require('lodash');
var assert = require('chai').assert;
var log = require('debug')('stylish-commit.test');
var Prompt = require('../lib/Prompt');
var Repository = require('../lib/Repository');
var ScriptLoader = require('../lib/ScriptLoader');
var ScriptRunner = require('../lib/ScriptRunner');
var TemporaryRepository = require('./_helpers').Repository;

describe('stylish-commit', function () {
  describe('git integration', function () {
    var temporaryRepository = null;
    beforeEach(function () { temporaryRepository = new TemporaryRepository(); });
    afterEach(function () { temporaryRepository.delete(); });

    it('installs a git pre-commit hook');

    it('only runs scripts against staged commits', function () {
      temporaryRepository.createFile('./foo.js', 'foo\nbar\nbing\nbop');
      temporaryRepository.stageFile('./foo.js');
      temporaryRepository.commit();

      temporaryRepository.createFile('./bar.js', 'bar');
      temporaryRepository.updateFile('./foo.js', 'foo1\nbar\nbing1\nbop');
      temporaryRepository.stageFile('./foo.js');
      temporaryRepository.updateFile('./foo.js', 'foo\nbar2\nbing1\nbop');

      var repositoryRoot = temporaryRepository.getDirectory();
      var repository = new Repository({
        rootDirectory: repositoryRoot
      });

      assert.deepEqual(
        repository.stagedChanges(),
        [{
          file: 'foo.js',
          modifiedLines: [ { lineNumber: 1, text: 'foo1' }, { lineNumber: 3, text: 'bing1' } ]
        }]
      );
    });

    it('writes and stages the changes');
  });

  describe('finding script files', function () {
    it('reads all scripts from the ".style" directory by default', function () {
      var scriptLoader = new ScriptLoader(__dirname + '/fixtures/script-discovery-via-default/package.json');
      var scripts = scriptLoader.getScripts();
      var scriptNames = _.pluck(scripts, 'name');
      assert.deepEqual(scriptNames, ['Style Script 1', 'Style Script 2']);
    });

    it('reads scripts from a custom directory when "styleScripts" is provided in package.json', function () {
      var scriptLoader = new ScriptLoader(__dirname + '/fixtures/script-discovery-via-package/package.json');
      var scripts = scriptLoader.getScripts();
      var scriptNames = _.pluck(scripts, 'name');
      assert.deepEqual(scriptNames, ['Style Script 3', 'Style Script 4']);
    });
  });

  describe('validation', function () {
    it('only calls a script\'s validate() method if the filename matches the "appliesTo" field', function () {
      var jsScriptCalled = 0;
      var mdScriptCalled = 0;
      var coffeeScriptCalled = 0;
      var allScriptCalled = 0;
      var scripts = [
        { name: 'jsValidator',     appliesTo: '*.js',     validate: function (lines) { jsScriptCalled++;     return lines; } },
        { name: 'mdValidator',     appliesTo: '*.md',     validate: function (lines) { mdScriptCalled++;     return lines; } },
        { name: 'coffeeValidator', appliesTo: '*.coffee', validate: function (lines) { coffeeScriptCalled++; return lines; } },
        { name: 'allValidator',                           validate: function (lines) { allScriptCalled++;    return lines; } }
      ];

      var diff = [
        { file: 'foo.js', modifiedLines: [{ lineNumber: 3, text: 'foo' }] },
        { file: 'bar.js', modifiedLines: [{ lineNumber: 1, text: 'bop' }] },
        { file: 'bar.md', modifiedLines: [{ lineNumber: 1, text: 'bat' }] }
      ];

      var scriptRunner = new ScriptRunner(scripts);
      scriptRunner.run(diff);

      assert.equal(jsScriptCalled, 2);
      assert.equal(mdScriptCalled, 1);
      assert.equal(coffeeScriptCalled, 0);
      assert.equal(allScriptCalled, 3);
    });

    it('detects differences between what validate() returns and what was provided', function () {
      var scripts = [{
        name: 'trailingLineTrimmer',
        validate: function (lines) {
          return lines.map(function (line) { return line.replace(/\s+$/, ''); });
        }
      }];

      var diff = [
        { file: 'foo.js', modifiedLines: [{ lineNumber: 1, text: '  foo   ' }] },
        { file: 'bar.js', modifiedLines: [{ lineNumber: 2, text: 'bar' }, { lineNumber: 3, text: 'bar     ' }, { lineNumber: 4, text: ' bar    bar ' }] },
        { file: 'bop.js', modifiedLines: [{ lineNumber: 4, text: 'bop' }] }
      ];

      var scriptRunner = new ScriptRunner(scripts);
      var result = scriptRunner.run(diff);

      assert.deepEqual(
        result,
        [{
          file: 'foo.js',
          results: [{ lineNumber: 1, text: '  foo   ', suggestions: [{ scriptName: 'trailingLineTrimmer', suggested: '  foo'}] }]
        }, {
          file: 'bar.js',
          results: [
            { lineNumber: 3, text: 'bar     ',     suggestions: [{ scriptName: 'trailingLineTrimmer', suggested: 'bar' }] },
            { lineNumber: 4, text: ' bar    bar ', suggestions: [{ scriptName: 'trailingLineTrimmer', suggested: ' bar    bar' }] }
          ]
        }]
      );
    });
  });

  describe('interaction', function () {

    it('does not prompt if there are no suggestions', function (done) {
      var prompt = new Prompt([]);
      prompt.start(function (actionMessage) {
        assert.deepEqual(actionMessage.action, Prompt.Actions.IGNORE_CHANGES);
        done();
      });
    });

    it('lets you abort the commit', function (done) {
      var suggestions = [{
        file: 'foo.js',
        results: [{ lineNumber: 1, text: 'AA AA', suggestions: [{ scriptName: 'TEST_SCRIPT_1', suggested: 'AA BB AA' }] }]
      }, {
        file: 'bar.js',
        results: [
          { lineNumber: 1, text: 'BB', suggestions: [{ scriptName: 'TEST_SCRIPT_2', suggested: 'CC' }] },
          { lineNumber: 1, text: 'DD', suggestions: [{ scriptName: 'TEST_SCRIPT_1', suggested: 'DDE' }] }
        ]
      }];

      var expectedScript = [
        {
          message: 'Some suggested changes for your consideration:\n' +
                   '  foo.js:\n' +
                   '    - [TEST_SCRIPT_1] AA +BB +AA\n' +
                   '  bar.js:\n' +
                   '    - [TEST_SCRIPT_2] -BB-+CC+\n' +
                   '    - [TEST_SCRIPT_1] -DD-+DDE+\n',
          choices: ['abort', 'ignore'],
          replyWith: 'abort'
        }
      ];

      var prompt = new Prompt(suggestions);

      prompt._ask = function (question, cb) {
        var expected = expectedScript.pop();
        assert.deepEqual(question.message, expected.message);
        assert.deepEqual(question.choices, expected.choices);
        cb(expected.replyWith);
      };

      prompt._formatDiff = function (diff) {
        return _.reduce(diff, function (memo, change) {
          var indicator = change.added ? '+' : change.removed ? '-' : '';
          return memo + indicator + change.value + indicator;
        }, '');
      };

      prompt.start(function (actionMessage) {
        assert.deepEqual(actionMessage.action, Prompt.Actions.ABORT_COMMIT);
        done();
      });
    });
    it('prompts whether to apply the suggested changes');
    it('lets you accept all changes, or iterate through individual changes');
    it('only prompts to apply changes if they can be cleanly applied');
  });
});
