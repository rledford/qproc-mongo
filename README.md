`qproc-mongo` generates query string processors (middleware) to use in your Express/Connect application routes. These processors translate query string parameters into usable MongoDB query parameters. After a qproc processor executes on an incoming request, a new `req.qproc` result is available to the request handlers that follow.

NOTE: A query string parser, like [query-string][query-string-url], is likely already being used in your app to set `req.query`. If `req.query` is missing or empty, then the processor will set `req.qproc` using [default values](#missing-req.query).

### Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Options](#options)
  - [Fields](#fields)
  - [Keys](#keys)
  - [Search Key](#search-key)
- [Misc](#misc)

### Install

```
npm install qproc-mongo
```

### Usage

```js
/*
  assuming that 'app' and 'db' have already been created using
  Express and a MongoDB client
*/

// require module
const qproc = require('qproc-mongo');

// create processor middleware
const myQprocProcessor = qproc.createProcessor({
  fields: {
    eventType: qproc.String,
    eventDate: qproc.Date,
    ticketCount: qproc.Int,
    ticketCost: qproc.Float
  }
});

app.use('/api/events', myQprocProcessor, (req, res) => {
  const { filter, limit, skip, sort } = req.qproc;

  db.collection('events')
    .find(filter)
    .limit(limit)
    .skip(skip)
    .sort(sort)
    .toArray((err, docs) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.status(200).json(docs);
    });
});
```

For this example, the request looks like this...

```
http://localhost:3000/api/events?eventType=in:music,sports&eventDate=gt:2018-01-01,lt:2019-01-01&ticketCount=lt:1000&ticketCost=gte:299.99
```

First, this request's query string should be handled by something like `query-string` so that `req.query` looks like this...

```js
{
  eventType: 'in:music,sports',
  eventDate: 'gt:2018-01-01,lt:2019-01-01',
  ticketCount: 'lt:1000',
  ticketCost: 'gte:299.99'
}
```

After `myQprocProcessor` executes, the `req.qproc` result looks like this...

```js
{
  filter: {
    eventType: { '$in': ['music', 'sports'] },
    eventDate:
    { '$gt': '2018-01-01T00:00:00.000Z',
      '$lt': '2019-01-01T00:00:00.000Z' },
    ticketCount: { '$lt': 1000 },
    ticketCost: { '$gte': 299.99 }
  },
  sort: {},
  limit: 0,
  skip: 0
}
```

Now the `req.qproc` result can be used to execute a query that would be able to find any document that has an `eventType` of `music` or `sports`, is within the provided `eventDate` constraints, has a `ticketCount` that is less than 1000, and has a `ticketCost` that is greater than or equal lto 299.99.

### Options

| Option    | Default  | Description                                                                       |
| --------- | -------- | --------------------------------------------------------------------------------- |
| fields    | `{}`     | key:value pairs that will identify query filter fields and their associated types |
| limitKey  | `limit`  | used to identify the limit parameter                                              |
| skipKey   | `skip`   | used to identify the skip parameter                                               |
| sortKey   | `sort`   | used to identify the sort parameter                                               |
| searchKey | `search` | used to identify the search parameter                                             |

#### Fields

Fields should be set using a field name and its type. The available types are `String`, `Date`, `Int`, and `Float`. The types should be set using the `qproc-mongo` module like this.

```js
const qproc = require('qproc-mongo');
const options = {
  eventType: qproc.String,
  eventDate: qproc.Date,
  ticketCount: qproc.Int,
  ticketCost: qproc.Float
};

const processor = qproc.createProcessor(options);
```

#### Keys

If you need to have a different key identifiers, other than `limit`, `skip`, `sort`, and `search`, because they are being used by the documents in your collection, or you just prefer something else, you can set them in the options.

```js
const qproc = require('qproc-mongo');
const options = {
  /* field definitions */
  limitKey: 'count',
  skipKey: 'offset',
  sortKey: 'orderBy',
  searchKey: 'q'
};

const processor = qproc.createProcessor(options);
```

When the above processor executes, `req.qproc` will look like this...

```js
{
  filter: {/* based on field definitions */},
  count: 0,
  offset: 0,
  oerderBy: {}
}
```

What happens here is that the processor uses the keys for both searching the `req.query` input and the `req.qroc` results. So you don't have to keep track of which key is used in processing and which one is used in the result. If you set the `limitKey` to 'count', then you will access the value with `req.qproc.count` (not req.qproc.limit);

#### Search Key

When the `searchKey` is detected, no matter what other fields are present in `req.query`, the `req.qproc` result will look like this...

```js
{
  filter: {
    $text: {
      $search: 'whatever the value is in the query string';
    }
  },
  limit: 0,
  skip: 0,
  sort: {}
}
```

NOTE: `limit`, `skip`, and `sort` will have whatever values are found in the `req.query` input.

There are some assumptions being made here about the underlying collection that will be queried. The most important thing to note is that this filter will only work on collections that have a **text index**. Usually, when text searches are performed on a collection, a **text index** exists. If you want to search multiple fields for matches on text without using the MongoDB text search method, then you can check if `req.qproc.filter.$text` exists and do whatever you want with the `$search` value.

### Misc

#### createProcessor(options)

When `createProcessor()` is called without providing any `options`, a warning message will be shown in the console. A processor that is using the default options will always have the `req.qproc.filter` value set to `{}`, so be careful.

#### Missing req.query

When a processor executes on a request that has a missing or empty `req.query` input, the `req.qproc` result will look like this...

```js
{
  filter: {},
  limit: 0,
  skip: 0,
  sort: {}
}
```

These are valid MongoDB query parameters but probably shouldn't be used since it would result in every document being returned. It is up to you to make sure that properties, like `limit`, are clamped to whatever min/max you think are necessary.

[query-string-url]: https://www.npmjs.com/package/query-string
