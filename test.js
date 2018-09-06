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
  },
  limitKey: 'limit',
  skipKey: 'skip',
  sortKey: 'sort',
  searchKey: 'search'
};

separator();
console.log('TEST: empty/missing options');
console.log(
  'EXPECTED RESULT: should output warnings for missing fields and keys'
);
qproc.createProcessor({});

separator();
console.log('TEST: populated fields with missing keys');
console.log('EXPECTED RESULT: should output warnings for missing keys only');
qproc.createProcessor({
  fields: {
    eventName: qproc.String,
    eventDate: qproc.Date,
    ticketCount: qproc.Int,
    ticketCost: qproc.Float
  }
});

separator();
console.log('TEST: populated fields and keys');
console.log('EXPECTED RESULT: should not output any warnings');
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
