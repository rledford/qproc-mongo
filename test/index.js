function separator() {
  console.log(
    Array(50)
      .fill('*')
      .join('')
  );
}

const qproc = require('../lib/qproc-mongo');
let options = {
  fields: {
    _id: qproc.ObjectId,
    v: {
      type: qproc.Date,
      default: () => {
        return {
          $lt: new Date()
        };
      }
    },
    category: qproc.String,
    name: qproc.String,
    date: {
      type: qproc.Date
    },
    description: {
      type: qproc.String,
      alias: ['info', 'desc']
    },
    sponsors: qproc.String,
    count: qproc.Int,
    cost: qproc.Float,
    confirmed: qproc.Boolean,
    'nested.*': qproc.Int,
    'multiple.*.wildcards.*': qproc.Float,
    'adjacent.wildcard.*.*': qproc.String
  },
  meta: {
    calculateTotals: {
      type: 'boolean',
      alias: 'ct'
    }
  },
  projections: ['other']
};

const test = qproc.createMiddleware(options);

const req = {
  query: {
    id: 'alias for _id',
    category: 'in:music,sports,null',
    date: 'gt:2018-01-01,lt:2019-01-01',
    description: 'regex:/^mastodon/gi',
    sponsors: 'all:Gibson,Fender',
    count: 'lt:1000',
    cost: 'gte:299.99',
    sort: 'desc:date,asc:count',
    limit: '100',
    skip: '-25',
    confirmed: 'true',
    'nested.integer': 'gt:1000',
    'multiple.nested.wildcards.integer': 'gt:50',
    'adjacent.wildcard.test.test': 'test',
    ct: 'false',
    proj: '+cost,other'
  }
};
const res = {};
const next = function(err) {
  if (err) {
    console.log(err);
  }
};

separator();
console.log('TEST: process query parameters in the request');
console.log('EXPECTED RESULT: valid MongoDB query parameters');

console.log('****** REQUEST QUERY INPUT *******\n', req.query);
test(req, res, next);
console.log(
  '********* QPROC OUTPUT **********\n',
  JSON.stringify(req.qproc, null, 2)
);
separator();
