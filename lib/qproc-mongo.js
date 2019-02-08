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

/**
 * Creates a query processor that can be used directly without having to use middleware.
 * The middleware returned from the createMiddleware function uses this createProcessor
 * method internally.
 *
 * @param {Object} options qproc-mongo options
 */
function createProcessor(options) {
  options = validateOptions(options);

  return {
    /**
     *
     * @param {Object} q query object - likely from a request
     */
    exec: function(q) {
      let { fields, alias, sortKey, limitKey, skipKey, searchKey } = options;

      const qproc = {
        filter: {},
        [sortKey || 'sort']: {},
        [limitKey || 'limit']: 0,
        [skipKey || 'skip']: 0
      };

      if (typeof q !== 'object' || Array.isArray(q)) {
        return qproc;
      }

      for (let k in alias) {
        if (q[k] && !q[alias[k]]) {
          q[alias[k]] = q[k];
        }
      }

      for (let k in q) {
        if (k === limitKey || k === skipKey) {
          qproc[k] = parseInt(q[k]);

          if (isNaN(qproc[k])) {
            qproc[k] = 0;
          }

          continue;
        }

        if (k === sortKey) {
          const sorts = q[sortKey].split(',');
          const ascDesc = /^asc:|^desc:/g;

          sorts.forEach(function(sort) {
            let field = sort;
            let order = 1; // defaults to ascending
            if (ascDesc.test(sort)) {
              field = sort.substring(ascDesc.lastIndex);
              order =
                sort.substring(0, ascDesc.lastIndex - 1) == 'desc' ? -1 : 1;

              ascDesc.lastIndex = 0; // reset lastIndex
            }

            Object.assign((qproc[sortKey][field] = order));
          });

          continue;
        }

        if (k.indexOf('.') >= 0) {
          const wildcardKey = `${k.substring(0, k.lastIndexOf('.'))}.*`;
          if (fields[wildcardKey]) {
            fields[k] = fields[wildcardKey];
          }
        }

        if (fields[k]) {
          const basic = /^eq:|^ne:|^lte?:|^gte?:/g;
          const regex = /^regex:/g;
          const nin = /^n?in:/g;

          let operator = operators.eq;
          let value = q[k];

          qproc.filter[k] = {};

          if (nin.exec(q[k])) {
            let list = q[k].substring(nin.lastIndex).split(',');

            operator = operators[q[k].substring(0, nin.lastIndex - 1)];
            value = list.map(function(v) {
              return convertStringToType(v, fields[k]);
            });

            Object.assign(qproc.filter[k], { [operator]: value });
          } else if (regex.exec(q[k])) {
            if (fields[k] === types.String) {
              let exp, match, flags;

              operator = operators.regex;
              exp = q[k].substring(regex.lastIndex);
              match = exp.substring(1, exp.lastIndexOf('/'));
              flags = exp.substring(exp.lastIndexOf('/') + 1);

              try {
                value = new RegExp(match, flags);
                Object.assign(qproc.filter[k], { [operator]: value });
              } catch (unused) {}
            }
          } else {
            q[k].split(',').forEach(function(range) {
              operator = operators.eq; // defaults to the equal operator
              value = range; // defaults to the field value

              basic.lastIndex = 0; // reset lastIndex

              if (basic.exec(value)) {
                operator =
                  operators[value.substring(0, basic.lastIndex - 1)] ||
                  operators.eq;
                value = value.substring(basic.lastIndex);
              }

              if (Array.isArray(value)) {
                value = value.map(function(v) {
                  return convertStringToType(value, fields[k]);
                });
              } else {
                value = convertStringToType(value, fields[k]);
              }

              Object.assign(qproc.filter[k], { [operator]: value });
            });
          }

          if (!Object.keys(qproc.filter[k]).length) {
            delete qproc.filter[k];
          }

          continue;
        }

        if (k === searchKey) {
          let regex = new RegExp(`${q[k]}`, 'i');
          let searchFields = [];
          Object.keys(fields).forEach(field => {
            if (fields[field] === 'string') {
              searchFields.push({ [field]: { $regex: regex } });
            }
          });
          if (searchFields.length) {
            qproc.filter = {
              $or: searchFields
            };
          } else {
            qproc.filter = {};
          }
        }
      }

      return qproc;
    }
  };
}

/**
 * Creates qproc-mongo middleware for Express/Connect. If errorHandler is provided,
 * it will be used to handle errors that may occur while processing req.query, otherwise
 * next(err) is called.
 *
 * @param {Object} options qproc-mongo options
 * @param {Function} errorHandler (err, req, res, next) => {}
 */
function createMiddleware(options, errorHandler) {
  const processor = createProcessor(options);

  return function(req, res, next) {
    try {
      req.qproc = processor.exec(req.query);
    } catch (err) {
      if (typeof errorHandler === 'function') {
        return errorHandler(err, req, res, next);
      }
      return next(err);
    }

    next();
  };
}

/**
 * Creates valid default options for convenience.
 */
function createOptions() {
  return {
    fields: {},
    alias: {},
    sortKey: 'sort',
    limitKey: 'limit',
    skipKey: 'skip',
    searchKey: 'search'
  };
}

module.exports = {
  createProcessor,
  createMiddleware,
  createOptions,
  ObjectId: types.ObjectId,
  String: types.String,
  Int: types.Int,
  Float: types.Float,
  Date: types.Date
};
