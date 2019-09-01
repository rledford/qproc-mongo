# qproc-mongo

Target Node v6.4+

`qproc-mongo` creates processors that translate query objects into MongoDB queries.

## Features

- Easy configuration.

- Supports common MongoDB operators.

- Simple query string syntax.

- Ensures that only the fields defined in the options are allowed in the MongoDB filter.

- Supports one or more aliases for each field.

- Supports default field values.

- Supports wildcards for nested fields.

- Easy to add a query processor to your Express/Connect routes.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Supported Operators](#supported-operators)
- [Options](#options)
  - [Fields](#fields)
    - [Wildcards](#wildcards)
  - [Alias](#alias)
  - [Keys](#keys)
- [Examples](#examples)
- [Nested Fields](#nested-documents)

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
const qproc = require("qproc-mongo");

const options = {
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: "id"
    },
    category: qproc.String,
    date: qproc.Date,
    count: qproc.Int,
    cost: qproc.Float
  }
};

const proc = qproc.createProcessor(options);

const q = {
  category: "in:a,b",
  date: "gt:2018-01-01,lt:2019-01-01",
  count: "lt:1000",
  cost: "gte:299.99"
};

proc.exec(q);
/*
{
  filter: {
    type: { '$in': ['a', 'b'] },
    date:
    { '$gt': '2018-01-01T00:00:00.000Z',
      '$lt': '2019-01-01T00:00:00.000Z' },
    count: { '$lt': 1000 },
    cost: { '$gte': 299.99 }
  },
  limit: 0,
  skip: 0
  sort: {},
}
*/
```

---

### Middleware

```js
// require module
const qproc = require('qproc-mongo');

// create middleware
const qp = qproc.createMiddleware({
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: 'id'
    },
    category: qproc.String,
    date: qproc.Date,
    count: qproc.Int,
    cost: qproc.Float
  }
}, (err, req, res, next) => {
  res.status(400).json({
    error: {
      status: 400,
      message: err.message
    }
  }););

app.use('/api', qp, (req, res) => {
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

### Filter Operators

| Operator | Description                                                  | Example Query String    |
| -------- | ------------------------------------------------------------ | ----------------------- |
| eq       | Equal                                                        | `?field=eq:value`       |
| ne       | Not equal                                                    | `?field=ne:value`       |
| in       | In a list of values - Multiple values separated by a `,`     | `?field=in:a,b,c`       |
| nin      | Not in a list of values - Multiple values separated by a `,` | `?field=nin:a,b,c`      |
| gt       | Greater than                                                 | `?field=gt:value`       |
| gte      | Greater than or equal to                                     | `?field=gte:value`      |
| lt       | Less than                                                    | `?field=lt:value`       |
| lte      | Less than or equal to                                        | `?field=lte:value`      |
| all      | Contains all values - Multiple values separated by a `,`     | `?field=all:a,b,c`      |
| regex    | Regular expression - only works with _String_ fields         | `?field=regex:/^text/i` |

### Sort Operators

The sort order operators need to be _before_ the field name they will operate on. The default sort order is _ascending_ when a sort order operator is not present.

| Operator | Description | Example Query String           |
| -------- | ----------- | ------------------------------ |
| asc      | Ascending   | `?field=value&sort=asc:field`  |
| desc     | Descending  | `?field=value&sort=desc:field` |

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

| Type     |                | Value      |
| -------- | -------------- | ---------- |
| Int      | qproc.Int      | 'int'      |
| Float    | qproc.Float    | 'float'    |
| String   | qproc.String   | 'string'   |
| Boolean  | qproc.Boolean  | 'boolean'  |
| ObjectId | qproc.ObjectId | 'objectId' |

### Fields

Define which fields should be allowed and what type they are expected to be. It's also possible to set the default value, with a single value or a function that returns a value, for a field if it is not found in the query object.

```js
const qproc = require("qproc-mongo");
const options = {
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: 'id'
    },
    category: qproc.String,
    date: {
      type: qproc.Date,
      default: () => new Date()
    }
    count: qproc.Int,
    cost: qproc.Float,
  }
};

const processor = qproc.createProcessor(options);
```

#### Wildcards

Field definitions support wildcards for dynamically named fields as long as you know what type they will be.

Example database record:

```json
{
  "_id": "id",
  "counts": {
    "a": 100,
    "b": 100,
    "c": 125
  }
}
```

Define the options for `qproc-mongo` to query the nested fields.

```js
const qproc = require("qproc-mongo");

const options = {
  fields: {
    _id: qproc.ObjectId,
    "counts.*": qproc.Int
  }
};
```

### Alias

Define one or more aliases for a field in the field definition or in the `alias` option. Aliased fields are ignored if the field they are an alias for already exists in the query object. Wildcards are not supported in aliases.

Defining aliases in the field definition:

```js
const qproc = require("qproc-mongo");
const processor = qproc.createProcessor({
  fields: {
    _id: {
      type: qproc.ObjectId
      alias: 'id'
    },
    'location.0': {
      type: qproc.Float,
      alias: ['longitude', 'lng', 'x']
    }
    'location.1': {
      type: qproc.Float,
      alias: ['latitude', 'lat', 'y']
    }
  },
});
```

Defining aliases in the `alias` option:

```js
const qproc = require("qproc-mongo");
const processor = qproc.createProcessor({
  fields: {
    _id: qproc.ObjectId
  },
  alias: {
    id: "_id"
  }
});
```

### Keys

Keys for `limit`, `skip`, `sort`, and `search` can be customized in the options. The keys you define will be the same in the qproc result.

```js
const qproc = require("qproc-mongo");
const processor = qproc.createProcessor({
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: [ 'id' ]
    }
  }
  limitKey: "count",
  skipKey: "offset",
  sortKey: "orderBy",
  searchKey: "q"
});

processor.exec({
  count: '10',
  offset: '20',
  orderBy: 'asc:date'
});
/*
{
  filter: {...},
  count: 10,
  offset: 20,
  orderBy: {date: 1}
}
*/
```

---

## Examples

### Basic Filter

**Request Query String**

```
?type=a&date=ne:null
```

**qproc Result**

```js
{
  filter: {
    type: {$eq: 'a'},
    date: {$ne: null}
  },
  /* omitted */
}
```

### Basic Filter with Aliased Field

**Request Query String**

```
?id=1
```

**req.qproc Result**

```js
{
  filter: {
    _id: {$eq: '1'}
  },
  /* omitted */
}
```

### Filter with Ranges

**Request Query String**

```
?date=gte:2018-01-01,lt:2019-01-01&cost=gt:30.0,lt:100.0
```

**req.qproc Result**

```js
{
  filter: {
    date: {
      $gte: '2018-01-01T00:00:00.000Z',
      $lt: '2019-01-01T00:00:00.000Z'
    },
    cost: {
      $gt: 30.0,
      $lt: 100.0
    }
  },
  /* omitted */
}
```

### Filter and Sort

**Request Query String**

```
?type=a&sort=asc:date
```

**req.qproc Result**

```js
{
  filter: {
    type: {$eq: 'a'}
  },
  sort: {
    date: 1
  },
  /* omitted */
}
```

### Using in: to Filter with a List of Values

**Request Query String**

```
?type=in:a,b
```

**req.qproc Result**

```js
{
  filter: {
    type: {
      $in: ['a', 'b'];
    }
  },
  /* omitted */
}
```

### Using nin: to Filter with a List of Values

**Request Query String**

```
?type=nin:a,b
```

**req.qproc Result**

```js
{
  filter: {
    type: {
      $nin: ["a", "b"];
    }
  }
  /* omitted */
}
```

### Using Limit and Skip

**Request Query String**

```
?name=in:a,b,c,d&limit=100&skip=200
```

**req.qproc Result**

```js
{
  filter: {
    name: { $in: [ 'a','b','c' ] }
  },
  limit: 100,
  skip: 200,
  /* omitted */
}
```

### Using regex: to Search String Fields

**Request Query String**

```
?description=regex:/^text/gi
```

**req.qproc Result**

```js
{
  filter: {
    description: { $regex: /^text/gi}
  },
  /* omitted */
}
```

---

## Nested Fields

Example database record:

```json
{
  "_id": "5d585f1c055ae70bd45bcd49",
  "location": {
    "type": "Point",
    "coordinates": [30.4, -90.2]
  },
  "timestamp": "2019-01-01T00:00:00.000Z"
}
```

Example options to query nested fields:

```js
const qproc = require('qproc-mongo');
const processor = qproc.createProcessor({
  fields: {
    'location.coordinates.0': {
      type: qproc.Float,
      alias: ['longitude', 'lng', 'x']
    },
    'location.coordinates.1': {
      type: qproc.Float,
      alias: ['latitude', 'lat', 'y']
  }
});

processor.exec({
  longitude: 'gt:35,lt:34',
  latitude: 'lt:-92,gte:-94'
});
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
