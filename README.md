stylish-commit
==============

Usage:
 1. create a folder in your project for validation scripts (calling it `.style` saves you a step)

 1. add a field to package.json called "styleScripts" pointing at the folder (no need to do this if you called it `.style`)

        package.json:
        {
          "name": "Foo barrer",
          "version": "0.0.1",
          ...
          "styleScripts": "./scripts/style"
        }

 1. fill it with scripts that look like:

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

 1. run `npm install stylish-commit --save-dev` to add the dependency and install the pre-commit hook

Sample scripts:
 - https://github.com/electronifie/style-guide
