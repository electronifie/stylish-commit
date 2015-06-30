module.exports = {
  name: 'trailing-space-trimmer',
  validate: function (lines) {
    return lines.map(function (line) { return line.replace(/\s+$/, ''); });  
  }
};
