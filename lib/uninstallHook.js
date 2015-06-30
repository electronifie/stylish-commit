var Repository = require('./Repository');

module.exports = function () {
  var repository = new Repository();
  repository.uninstallPrecommitHook();
};
