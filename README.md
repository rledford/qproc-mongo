# qproc-mongo

Target Node v6.4+

`qproc-mongo` creates query string processors that translate query objects into MongoDB queries.

## Features

- Easy configuration.

- Supports the most common MongoDB operators.

- Easy-to-use query string syntax.

- Ensures that only the fields defined in the options are allowed in the MongoDB filter.

- Supports one or more aliases for each field. You may want to allow someone to query a field, like `fname`, with `firstName` instead. Both will work.

- Supports default field values.

- Supports wildcards for nested fields. These will allow you to use `*` in place of a nested field, like `sensor.*.temp.value`, where `*` is used in place of a dynamic sensor identifier.

- Easy to add a query processor to your Express/Connect routes. After the middleware executes, the result will be available in the request object's `qproc` property.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Supported Operators](#supported-operators)
- [Options](#options)
  - [Fields](#fields)
    - [Wildcards](#wildcards)
  - [Alias](#alias)
  - [Keys](#keys)
  - [Search](#search)
- [Examples](#examples)
- [Nested Fields](#querying-nested-documents)
- [Notes](#notes)
- [To Do](#to-do)

---

## Install

```
npm install qproc-mongo
```

---

## Usage

---

### Processor

```js
const qproc = require('qproc-mongo');

const options = {
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: 'id'
    },
    eventType: qproc.String,
    eventDate: qproc.Date,
    ticketCount: qproc.Int,
    ticketCost: qproc.Float
  }
};

const proc = qproc.createProcessor(options);

const q = {
  eventType: 'in:music,sports',
  eventDate: 'gt:2018-01-01,lt:2019-01-01',
  ticketCount: 'lt:1000',
  ticketCost: 'gte:299.99'
};

try {
  const result = proc.exec(q);
  console.log(result);
  /*
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
  */
} catch (err) {
  /* handle error */
}
```

---

### Middleware

As of v2.x, you can pass an error handler function as the second argument to the `createMiddleware` method. The error handler function must **either** send a response **or** call `next`. If an error handler is not passed to the `createMiddleware` method, then `next(err)` is called by default. Remember to make sure your application does not report stack traces in `production` or you may leak information about your application when `next(err)` is called. This is the main reason for adding support for a custom error handler.

```js
// require module
const qproc = require('qproc-mongo');

// create middleware
const eventsQueryProcessor = qproc.createMiddleware({
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: 'id'
    },
    eventType: qproc.String,
    eventDate: qproc.Date,
    ticketCount: qproc.Int,
    ticketCost: qproc.Float
  }
}, (err, req, res, next) => {
  res.status(400).json({
    error: {
      status: 400,
      message: err.message
    }
  }););

app.use('/api/events', eventsQueryProcessor, (req, res) => {
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

---

## Supported Operators

### Filter

The filter operators need to be **before** the value(s) they will operate on.

| Operator | Description                                                  | Example         |
| -------- | ------------------------------------------------------------ | --------------- |
| eq       | Equal                                                        | `eq:value`      |
| ne       | Not equal                                                    | `ne:value`      |
| in       | In a list of values - Multiple values separated by a `,`     | `in:a,b,c`      |
| nin      | Not in a list of values - Multiple values separated by a `,` | `nin:a,b,c`     |
| gt       | Greater than                                                 | `gt:value`      |
| gte      | Greater than or equal to                                     | `gte:value`     |
| lt       | Less than                                                    | `lt:value`      |
| lte      | Less than or equal to                                        | `lte:value`     |
| all      | Contains all values - Multiple values separated by a `,`     | `all:a,b,c`     |
| regex    | Regular expression                                           | `regex:/^abc/i` |

NOTE: Invalid `regex` values are not included in the `filter`. Not providing a value after the `regex` operator will result in `/(:?)/` being used which will match anything. Also, if the field type, that `regex` is operating on, is not `qproc.String`, then it will not be included in the `filter`.

### Sort

The sort order operators need to be **before** the field name they will operate on. The default sort order is **ascending** when a sort order operator is not present.

| Operator | Description | Example          |
| -------- | ----------- | ---------------- |
| asc      | Ascending   | `asc:eventDate`  |
| desc     | Descending  | `desc:eventDate` |

---

## Options

| Option    | Default  | Description                                                                                                    |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| fields    | `{}`     | key:value pairs that will identify query filter fields and their associated types, defaults, and aliases       |
| alias     | `{}`     | key:value pairs where `key` is the aliased field name and `value` is what field in `fields` it is an alias for |
| limitKey  | `limit`  | used to identify the limit parameter                                                                           |
| skipKey   | `skip`   | used to identify the skip parameter                                                                            |
| sortKey   | `sort`   | used to identify the sort parameter                                                                            |
| searchKey | `search` | used to identify the search parameter                                                                          |

### Field Types

| Type     | Example        | Value      |
| -------- | -------------- | ---------- |
| Int      | qproc.Int      | 'int'      |
| Float    | qproc.Float    | 'float'    |
| String   | qproc.String   | 'string'   |
| Boolean  | qproc.Boolean  | 'boolean'  |
| ObjectId | qproc.ObjectId | 'objectId' |

### Fields

Field definitions tell a qproc-mongo processor what fields to look for in `req.query` and what type they should be when they are converted to MongoDB query parameters. The available types are `String`, `Date`, `Int`, `Float`, `Boolean`, and `ObjectId`. The types should be set using the `qproc-mongo` module like this.

```js
const qproc = require('qproc-mongo');
const options = {
  fields: {
    _id: qproc.ObjectId,
    eventType: qproc.String,
    eventDate: qproc.Date,
    ticketCount: qproc.Int,
    ticketCost: qproc.Float,
    isConfirmed: qproc.Boolean
  }
};

const processor = qproc.createProcessor(options);
```

All field types support `null` as a value.

Notice that `eventDate` is type _Date_ and `eventType` is type _String_.

The query string for this URL `/api/events?eventDate=null&eventType=null` would be iterperetted as:

```js
{
  filter: {
    eventDate: {$eq: null},
    eventType: {$eq: null}
  }
}
```

Notice that the `eventType` is `null` and not the _String_ `"null"`.

#### Wildcards

Field definitions support wildcards for dynamically named fields as long as you know what type they will be. For example, if your collection stores some arbirary counts or totals for things that may not be known at runtime, then you could use wildcards to allow queries on nested fields that exist and the ones that may exist in the future.

For this example, the database record model looks like this.

```json
{
  "_id": "id",
  "counts": {
    "a": 100,
    "b": 100,
    "c": 125
  },
  "nested": {
    "dynamicKey": {
      "counts": 100
    }
  },
  "multiple": {
    "dynamicKey": {
      "knownKey": {
        "dynamicKey": "value"
      }
    }
  }
}
```

Define the options for `qproc-mongo` to be aware of the dynamic field(s).

```js
const qproc = require('qproc-mongo');

const options = {
  fields: {
    _id: qproc.ObjectId,
    'counts.*': qproc.Int,
    'nested.*.counts': qproc.Int,
    'multiple.*.knownKey.*': qproc.String
  }
};
```

### Alias

Alias definitions tell a qproc-mongo processor what fields may be present in `req.query`, that are not defined in `fields`, but should be aliased to another field definition. When a qproc-mongo processor detects an aliased field, it will convert it to the field name specified in the alias definition. This is especially useful when other developers or frameworks use `id` instead of `_id` to refer to database record IDs, or to hide the actual database record field names.

NOTE: Wildcards are **NOT** supported in alias definitions.

```js
const qproc = require('qproc-mongo');
const options = {
  fields: {
    _id: qproc.ObjectId
  },
  alias: {
    id: '_id'
  }
};

const processor = qproc.createProcessor(options);
```

Anytime the above processor detects `id` in a query object, it will alias it to `_id` so that the `filter` result will include `_id`.

NOTE: Aliased fields are ignored if the the field they are an alias for already exists in the query object.

#### Example

```js
const options = {
  fields: {
    myField: 'string'
  },
  alias: {
    myAlias: 'myField'
  }
};

const processor = qproc.createProcessor(options);

const qObject = {
  myField: 'my value',
  myAlias: 'my alias value'
};

const result = processor.exec(qObject);

console.log(result);
/*
{
  filter: {
    myField: {$eq: 'my value'}
  },
  limit: 0,
  skip: 0,
  sort: {}
}
*/
```

Notice that even though `myAlias` is in `qObject`, and is an alias for `myField`, the value for `myAlias` is ignored. This is because `myField` already exists in `qObject` and `fields` have priority over `alias`.

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

const processor = qproc.createMiddleware(options);
```

When the above middleware executes, `req.qproc` will look like this...

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

When the `searchKey` is detected, the `req.qproc` filter will have an `$or` property with an array of `{field: regex}` objects as its value. Only `String` fields will appear in the `$or` list since `$regex` only operates on `String` type fields.

```js
{
  filter: {
    $or: [{field: /search-text/i}, {field: /search-text/i}]
  },
  limit: 0,
  skip: 0,
  sort: {}
}
```

NOTE: `limit`, `skip`, and `sort` will have whatever values are found in the `req.query` input.

---

## Examples

Let's assume that the following examples are going to be processed by the `myQprocMiddleware` we used in the above [Usage](#usage) section.

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

### Basic Filter with Aliased Field

**Request URI**

```
/api/events?id=event_id
```

**req.qproc Result**

```js
{
  filter: {
    _id: {$eq: 'event_id'}
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

### Using regex: to Search String Fields

**Request URI**

```
/api/events?description=regex:/^mastodon/gi
```

**req.qproc Result**

```js
{
  filter: {
    description: { $regex: /^mastodon/gi}
  },
  /* omitted */
}
```

---

## Nested Fields

It's common for database records to have nested fields. To inform `qproc-mongo` processors of the nested fields, just define it in the `fields` option using dot notation like this `"my.nested.field"` (wrapped in quotes). Here's an example.

Let's say you have a collection that stores location data that looks like this. The example location data is in `GeoJSON` format.

```json
{
  "_id": "locationDataId",
  "location": {
    "type": "Point",
    "coordinates": [30.4, -90.2]
  },
  "timestamp": "2019-01-01T00:00:00.000Z"
}
```

Here's an example of the `options` you can use to configure `qproc-mongo` processors so that the nested fields are queryable. This example also uses the `alias` option to make it more conveniet to access the nested location data.

```js
const qproc = require('qproc-mongo');

const options = {
  fields: {
    'location.coordinates.0': qproc.Float,
    'location.coordinates.1': qproc.Float
  },
  alias: {
    longitude: 'location.coordinates.0',
    latitude: 'location.coordinates.1'
  }
};

const processor = qproc.createProcessor(options);

const result = processor.exec({
  longitude: 'gt:35,lt:34',
  latitude: 'lt:-92,gte:-94'
});

console.log(result);
/*
{
  filter: {
    'location.coordinates.0': { $gt: 35, $lt: 34 },
    'location.coordinates.1': { $lt: -92, $gte: -94 }
  },
  sort: {},
  limit: 0,
  skip: 0
}
/*
```

---

## Notes

### createProcessor(options)

A processor that is using the default options will always have the `req.qproc.filter` value set to `{}`, so be careful.

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

- All caught up.
