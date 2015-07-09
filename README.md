# stylish-commit [![Build Status](https://travis-ci.org/electronifie/stylish-commit.svg)](https://travis-ci.org/electronifie/stylish-commit)

stylish-commit is a command-line tool and git pre-commit hook that checks your changes using simple lint scripts
written in javascript.

Use it for simple tasks like:
 - converting tabs to spaces
 - [removing trailing whitespace](https://github.com/electronifie/style-guide/blob/master/no-trailing-spaces.js)
 - [detecting usage of `debugger` and `console.log`](https://github.com/electronifie/style-guide/blob/master/no-debugger.js)

## Operation

When you commit some code, the style scripts will be run against all staged changes. If a script has modified
lines you will be prompted to change them, like:
![prompt with changes](http://f.cl.ly/items/1R303o1t1R2j3r2g0m0L/2015-07-07%20at%2010.55%20PM.png)

Here, you have the option to:
 - **ignore the changes** - proceeds with the commit.
 - **apply the changes** - updates files with the recommended changes. This option takes you to
   [another menu](http://f.cl.ly/items/373x3U3A2s1s090j0V0v/2015-07-07%20at%2010.56%20PM.png) with the
   options to *apply and commit*, or *apply and cancel* the commit. This option will only be available if the
   changes can be applied cleanly (i.e. there are no unstaged changes to the file).
 - **cancel the commit** - so you can manually make changes.

## Installation

For node/iojs projects, The hook can be installed automatically by running `npm install stylish-commit-auto-hook-install --save-dev`
in your project's root folder. This will add `stylish-commit-auto-hook-install` to your project's dev-dependencies and
automatically install the hook whenever someone installs dependencies with `npm install`.

You can also install the hook manually by running `npm install stylish-commit -g` then `stylish-commit --install-hook`. If
you take this route, you'll need to manually install the hook for each clone of the project.

## Creating style scripts

Style scripts sit in your project's `.style` directory<sup>[1](#alternative-dir)</sup>, and look like:

```javascript
module.exports = {
  name: 'no-trailing-spaces',
  appliesTo: '**/*.+(js|txt)',
  validate: function (lines) {
    return lines.map(function (line) { return line.replace(/\s+$/, ''); });
  }
};
```

Each style script must have a `name` field and a `validate` function. It can also provide an `appliesTo`
[minimatch glob](https://github.com/isaacs/minimatch) that restricts which modified files it checks.

The `validate` function receives an array of strings, each representing a changed line and is expected to
return an array of the same length with either the unaltered line or a line containing modifications.
e.g. the above script takes  <code>['twas brillig and', 'the slithy &nbsp;&nbsp;&nbsp;', 'toves']</code>
and returns <code>['twas brillig and', 'the slithy', 'toves']`</code>.

There are some scripts to get you started at https://github.com/electronifie/style-guide.

### Alternative script formats

#### Regex search + replace
Runs a regex replace on each line. The `with` property can use dollar-notation (e.g. `$1`) to reference
matching groups. The example below is functionally equivalent to the one above, just a bit easier to read.

```javascript
module.exports = {
  name: 'no-trailing-spaces',
  appliesTo: '**/*.+(js|txt)',
  validate: { replace: /\s+$/, with: '' }
};
```

## Known issues
 - only works when committing from a terminal. The scripts will not run when committing from non-tty
   interfaces like IDEs or git GUIs.
 - does not smartly handle multiple changes to the same line of the same file. In this case, only the
   last script to run's changes will be applied.

<hr>
<sup id="alternative-dir">**1**</sup> or in a custom directory provided by `styleScripts` in `package.json`.
