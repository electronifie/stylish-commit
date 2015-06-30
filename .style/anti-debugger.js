module.exports = {
  name: 'anti-debugger',
  validate: function (lines) {
    return lines.map(function (line) { return line.replace(/\s*debugger;\s*/, ''); });
  }
};
