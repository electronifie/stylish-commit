/**
 * The standard behavior of inquirer is to continue to show
 * questions along with the selected answer once question has
 * been answered.
 *
 * This patches the checkbox and list prompts so they will
 * remove all traces after being answered, making for a
 * less cluttered interface.
 */

var utils = require('inquirer/lib/utils/utils');

var checkbox = require('inquirer/lib/prompts/checkbox');
var oldCheckboxRender = checkbox.prototype.render;
checkbox.prototype.render = function () {
  if (this.status === "answered") {
    utils.writeMessage(this, '');
  } else {
    oldCheckboxRender.apply(this, arguments);
  }
};

var list = require('inquirer/lib/prompts/list');
var oldListRender = list.prototype.render;
list.prototype.render = function () {
  if (this.status === "answered") {
    utils.writeMessage(this, '');
  } else {
    oldListRender.apply(this, arguments);
  }
};
