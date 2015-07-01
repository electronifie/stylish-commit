var colors = require('colors/safe');
colors.enabled = false;

var _ = require('lodash');
var assert = require('chai').assert;
var log = require('debug')('stylish-commit.test');
var path = require('path');
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

    it('installs and removes a git pre-commit hook', function () {
      var repositoryRoot = temporaryRepository.getDirectory();
      var repository = new Repository({
        rootDirectory: repositoryRoot
      });

      repository.installPrecommitHook();
      var precommitFileContents = temporaryRepository.getFileContents('.git/hooks/pre-commit');
      assert.include(precommitFileContents, 'stylish-commit precommit hook');

      repository.uninstallPrecommitHook();
      assert.notOk(temporaryRepository.containsFile('.git/hooks/pre-commit'));
    });

    it('automatically installs and removes a git pre-commit hook on npm install/remove', function () {
      this.timeout(10000);
      temporaryRepository.createFile('package.json', '{ "name": "test", "version": "0.0.1" }');

      assert.notOk(temporaryRepository.containsFile('.git/hooks/pre-commit'));

      var moduleRoot = path.dirname(__dirname);
      temporaryRepository.runAtRoot('npm install --save "' + moduleRoot + '"');
      var precommitFileContents = temporaryRepository.getFileContents('.git/hooks/pre-commit');
      assert.include(precommitFileContents, 'stylish-commit precommit hook');

      temporaryRepository.runAtRoot('npm uninstall --save stylish-commit');
      assert.notOk(temporaryRepository.containsFile('.git/hooks/pre-commit'));
    });

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
          canBeApplied: false,
          modifiedLines: [ { lineNumber: 1, text: 'foo1' }, { lineNumber: 3, text: 'bing1' } ]
        }]
      );
    });

    it('writes and stages the changes', function () {
      temporaryRepository.createFile('./foo.js', '1\n2\n3\n4');
      temporaryRepository.stageFile('./foo.js');
      temporaryRepository.commit();

      temporaryRepository.updateFile('./foo.js', '1\n2 X \n3\n4x');
      temporaryRepository.stageFile('./foo.js');
      temporaryRepository.createFile('./bar.js', '  A\n\nC\n');
      temporaryRepository.stageFile('./bar.js');

      var repositoryRoot = temporaryRepository.getDirectory();
      var repository = new Repository({
        rootDirectory: repositoryRoot
      });

      repository.applySuggestions([
        { file: './foo.js', lineNumber: 2, oldText: '2 X ', newText: '2 x' },
        { file: './foo.js', lineNumber: 4, oldText: '4x', newText: '4' },
        { file: './bar.js', lineNumber: 3, oldText: 'C', newText: 'CX' }
      ]);

      assert.deepEqual(
        repository.stagedChanges(),
        [ {
          file: 'bar.js',
          canBeApplied: true,
          modifiedLines: [
            { lineNumber: 1, text: '  A' },
            { lineNumber: 2, text: '' },
            { lineNumber: 3, text: 'CX' }
          ]
        }, {
          file: 'foo.js',
          canBeApplied: true,
          modifiedLines: [ { lineNumber: 2, text: '2 x' } ]
        }]
      );
    });

    it('does not allow changes to be applide if there is a staged file that also has unstaged changes', function () {
      temporaryRepository.createFile('./foo.js', 'foo\nbar');
      temporaryRepository.stageFile('./foo.js');
      temporaryRepository.createFile('./bar.js', 'foo');
      temporaryRepository.stageFile('./bar.js');
      temporaryRepository.updateFile('./foo.js', 'foo1\nbar');

      var repositoryRoot = temporaryRepository.getDirectory();
      var repository = new Repository({
        rootDirectory: repositoryRoot
      });

      assert.deepEqual(
        repository.stagedChanges(),
        [{
          file: 'bar.js',
          canBeApplied: true,
          modifiedLines: [ { lineNumber: 1, text: 'foo' } ]
        }, {
          file: 'foo.js',
          canBeApplied: false,
          modifiedLines: [ { lineNumber: 1, text: 'foo' }, { lineNumber: 2, text: 'bar' } ]
        }]
      );
    });
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
        { file: 'foo.js', canBeApplied: true, modifiedLines: [{ lineNumber: 1, text: '  foo   ' }] },
        { file: 'bar.js', canBeApplied: false, modifiedLines: [{ lineNumber: 2, text: 'bar' }, { lineNumber: 3, text: 'bar     ' }, { lineNumber: 4, text: ' bar    bar ' }] },
        { file: 'bop.js', canBeApplied: false, modifiedLines: [{ lineNumber: 4, text: 'bop' }] }
      ];

      var scriptRunner = new ScriptRunner(scripts);
      var result = scriptRunner.run(diff);

      assert.deepEqual(
        result,
        [{
          file: 'foo.js',
          canBeApplied: true,
          results: [{ lineNumber: 1, text: '  foo   ', suggestions: [{ scriptName: 'trailingLineTrimmer', suggested: '  foo'}] }]
        }, {
          file: 'bar.js',
          canBeApplied: false,
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
        canBeApplied: false,
        results: [{ lineNumber: 1, text: 'AA AA', suggestions: [{ scriptName: 'TEST_SCRIPT_1', suggested: 'AA BB AA' }] }]
      }, {
        file: 'bar.js',
        results: [
          { lineNumber: 1, text: 'BB', suggestions: [{ scriptName: 'TEST_SCRIPT_2', suggested: 'CC' }] },
          { lineNumber: 2, text: 'DD', suggestions: [{ scriptName: 'TEST_SCRIPT_1', suggested: 'DDE' }] }
        ]
      }];

      var expectedScript = [
        {
          message: 'Recommended changes (can not be automatically applied):\n' +
                   '  - [TEST_SCRIPT_1] foo.js:1  AA +BB +AA\n' +
                   '  - [TEST_SCRIPT_2] bar.js:1  -BB-+CC+\n' +
                   '  - [TEST_SCRIPT_1] bar.js:2  DD+E+\n',
          choices: ['ignore changes', 'abort commit'],
          replyWith: 'abort commit'
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
  });
});
