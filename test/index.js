var assert = require('chai').assert;

describe('stylish-commit', function () {
  describe('git integration', function () {
    it('installs a git pre-commit hook');
    it('only run scripts against staged commits');
    it('lets you abort the commit if you ignore changes');
  });

  describe('finding script files', function () {
    it('reads all scripts from the ".style" directory by default');
    it('reads scripts from a custom directory when "styleScripts" is provided in package.json');
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
