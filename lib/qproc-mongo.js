'use strict';

const types = require('./types');
const operators = require('./operators');
const helpers = require('./helpers');

const FIELDS = 'fields';
const META = 'meta';
const ALIAS = 'alias';
const DEFAULT = 'default';
const DEFAULTS = 'defaults';
const PROJECTIONS = 'projections';

/* EXAMPLE CONFIG
{
  fields: {
    fieldA: 'string'
    fieldB: {
      type: 'string',
      default: {$eq: 'value'},
      alias: ['aliasB']
    },
    fieldC: {
      type: 'string',
      projection: false,
      default: () => {
        return {$eq: 'value'};
      }
    }
  }
}
*/

/**
 * Creates valid default options for convenience.
 */
function createOptions() {
  return {
    [FIELDS]: {},
    [DEFAULTS]: {
      keys: [],
      fields: {},
      meta: {}
    },
    [ALIAS]: {
      keys: [],
      fields: {},
      meta: {}
    },
    [META]: {
      keys: []
    },
    [PROJECTIONS]: [],
    sortKey: 'sort',
    limitKey: 'limit',
    skipKey: 'skip',
    searchKey: 'search',
    projKey: 'proj'
  };
}

/**
 * Builds out the options by by wiring up defualts, aliases, and projections
 *
 * @param {Object} options qproc-mongo configuration options
 * @param {String} prop an option property to build for the provided options - 'fields', 'meta'
 */
function build(options = createOptions(), prop) {
  for (const f in options[prop]) {
    if (typeof options[prop][f] === 'object') {
      for (const k in options[prop][f]) {
        switch (k) {
          case ALIAS:
            if (typeof options[prop][f][k] === 'string') {
              // alias is expected to be an array by qproc processor
              options[prop][f][k] = [options[prop][f][k]];
            }
            if (Array.isArray(options[prop][f][k])) {
              // alias values must be a string
              if (!options[prop][f][k].every(v => typeof v === 'string')) {
                throw new Error(`Invalid alias for field [ ${f} ]`);
              } else {
                // ensure an alias with the same value has not been registered
                options[prop][f][k].forEach(v => {
                  if (options[ALIAS].keys.indexOf(v) >= 0) {
                    throw new Error(`Alias ${v} already exists`);
                  }
                  options[ALIAS].keys.push(v);
                  options[ALIAS][prop][v] = f;
                });
              }
            } else {
              // alias must be a string or array of strings
              throw new Error(`Invalid alias for field [ ${f} ]`);
            }
            break;
          case DEFAULT:
            // ensure a default for the field has not been registered
            if (options[DEFAULTS].keys.indexOf(f) >= 0) {
              throw new Error(`Default value for ${f} already exists`);
            }
            options[DEFAULTS].keys.push(f);
            options[DEFAULTS][prop][f] = options[prop][f][k];
            break;
        }
      }
      if (!options[prop][f].type) {
        // assume string if no 'type' is defined in the field
        options[prop][f].type = types.String;
      }
      // add field to projections list if projection not specified or is true
      if (
        prop === FIELDS &&
        (!options[prop][f].hasOwnProperty('projection') ||
          options[prop][f].projection !== false)
      ) {
        options[PROJECTIONS].push(f);
      }
    } else {
      options[prop][f] = {
        type: options[prop][f]
      };
      // add field to projections list
      if (prop === FIELDS) {
        options[PROJECTIONS].push(f);
      }
    }
  }

  return options;
}

/**
 * Creates a query object processor.
 *
 * @param {Object} options qproc-mongo options
 */
function createProcessor(options) {
  options = Object.assign(createOptions(), options);
  options = build(options, FIELDS);
  options = build(options, META);

  console.log(options);

  return {
    /**
     *
     * @param {Object} q query object - likely from a request
     * @throws {Error}
     */
    exec: function(q) {
      let {
        fields,
        alias,
        meta,
        projections,
        sortKey,
        limitKey,
        skipKey,
        searchKey,
        projKey
      } = options;

      const qproc = {
        filter: {},
        [sortKey || 'sort']: {},
        [limitKey || 'limit']: 0,
        [skipKey || 'skip']: 0,
        [projKey || 'proj']: {},
        meta: {}
      };

      if (typeof q !== 'object' || Array.isArray(q)) {
        return qproc;
      }

      if (q[limitKey]) {
        let lk = parseInt(q[limitKey]);
        if (isNaN(lk)) {
          lk = 0;
        }
        qproc[limitKey] = Math.abs(lk);

        delete q[limitKey];
      }

      if (q[skipKey]) {
        let sk = parseInt(q[skipKey]);
        if (isNaN(sk)) {
          sk = 0;
        }
        qproc[skipKey] = Math.abs(sk);

        delete q[skipKey];
      }

      if (q[sortKey]) {
        const sorts = q[sortKey].split(',');
        const ascDesc = /^asc:|^desc:/g;

        sorts.forEach(function(sort) {
          let field = sort;
          let order = 1; // defaults to ascending
          if (ascDesc.test(sort)) {
            field = sort.substring(ascDesc.lastIndex);
            order = sort.substring(0, ascDesc.lastIndex - 1) == 'desc' ? -1 : 1;

            ascDesc.lastIndex = 0; // reset lastIndex
          }
          qproc[sortKey][field] = order;

          delete q[sortKey];
        });
      }
      if (q[projKey]) {
        const proj = {};
        let pKeys = [];
        let pValues = [];
        q[projKey].split(',').map(p => {
          let field = p;
          let include = 1;
          if (p[0] === '+' || p[0] === '-') {
            field = p.slice(1);
            include = p[0] === '+' ? 1 : 0;
          }
          if (projections.indexOf(field) >= 0) {
            proj[field] = include;
            pKeys.push(field);
            pValues.push(include);
          }
        });
        if (
          Object.keys(proj).length &&
          pValues.every((v, i, arr) => v === arr[0])
        ) {
          qproc[projKey] = proj;
        }

        delete q[projKey];
      }

      if (q[searchKey]) {
        let regex = new RegExp(`${q[searchKey]}`, 'i');
        let searchFields = [];
        const fieldKeys = Object.keys(fields);
        for (let i = 0; i < fieldKeys.length; i++) {
          if (fields[fieldKeys[i]].type === types.String) {
            if (fieldKeys[i].indexOf('*') >= 0) continue;
            searchFields.push({ [fieldKeys[i]]: { $regex: regex } });
          }
        }
        if (searchFields.length) {
          qproc.filter = {
            $or: searchFields
          };
        } else {
          qproc.filter = {};
        }

        return qproc;
      }

      for (let k in alias.fields) {
        if (q[k] !== undefined && q[alias.fields[k]] === undefined) {
          q[alias.fields[k]] = q[k];
        }
      }
      for (let k in alias.meta) {
        if (q[k] !== undefined && q[alias.meta[k]] === undefined) {
          q[alias.meta[k]] = q[k];
        }
      }

      for (let k in q) {
        if (meta[k]) {
          qproc.meta[k] = helpers.convertStringToType(q[k], meta[k].type);
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
          } else if (isRegex) {
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
                  return helpers.convertStringToType(value, resolvedField.type);
                });
              } else {
                value = helpers.convertStringToType(value, resolvedField.type);
              }

              Object.assign(qproc.filter[k], { [operator]: value });
            });
          }

          if (!Object.keys(qproc.filter[k]).length) {
            delete qproc.filter[k];
          }

          continue;
        }
      }

      for (const k in options[DEFAULTS].fields) {
        if (!qproc.filter.hasOwnProperty(k)) {
          qproc.filter[k] =
            typeof options[DEFAULTS].fields[k] === 'function'
              ? options[DEFAULTS].fields[k]()
              : options[DEFAULTS].fields[k];
        }
      }
      for (const k in options[DEFAULTS].meta) {
        if (!qproc.meta.hasOwnProperty(k)) {
          qproc.meta[k] =
            typeof options[DEFAULTS].meta[k] === 'function'
              ? options[DEFAULTS].meta[k]()
              : options[DEFAULTS].meta[k];
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
