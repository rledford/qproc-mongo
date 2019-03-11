'use strict';

const types = require('./types');
const trueValues = ['true', '1'];

function convertStringToType(str = '', type = '') {
  switch (type) {
    case types.Date:
      return new Date(str);
    case types.Int:
      return parseInt(str);
    case types.Float:
      return parseFloat(str);
    case types.Boolean:
      return trueValues.indexOf(str.toLowerCase().trim()) >= 0;
    case types.ObjectId:
      if (str.toLowerCase().trim() === 'null') {
        return null;
      }
      return str;
    default:
      return str;
  }
}

function resolveField(k = '', fields = {}) {
  if (fields[k] || k.indexOf('.') === -1) {
    return k;
  }
  const kParts = k.split('.');

  for (const f in fields) {
    const fieldParts = f.split('.');
    if (fieldParts.length !== kParts.length) {
      continue;
    }
    for (let i = 0; i < fieldParts.length; i++) {
      if (fieldParts[i] === '*' || kParts[i] === fieldParts[i]) {
        if (i === fieldParts.length - 1) {
          return f;
        }
      } else {
        break;
      }
    }
  }
  return k;
}

module.exports = {
  convertStringToType,
  resolveField
};
