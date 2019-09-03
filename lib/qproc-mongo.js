'use strict';

const types = require('./types');
const operators = require('./operators');
const helpers = require('./helpers');

const defaultOptions = createOptions();

/**
 * Creates a query object processor.
 *
 * @param {Object} options qproc-mongo options
 */
function createProcessor(options) {
  options = Object.assign({}, defaultOptions, options);
  for (const f in options.fields) {
    if (typeof options.fields[f] === 'object') {
      for (const k in options.fields[f]) {
        switch (k) {
          case 'alias':
            if (Array.isArray(options.fields[f][k])) {
              if (!options.fields[f][k].every(v => typeof v === 'string')) {
                throw new Error(`Invalid alias for field [ ${f} ]`);
              } else {
                options.fields[f][k].forEach(v => {
                  options.alias[v] = f;
                });
              }
            } else if (typeof options.fields[f][k] === 'string') {
              options.alias[options.fields[f][k]] = f;
            } else throw new Error(`Invalid alias for field [ ${f} ]`);
            break;
          case 'default':
            options.defaults[f] = options.fields[f][k];
            break;
        }
      }
      if (!options.fields[f].type) {
        options.fields[f].type = types.String;
      }
    } else {
      options.fields[f] = {
        type: options.fields[f]
      };
    }
  }

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

      try {
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

          const resolvedField = fields[helpers.resolveField(k, fields)];

          if (resolvedField) {
            const basic = /^eq:|^ne:|^lte?:|^gte?:/g;
            const regex = /^regex:/g;
            const all = /^all:/g;
            const nin = /^n?in:/g;

            let operator = operators.eq;
            let value = q[k];

            qproc.filter[k] = {};

            const isRegex = regex.exec(q[k]);
            const isNin = nin.exec(q[k]);
            const isAll = all.exec(q[k]);

            if (isNin || isAll) {
              const t = isNin ? nin : all;
              let list = q[k].substring(t.lastIndex).split(',');

              operator = operators[q[k].substring(0, t.lastIndex - 1)];
              value = list.map(function(v) {
                return helpers.convertStringToType(v, resolvedField.type);
              });

              Object.assign(qproc.filter[k], { [operator]: value });
            } else if (regex.exec(q[k])) {
              if (resolvedField.type === types.String) {
                let exp, match, flags;

                operator = operators.regex;
                exp = q[k].substring(regex.lastIndex);
                match = exp.substring(1, exp.lastIndexOf('/'));
                flags = exp.substring(exp.lastIndexOf('/') + 1);

                try {
                  value = new RegExp(match, flags);
                  Object.assign(qproc.filter[k], {
                    [operator]: value
                  });
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
                    return helpers.convertStringToType(
                      value,
                      resolvedField.type
                    );
                  });
                } else {
                  value = helpers.convertStringToType(
                    value,
                    resolvedField.type
                  );
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

        for (const k in options.defaults) {
          if (!qproc.filter[k]) {
            qproc.filter[k] =
              typeof options.defaults[k] === 'function'
                ? options.defaults[k]()
                : options.defaults[k];
          }
        }
      } catch (err) {
        process.stdout(
          `qproc-mongo :: Error processing query object - ${err.message}`
        );
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
    defaults: {},
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
  Boolean: types.Boolean,
  String: types.String,
  Int: types.Int,
  Float: types.Float,
  Date: types.Date
};
