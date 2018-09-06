const qproc = require('./index');
const options = qproc.createOptions();

options.fields = {
  eventName: qproc.String,
  eventDate: qproc.Date,
  ticketCount: qproc.Int,
  ticketCost: qproc.Float
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

console.log('********** START **********');
console.log('** INPUT **\n', req.query);
test(req, res, next);
console.log('** OUTPUT **\n', req.qproc);
console.log('*********** END ***********');
