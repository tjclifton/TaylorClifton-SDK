# SDK Design

## Flow-Based API
I desired to use a flow-based API that uses lazy-loaded/evaluated promises
to mimick other popular frameworks (I think of Prisma.js, or Ruby on Rails),
where calls to different API endpoints can be "built" using a chain of method
calls, and only perfomed when the promise-like object is actually `await`ed
by Node. I heavily utilized TypeScript's generics and conditional type
expressions to achieve the proper type safety on this (with auto-completions).

## Creating the API Wrapper
A light JSON schema is passed to a function called `createApi` that instantiates
a function (thunk), that when invoked by the end-user, creates the wrapper
client to achieve the method-chaining described above. An example of this
can be seen in `src/lib/api/v1`

## Versioning
This method also supports simple API versioning, which I belive is important
for an SDK to incorporate (I know Shopify heavily emphasiszes this). Each
version can be defined in it's own folder.

## API Functionality
I sought to implement as much of the logic as I could think of for the example
API, in a type-safe way. The SDK also supports throttling if the API should
return a HTTP 429, respecting the `Retry-After` header if present, and using
exponential backoff if not. The specifics can be controlled through different
options passed to the `createApi` function.

## Type-Safety
I sought to ensure that as much information as possible concerning the API
endpoints' limitations and functionality could be reflected in the code at
compile time. I've often appreciated when SDKs are done this way (Octokit is
a good example), when even the auto-completion can provide sufficient docu-
mentation. I sought to add comments in the correct places as well to document
the API endpoints that are being wrapped, and they seem to appear in the VSCode
intellisense when typing the method calls.

## Dummy API
Currently, the application isn't hooked up to any API. It will simply return
the URL that is generated given the method calls and the various options passed
to the wrapper when it is `await`ed. The URL will include the appropriate
query parameters for pagination, sorting, and filtering (I believe!).
