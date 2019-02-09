'use strict';

const types = require('./types');
const typeValues = Object.keys(types).map(k => types[k]);

function validateOptions(options) {
  if (typeof options !== 'object') {
    throw new Error('Invalid options');
  }

  if (typeof options.fields !== 'object' || Array.isArray(options.fields)) {
    options.fields = {};
  }

  for (let field in options.fields) {
    if (typeValues.indexOf(options.fields[field]) === -1) {
      throw new Error('Invalid field type for field [ ' + field + ' ]');
    }
  }

  if (typeof options.sortKey !== 'string') {
    options.sortKey = 'sort';
  }
  if (typeof options.limitKey !== 'string') {
    options.limitKey = 'limit';
  }
  if (typeof options.skipKey !== 'string') {
    options.skipKey = 'skip';
  }
  if (typeof options.searchKey !== 'string') {
    options.searchKey = 'search';
  }

  return options;
}

module.exports = {
  validateOptions
};
