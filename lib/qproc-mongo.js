'use strict';

const types = {
  Int: 'int',
  Float: 'float',
  Date: 'date',
  String: 'string',
  ObjectId: 'objectId'
};

const operators = {
  eq: '$eq',
  ne: '$ne',
  lte: '$lte',
  lt: '$lt',
  gte: '$gte',
  gt: '$gt',
  nin: '$nin',
  in: '$in',
  regex: '$regex'
};

const typeValues = Object.keys(types).map(function(k) {
  return types[k];
});

function convertStringToType(str, type) {
  switch (type) {
    case types.Date:
      return new Date(str);
    case types.Int:
      return parseInt(str);
    case types.Float:
      return parseFloat(str);
    case types.ObjectId:
      if (str.toLowerCase() === 'null') {
        return null;
      }
      return str;
    default:
      return str;
  }
}

function validateOptions(options) {
  if (typeof options.fields !== 'object' || Array.isArray(options.fields)) {
    options.fields = {};
  }

  for (let field in options.fields) {
    if (typeValues.indexOf(options.fields[field]) === -1) {
      throw new Error('invalid field type for field [ ' + field + ' ]');
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
}

module.exports = {
  createProcessor: function(options) {
    if (!options) {
      options = this.createOptions();
      console.warn(
        'qproc-mongo :: WARN ::',
        `options were not provided to createProcessor - using default ${JSON.stringify(
          options
        )}`
      );
    }

    validateOptions(options);

    return function(req, res, next) {
      let { fields, sortKey, limitKey, skipKey, searchKey } = options;

      req.qproc = {
        filter: {},
        [sortKey || 'sort']: {},
        [limitKey || 'limit']: 0,
        [skipKey || 'skip']: 0
      };

      if (!req.query) return next();

      for (let k in req.query) {
        if (k === limitKey) {
          req.qproc[k] = parseInt(req.query[k]);

          if (isNaN(req.qproc[k])) {
            return next(new Error(k + ' must be an integer'));
          }

          continue;
        }

        if (k === skipKey) {
          req.qproc[k] = parseInt(req.query[k]);

          if (isNaN(req.qproc[k])) {
            return next(new Error(k + ' must be an integer'));
          }

          continue;
        }

        if (k === sortKey) {
          const sorts = req.query[sortKey].split(',');
          let match = /^asc:|^desc:/g;

          sorts.forEach(function(sort) {
            let field = sort;
            let order = -1; // defaults to descending
            if (match.test(sort)) {
              field = sort.substring(match.lastIndex);
              order = sort.substring(0, match.lastIndex - 1) == 'asc' ? 1 : -1;

              match.lastIndex = 0; // reset lastIndex
            }

            Object.assign((req.qproc[sortKey][field] = order));
          });

          continue;
        }

        if (fields[k]) {
          let match = /^eq:|^ne:|^lte?:|^gte?:/g;
          let regex = /^regex:/g;
          let nin = /^n?in:/g;
          let operator = operators.eq;
          let value = req.query[k];

          req.qproc.filter[k] = {};

          if (nin.exec(req.query[k])) {
            let list = req.query[k].substring(nin.lastIndex).split(',');

            operator = operators[req.query[k].substring(0, nin.lastIndex - 1)];
            value = list.map(function(v) {
              return convertStringToType(v, fields[k]);
            });

            Object.assign(req.qproc.filter[k], { [operator]: value });
          } else if (regex.exec(req.query[k])) {
            let parts = req.query[k].substring(regex.lastIndex).split(',');

            operator = operators.regex;
            value = new RegExp(parts[0], parts.slice(1).join(''));

            Object.assign(req.qproc.filter[k], { [operator]: value });
          } else {
            req.query[k].split(',').forEach(function(range) {
              operator = operators.eq; // defaults to the equal operator
              value = range; // defaults to the field value

              match.lastIndex = 0; // reset lastIndex

              if (match.exec(value)) {
                operator =
                  operators[value.substring(0, match.lastIndex - 1)] ||
                  operators.eq;
                value = value.substring(match.lastIndex);
              }

              if (Array.isArray(value)) {
                value = value.map(function(v) {
                  return convertStringToType(value, fields[k]);
                });
              } else {
                value = convertStringToType(value, fields[k]);
              }

              Object.assign(req.qproc.filter[k], { [operator]: value });
            });
          }

          continue;
        }

        if (k === searchKey) {
          let regex = new RegExp(`${req.query[k]}`, 'i');
          let searchFields = [];
          Object.keys(fields).forEach(field => {
            if (fields[field] === 'string') {
              searchFields.push({ [field]: { $regex: regex } });
            }
          });
          if (searchFields.length) {
            req.qproc.filter = {
              $or: searchFields
            };
          } else {
            req.qproc.filter = {};
          }
        }
      }

      next();
    };
  },

  createOptions: function() {
    return {
      fields: {},
      sortKey: 'sort',
      limitKey: 'limit',
      skipKey: 'skip',
      searchKey: 'search'
    };
  },

  String: types.String,
  Int: types.Int,
  Float: types.Float,
  Date: types.Date
};
