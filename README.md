# qproc-mongo

Target Node v6.4+

Creates processors that convert query objects into MongoDB queries. Supports common MongoDB operators, wildcards, and more.

## Upgrading from v2.x

v3 introduced a new `meta` option. This new option supports defaults and aliases. In order to support this functionality for both `meta` and `fields` options, aliases and defaults must be defined within the `meta` and `fields` definitions.

```js
const options = {
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: ['id']
    }
  },
  meta: {
    flag: {
      type: qproc.Boolean,
      alias: ['f'],
      default: false
    }
  }
};
```

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [Operators](#operators)
- [Options](#options)
  - [Fields](#fields)
  - [Meta](#meta)
  - [Alias](#alias)
  - [Defaults](#defaults)
  - [Wildcards](#wildcards)
  - [Keys](#keys)
- [Examples](#examples)
- [Nested Fields](#nested-fields)

---

## Features

- Easy configuration.

- Supports common MongoDB operators.

- Simple query string syntax.

- Ensures that only the fields defined in the options are allowed in the MongoDB filter.

- Allows one or more aliases for each field.

- Supports wildcards for nested fields.

- Allows setting default values to be used when query parameters are missing.

- Easy to add middleware to Express/Connect routes.

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
    category: qproc.String,
    date: qproc.Date,
    count: qproc.Int,
    cost: qproc.Float
  }
};

const proc = qproc.createProcessor(options);

const q = {
  category: 'in:a,b',
  date: 'gt:2018-01-01,lt:2019-01-01',
  count: 'lt:1000',
  cost: 'gte:299.99'
};

proc.exec(q);
/*
{
  filter: {
    category: { '$in': ['a', 'b'] },
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
});

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

## Operators

### Filter Operators

| Operator | Description                                                  | Example Query String    |
| -------- | ------------------------------------------------------------ | ----------------------- |
| eq       | Equal                                                        | `?field=value`          |
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

| Option    | Default  | Description                                                                                         |
| --------- | -------- | --------------------------------------------------------------------------------------------------- |
| fields    | `{}`     | key:value pairs that identify query filter fields and their associated types, defaults, and aliases |
| meta      | `{}`     | key:value pairs that identify fields that will be allowed in the `meta` property                    |
| limitKey  | `limit`  | used to identify the limit parameter                                                                |
| skipKey   | `skip`   | used to identify the skip parameter                                                                 |
| sortKey   | `sort`   | used to identify the sort parameter                                                                 |
| searchKey | `search` | used to identify the search parameter                                                               |

### Field Types

When defining the field type, use the types available in the `qproc-mongo` module or use the below values directly.

| Type     | Value      | `qproc = require('qproc-mongo')` |
| -------- | ---------- | -------------------------------- |
| Int      | 'int'      | qproc.Int                        |
| Float    | 'float'    | qproc.Float                      |
| String   | 'string'   | qproc.String                     |
| Boolean  | 'boolean'  | qproc.Boolean                    |
| ObjectId | 'objectId' | qproc.ObjectId                   |

### Fields

Define which fields are allowed in the filter result and what type they are expected to be. Default values, including functions, should return valid MongoDB query filters.

```js
const qproc = require("qproc-mongo");
const options = {
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: 'id'
    },
    category: {
      type: qproc.String
    }
    date: {
      type: qproc.Date,
      alias: ['time', 'timestamp']
    }
    count: qproc.Int,
    cost: qproc.Float,
  }
};

const processor = qproc.createProcessor(options);
```

### Meta

Meta definitions keep non-filter related fields out of the field definitions so they don't have to be culled from the filter before executing a query. Meta definitions are defined the same way as field definitions, but meta definition default values do not have to be MongoDB filters.

```js
const qproc = require('qproc-mongo');
const options = {
  fields: {
    _id: {
      type: qproc.ObjectId,
      alias: 'id'
    },
    category: {
      type: qproc.String
    }
  },
  meta: {
    calculateTotals: {
      type: qproc.Boolean,
      default: false
    }
  }
};

const processor = qproc.createProcessor(options);
```

### Alias

Define one or more aliases for a field in the field definition. Aliased fields are ignored if the field they are an alias for already exists in the query object. Wildcards are not supported in aliases.

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

### Defaults

Field definitions support defaults which can be a value or a function that returns a value. Default values, including functions, should return valid MongoDB filters.

```js
const qproc = require('qproc-mongo');
const processor = qproc.createProcessor({
  fields: {
    _id: qproc.ObjectId,
    date: {
      type: qproc.Date,
      default: () => {
        return {
          $gt: new Date(Date.now() - 30000),
          $lt: new Date(Date.now())
        };
      }
    }
  }
});
```

#### Wildcards

Field definitions support nested wildcards.

Example database record:

```json
{
  "_id": "id",
  "counts": {
    "a": 1,
    "b": 1,
    "c": 1
  },
  "metrics": {
    "example_1": {
      "count": 1
    },
    "example_2": {
      "count": 2
    }
  }
}
```

Define options to query the nested fields.

```js
const qproc = require('qproc-mongo');

const options = {
  fields: {
    _id: qproc.ObjectId,
    'counts.*': qproc.Int,
    'metrics.*.counts': qproc.Int
  }
};
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
      $nin: ['a', 'b'];
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

Example options to support nested fields:

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
