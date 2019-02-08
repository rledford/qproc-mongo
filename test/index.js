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
    eventType: qproc.String,
    eventName: qproc.String,
    eventDate: qproc.Date,
    description: qproc.String,
    ticketCount: qproc.Int,
    ticketCost: qproc.Float,
    'totals.*': qproc.Int
  },
  alias: {
    id: '_id'
  }
};

const test = qproc.createMiddleware(options);

const req = {
  query: {
    id: 'alias for _id',
    eventType: 'in:music,sports',
    eventDate: 'gt:2018-01-01,lt:2019-01-01',
    description: 'regex:/^mastodon/gi',
    ticketCount: 'lt:1000',
    ticketCost: 'gte:299.99',
    sort: 'desc:eventDate,asc:ticketCount',
    limit: '100',
    'totals.ticketsSold': 'gt:1000',
    'totals.ticketsRefunded': 'gt:50'
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
console.log('********* QPROC OUTPUT **********\n', req.qproc);
separator();
