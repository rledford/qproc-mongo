function separator() {
  console.log(
    Array(50)
      .fill('*')
      .join('')
  );
}

const qproc = require('./index');
let options = {
  fields: {
    eventName: qproc.String,
    eventDate: qproc.Date,
    ticketCount: qproc.Int,
    ticketCost: qproc.Float
  }
};

const test = qproc.createProcessor(options);

const req = {
  query: {
    eventType: 'in:music,sports',
    eventDate: 'gt:2018-01-01,lt:2019-01-01',
    ticketCount: 'lt:1000',
    ticketCost: 'gte:299.99',
    sort: 'desc:eventDate,asc:ticketCount',
    limit: '100'
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
