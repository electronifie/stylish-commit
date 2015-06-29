var _ = require('lodash');
var assert = require('chai').assert;
var TemporaryRepository = require('./_helpers').Repository;
var Repository = require('../lib/Repository.js');
var ScriptLoader = require('../lib/ScriptLoader.js');

describe('stylish-commit', function () {
  describe('git integration', function () {
    var temporaryRepository = null;
    beforeEach(function () { temporaryRepository = new TemporaryRepository(); });
    afterEach(function () { temporaryRepository.delete(); });

    it('installs a git pre-commit hook');

    it('only run scripts against staged commits', function () {
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

    it('lets you abort the commit if you ignore changes');
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
    it('only calls a script\'s validate() method if the filename matches the "appliesTo" field');
    it('detects differences between what validate() returns and what was provided');
    it('allows validate() to return null, indicating there are no changes to be made');
    it('prompts whether to apply the suggested changes');
    it('lets you accept all changes, or iterate through individual changes');
    it('writes changes to a file, and stages the changes');
  });
});
