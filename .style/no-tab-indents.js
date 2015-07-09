var _ = require('lodash');
var TAB_SIZE = 2;

module.exports = {
  name: 'no-tab-indents',
  validate: { replace: /^\t*/, with: function (match) { return _.padLeft('', TAB_SIZE * match.length); } }
};
