# TaylorClifton-SDK

## Getting Started
### Installation

To install the package, run
```
yarn install @tjclifton/liblab-sdk
```

### Basic Usage
To use the API, import the relevant version (currently `v1`) and create the
API wrapper:

```typescript
import { v1 } from '@tjclifton/liblab-sdk';

const api = v1({
  // Return `null` on 404 errors instead of throwing errors.
  nullOn404: true;

  // The max number of retries for throttled (429) requests.
  maxRetries: 10;

  // An optional authentication token.
  authenticationToken: '<TOKEN>';
});

```

With this wrapper, you can use a flow-like interface to query the endpoints:

```typescript
(async () => {
  // Book #1 is not loaded, because it wasn't `await`ed
  const book1Api = api.book(1);
  // Load all chapters for book #1
  const chapters = await book1Api.chapter();
  // => [...]

  // Chaining calls
  const quote = await api.character(5).quote(1);
  // => {...}
  const quotes = await api.character(5).quote();
  // => [...]

  // Get one record by its ID
  const book = await api.book(1);
  // => {...}

  // With pagination, ordering, etc.
  const characters = await api.character({
    // The current page
    page: 0,

    // Number of results per page
    limit: 5

    // Limit of total number of results
    offset: 10,

    // Ordering of attributes (type-safe)
    order: 'name:asc',

    // Filters
    filter: {
      name: { $in: ['abc', 'def'] },
      words: { $gt: 20 },
    },
  });
  // => [...]
})();
```

### Filtering
The following filters are supported:

**Equality**:
`{ name: 'abc' }` or `{ name: /[a-z]/i }`

**Inequality**:
`{ name: {$ne: 'abc'} }` or `{ name: /[a-z]/i }`

**Existence**:
`{ name: true }`

**Absence**:
`{ name: false }`

**Inclusion**:
`{ name: ['abc', '123'] }`

**Exclusion**:
`{ name: { $nin: ['abc', '123'] } }`

**Comparison (numeric)**:
`{ name: { $gt: 5, $lt: 10 } }`

## Limitations
Currently, the wrapper just returns the endpoint which it would otherwise
query (including the various query parameters from the configuration options
passed into the method call).
