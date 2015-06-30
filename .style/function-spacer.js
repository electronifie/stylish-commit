module.exports = {
  name: 'function-spacer',
  validate: function (lines) {
    return lines.map(function (line) { return line.replace(/function\(/, 'function ('); });
  }
};
