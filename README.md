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

## V1 Schema

The current V1 schema that is used is as follows:

```typescript
{
  /**
   * GET /book(/:id)?
   *
   * Retrieves the list of all books, or one book given its `id`.
   */
  book: {
    resource: Book,
    one: {
      /**
       * GET /book/:book-id/chapter(/:id)?
       *
       * Retrieves the list of all chapters for the given book identified by
       * `book-id`, or one chapter of the specified book by its `id`.
       */
      chapter: Chapter
    },
  },

  /**
   * GET /character(/:id)?
   *
   * Retrieves the list of all characters, or one character given its `id`.
   */
  character: {
    resource: Character,
    one: {
      /**
       * GET /character/:character-id/quote(/:id)?
       *
       * Retrieves the list of all quotes for the given character identified by
       * `character-id`, or one quote from the specified character by its `id`.
       */
      quote: Quote
    }
  },

  /**
   * GET /quote(/:id)?
   *
   * Retrieves the list of all quotes, or one quote given its `id`.
   */
  quote: Quote,

  /**
   * GET /chapter(/:id)?
   *
   * Retrieves the list of all chapters, or one chapter given its `id`.
   */
  chapter: Chapter,
}
```
