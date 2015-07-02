stylish-commit
==============

Usage:
 1. create a folder called `.style` in your repo root and fill it with scripts that look like:

        .style/trailingWhitespace.js:
        module.exports = {
          name: 'Trailing whitespace',
          description: 'Removes whitespace from the end of a line',
          appliesTo: '*.js',
          validate: function (changedLines) {
            // Return lines the way they should look
            return changedLines.map(function (line) { return line.replace(/\s+$/); });
          }
        };

 1. run `npm install stylish-commit -g` to install stylish-commit globally, then run `stylish-commit --install-hook` to
    install the hook

    or

    run `npm install stylish-commit-auto-hook-install --save-dev` to automatically install the hook every time
    your project's dependencies are installed

**Don't like .style?**

Add a field to package.json called "styleScripts" pointing at whatever folder you desire.

    package.json:
    {
      "name": "Foo project",
      "version": "0.0.1",
      ...
      "styleScripts": "./scripts/style"
    }

**Sample scripts**
 - https://github.com/electronifie/style-guide
