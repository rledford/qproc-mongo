# qproc-mongo

`qproc-mongo` generates query string processors (middleware) to use in your Express/Connect application routes. These processors translate query string parameters, in `req.query`, into usable MongoDB query parameters. After a qproc processor executes on an incoming request, a new `req.qproc` result is available to the request handlers that follow.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Supported Operators](#supported-operators)
- [Options](#options)
  - [Fields](#fields)
  - [Keys](#keys)
  - [Search](#search)
- [Examples](#examples)
- [Notes](#notes)
- [To Do](#to-do)

---

## Install

```
npm install qproc-mongo
```

---

## Usage

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

For this example, the request URI looks like this...

```
http://localhost:3000/api/events?eventType=in:music,sports&eventDate=gt:2018-01-01,lt:2019-01-01&ticketCount=lt:1000&ticketCost=gte:299.99
```

The `req.query` then looks like this...

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
  limit: 0,
  skip: 0
  sort: {},
}
```

This `req.qproc` result can be used to execute a query that will find any document that has an `eventType` of `music` or `sports`, is within the provided `eventDate` constraints, has a `ticketCount` that is less than 1000, and has a `ticketCost` that is greater than or equal to 299.99.

---

## Supported Operators

### Filter Operators

The filter operators need to be **before** the value(s) they will operate on.

| Operator | Description                                                  | Example        |
| -------- | ------------------------------------------------------------ | -------------- |
| eq       | Equal                                                        | `eq:value`     |
| ne       | Not equal                                                    | `ne:value`     |
| in       | In a list of values - Multiple values separated by a `,`     | `in:a,b,c`     |
| nin      | Not in a list of values - Multiple values separated by a `,` | `nin:a,b,c`    |
| gt       | Greater than                                                 | `gt:value`     |
| gte      | Greater than or equal to                                     | `gte:value`    |
| lt       | Less than                                                    | `lt:value`     |
| lte      | Less than or equal to                                        | `lte:value`    |
| regex    | Regular expression                                           | `regex:^abc,i` |

### Sort Order Operators

The sort order operators need to be **before** the field name they will operate on. The default sort order is **descending** when a sort order operator is not present.

| Operator | Description | Example          |
| -------- | ----------- | ---------------- |
| asc      | Ascending   | `asc:eventDate`  |
| desc     | Descending  | `desc:eventDate` |

---

## Options

| Option    | Default  | Description                                                                       |
| --------- | -------- | --------------------------------------------------------------------------------- |
| fields    | `{}`     | key:value pairs that will identify query filter fields and their associated types |
| limitKey  | `limit`  | used to identify the limit parameter                                              |
| skipKey   | `skip`   | used to identify the skip parameter                                               |
| sortKey   | `sort`   | used to identify the sort parameter                                               |
| searchKey | `search` | used to identify the search parameter                                             |

### Fields

Field definitions tell a qproc-mongo processor what fields to look for in `req.query` and what type they should be when they are converted to MongoDB query parameters. The available types are `String`, `Date`, `Int`, and `Float`. The types should be set using the `qproc-mongo` module like this.

```js
const qproc = require('qproc-mongo');
const options = {
  fields: {
    eventType: qproc.String,
    eventDate: qproc.Date,
    ticketCount: qproc.Int,
    ticketCost: qproc.Float
  }
};

const processor = qproc.createProcessor(options);
```

### Keys

If you need to have different key identifiers, other than `limit`, `skip`, `sort`, and `search`, because they are being used by the documents in your collection, or you just prefer something else, you can set them in the options.

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
  orderBy: {}
}
```

Notice that the processor uses the same keys, provided in the options, for the `req.qroc` results. Now you don't have to keep track of which key is used in processing and which one is used in the result.

### Search

When the `searchKey` is detected, the `req.qproc` filter will contain an `$or` list where each element is a `field` mapped to the provided a regular expression. Only `string` fields are allowed to have a regex operator used on them.

```js
{
  filter: {
    $or: [{field: /^search-text/i}, {field: /^search-text/i}]
  },
  limit: 0,
  skip: 0,
  sort: {}
}
```

NOTE: `limit`, `skip`, and `sort` will have whatever values are found in the `req.query` input.

---

## Examples

Let's assume that the following examples are going to be processed by the `myQprocProcessor` we used in the above [Usage](#usage) section.

### Basic Filter

**Request URI**

```
/api/events?eventType=music
```

**req.qproc Result**

```js
{
  filter: {
    eventType: {$eq: 'music'}
  },
  /* omitted */
}
```

### Filter with Ranges

**Request URI**

```
/api/events?eventDate=gte:2018-01-01,lt:2019-01-01&ticketCost=gt:30.0,lt:100.0
```

**req.qproc Result**

```js
{
  filter: {
    eventDate: {
      $gte: '2018-01-01T00:00:00.000Z',
      $lt: '2019-01-01T00:00:00.000Z'
    },
    ticketCost: {
      $gt: 30.0,
      $lt: 100.0
    }
  },
  /* omitted */
}
```

### Filter and Sort

**Request URI**

```
/api/events?eventType=music&sort=asc:eventDate
```

**req.qproc Result**

```js
{
  filter: {
    eventType: {$eq: 'music'}
  },
  sort: {
    eventDate: 1
  },
  /* omitted */
}
```

### Using in: to Filter with a List of Values

**Request URI**

```
/api/events?eventType=in:music,sports
```

NOTE: The values that follow `in:` are comma-delimited without spaces between them

**req.qproc Result**

```js
{
  filter: {
    eventType: {
      $in: ['music', 'sports'];
    }
  },
  /* omitted */
}
```

### Using nin: to Filter with a List of Values

**Request URI**

```
/api/events?eventType=nin:music,sports
```

NOTE: The values that follow `nin:` are comma-delimited without spaces between them

**req.qproc Result**

```js
{
  filter: {
    eventType: {
      $nin: ['music', 'sports'];
    }
  }
  /* omitted */
}
```

### Using Limit and Skip for Pagination

**Request URI**

```
/api/events?limit=100&skip=200
```

NOTE: Any combination of field filters and sorts can be used with limit and skip.

**req.qproc Result**

```js
{
  filter: {},
  limit: 100,
  skip: 200,
  /* omitted */
}
```

---

## Notes

### createProcessor(options)

When `createProcessor()` is called without providing any `options`, a warning message will be shown in the console. A processor that is using the default options will always have the `req.qproc.filter` value set to `{}`, so be careful.

### Missing or Empty req.query

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

---

## To Do

- Provide a working example of an Express app that uses qproc-mongo
- Add an alternate searchKey that generates a filter for collections that do not use text indexes
- Add support for $or
