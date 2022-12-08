import Backoff from 'backo2';
import { compact, isNil, mapValues, omitBy } from 'lodash';
import PLazy from 'p-lazy';
import { stringify } from 'querystring';
import { setTimeout } from 'timers/promises';
import { AbortError, ApiError, MaxRetriesExceededError, NetworkError, UnknownError } from './errors';
import { Filter, stringifyFilters } from './filtering';

/**
 * A schema describing an endpoint on the API that is used to generate an
 * flow-like interface for users of the SDK. Depending on the configuration,
 * certain properties/options will be enabled or disabled at compile time
 * via type-checking.
 */
interface ResourceDefinition<T = unknown> {
  /**
   * The type of resource which this endpoint returns.
   */
  readonly resource: T;

  /**
   * Should this endpoint require authentication?
   */
  readonly authenticated?: boolean;

  /**
   * Is pagination supported?
   */
  readonly pagination?: boolean;

  /**
   * Is filtering supported?
   */
  readonly filtering?: boolean;

  /**
   * Is sorting supported?
   */
  readonly sortable?: boolean;

  /**
   * Support nested endpoints on a given record
   */
  readonly one?: boolean | ApiDefinition;
}

/**
 * A mapping of keys (the name of the endpoint) to their definitions.
 *
 * @example
 *    // Maps to /book....
 *    { book: { record: Book, ... }}
 */
interface ApiDefinition {
  [k: string]: ResourceDefinition | unknown
}

/**
 * This performs two purposes:
 *    1. Defer the actual exectuion of the promise until it is `await`ed. This
 *       makes it lazy-loaded, which is needful because,
 *    2. Support a flow-like API, where the user can chain API endpoints with-
 *       out executing requests for intermediate resources.
 *
 * @example
 *    // Note: no `await`, so the request is not sent to /book/1
 *    const book = api.book(1);
 *
 *    // Performs the request to /book/1/chapter/5/verse/22
 *    const verse = await book.chapter(5).verse(22);
 */
type LazyResource<
  D,
  T,
  S extends boolean | ApiDefinition | undefined
> = PLazy<D> & (
  S extends ApiDefinition
    ? Api<S>
    : {}
);

/**
 * Utility type for infering the instance type of a constructor.
 */
export type InstanceOf<T> = T extends new (...args: unknown[]) => infer I
  ? I
  : T;

/**
 * Conditional type to ensure something isn't explicitly false.
 */
type NotFalse<C, T, F = {}> = C extends false ? F : T;

/**
 * Base API options for all actions.
 */
export interface ApiBaseOptions {
  readonly cancel?: AbortController;
  readonly maxRetries?: number;
  readonly query?: object;
}

/**
 * Options for `index` or `many` endpoints, that have various properties
 * conditionally enabled based upon the configuration of the `ApiDefinition`.
 */
export type ApiManyOptions<T, R extends ResourceDefinition<T>> =
  & ApiBaseOptions
  // Conditionally enable pagination properties if it is not set to 'false`
  & NotFalse<
      R['pagination'],
      {
        readonly limit?: number;
        readonly page?: number;
        readonly offset?: number;
      }
    >
  // Conditionally enabled filtering after the same manner...
  & NotFalse<
      R['filtering'],
      {
        readonly filter?: {
          // Only allow properties of the current record.
          [K in keyof InstanceOf<T>]: Filter;
        };
      }
    >
  // And sorting...
  & NotFalse<
      R['sortable'],
      {
        // Enforce compile-time pattern matching on these strings to only
        // allow properties of the current record.
        //
        // Eg. api.book(1).chapter({ order: 'number:asc' });
        readonly order?: `${keyof InstanceOf<T> & string}:${"asc" | "desc"}`;
      }
    >;

/**
 * The function that handles communicating with the API for a given record.
 *
 * @example
 *    api.book()
 *    //  ^^^^^^
 *    api.book(1).chapter()
 *    //  ^^^^^^^ ^^^^^^^^^
 */
export interface ApiInterface<T, R extends ResourceDefinition<T>> {
  /**
   * @param options options for the request to the `index` endpoint
   * @returns a lazy resource that can be `await`ed to fetch the actual data.
   * @note currently, there is no way to chain anything after index calls,
   *    hence the `never` to the `LazyResource` signifying that it has no child
   *    routes.
   */
  (options?: ApiManyOptions<T, R>): LazyResource<InstanceOf<T>[], T, never>;

  /**
   * @param id the ID of the record
   * @returns a lazy resource which can either be `await`ed to fetch the desired
   *    record, or chained upon to access child records (specified by the
   *    `one` property in its definition passed to `createApi`).
   * @example
   *    const v1 = createApi({
   *      book: {
   *        record: Book,
   *        one: Chapter
   *      }
   *    });
   *
   *    const book = await v1().book(1);
   *    const bookApi = v1().book(1);
   *    const chaptersForBook = await bookApi.chapter();
   */
  (id: string | number): LazyResource<InstanceOf<T> | null, T, R['one']>;

  /**
   * @param id the ID of the record
   * @param options options for this request
   * @returns the record referenced by `id` when `await`ed.
   * @note Nothing can be chained onto this because the user is supplying
   *    request options, implying that nothing more will come after it.
   */
  (id: string | number, options: ApiBaseOptions): LazyResource<InstanceOf<T> | null, T, never>;
}

/**
 * The flow-like interface that maps to the defined API.
 */
export type Api<D extends ApiDefinition> = {
  [K in keyof D]: D[K] extends ResourceDefinition<infer T>
    ? ApiInterface<T, D[K]>
    : ApiInterface<D[K], { resource: D[K], sortable: true, pagination: true, filtering: true }>;
};

/**
 * Options for all requests in a given `Api`.
 */
export interface CreateApiOptions {
  readonly nullOn404?: boolean;
  readonly maxRetries?: number;
  readonly authenticationToken?: string;
}

/**
 * API origin
 */
const origin = 'https://localhost:8000';

/**
 * @param item a resource definition, or a record itself
 * @returns if it is a resource definition.
 */
const isResourceDefinition = (item: ResourceDefinition | unknown): item is ResourceDefinition =>
  typeof item === 'object' && 'resource' in (item || {});

/**
 * Creates the `ApiInterface` for the given definition.
 *
 * @param endpoint the actual API endpoint as a path.
 * @param definition the definition of this endpoint passed to `createaApi`
 * @param options global options passed down
 * @returns the interface
 */
const createInterface = <
  T,
  R extends ResourceDefinition<T>
>(endpoint: string, definition: R, apiOptions: CreateApiOptions) => (
  /**
   * @see ApiInterface
   */
  (manyOptionsOrId: ApiManyOptions<T, R> | string | number, baseOptions?: ApiBaseOptions) => {
    const [options, id = ''] = typeof manyOptionsOrId === 'object'
      ? [manyOptionsOrId, undefined]
      : [baseOptions || {} as ApiBaseOptions, manyOptionsOrId];

    // Remove `id` and the slash if it's not present (for index requests).
    const path = compact([endpoint, id]).join('/');

    const {
      cancel,
      nullOn404,
      authenticationToken,
      maxRetries = 10,
    } = {
      ...apiOptions,
      ...options,
    };

    const queryObject = omitBy({
      limit: 'limit' in options ? options.limit : undefined,
      page: 'page' in options ? options.page : undefined,
      offset: 'offset' in options ? options.offset : undefined,
      order: 'order' in options ? options.order : undefined,
    }, isNil);

    const filterQuery = stringifyFilters(
      ('filter' in options && options.filter) || {}
    );

    // Avoid a trailing '&' if no filters are present.
    const query = compact([stringify(queryObject), filterQuery]).join('&');

    // Here we create the lazy-loaded promise for this request, which is only
    // run when awaited.
    const promise = new PLazy(async (resolve, reject) => {
      let retries = 0;

      // Exponential backoff for retries if the server doesn't respond with a
      // `Retry-After` header.
      const backoff = new Backoff({ min: 100, max: 20000 });

      let response: Response;
      let body: unknown;

      // TODO: Remove this when there is a working API!
      const testFetch = async (...args: any[]) =>
        new Response(args[0], { status: 200 });

      do {
        try {
          response = await testFetch(`${origin}/${path}?${query}`, {
            signal: cancel?.signal,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',

              // Conditionally add authentication
              ...(
                authenticationToken
                  ? { 'Authorization': `Bearer ${authenticationToken}` }
                  : {}
              )
            },
          });

          body = await response.json();

          if (response.ok) return resolve(body);
          if (response.status === 404 && nullOn404) return resolve(null);

          // Handle throttled requests.
          if (response.status === 429) {
            const retryAfter = +(response.headers.get('Retry-After') || backoff.duration());

            await setTimeout(retryAfter);
            continue;
          }

          reject(new ApiError(response.status, response.statusText, { response, body }));

          // No need to continue, lest we have a false-positive of a max-retry
          // exceeded failure.
          return;
        } catch (e) {
          // Handle network failures, cancellation, &c.
          if (e instanceof TypeError) {
            reject(new NetworkError(e.message));
          } else if (e instanceof Error && e.name === 'AbortError') {
            reject(new AbortError(e.message));
          } else {
            reject(new UnknownError(JSON.stringify(e)));
          }

          // No need to continue, lest we have a false-positive of a max-retry
          // exceeded failure.
          return;
        }
      } while (++retries <= maxRetries);

      // Max retries exceeded if we end up here.
      reject(
        new MaxRetriesExceededError(
          response.status,
          response.statusText,
          { response, body }
        ),
      );
    });

    const { one } = definition;

    // Recursively murge in any child APIs onto the promise so we can perform
    // the chaining.
    return Object.assign(promise, {
      // ...(typeof many === 'object' ? buildApi(path, many, apiOptions) : null),
      ...(typeof one === 'object' ? buildApi(path, one, apiOptions) : null),
    });
  }
) as ApiInterface<T, R>;

/**
 * Builds the API schema for a given `definition`
 *
 * @param prefix the path of the acutal API endpoint
 * @param definition the definition schema
 * @param options global options
 * @returns the API interface.
 */
export const buildApi = <T extends ApiDefinition>(
  prefix: string,
  definition: T,
  options: CreateApiOptions = {},
): Api<T> =>
  mapValues(definition, (resourceOrDefinition, key) =>
    isResourceDefinition(resourceOrDefinition)
      ? createInterface(`${prefix}/${key}`, resourceOrDefinition, options)
      : createInterface(
          `${prefix}/${key}`,
          {
            resource: resourceOrDefinition,
            many: true,
            one: true,
            pagination: true,
            sortable: true,
            filtering: true,
          },
          options
        ),
  ) as Api<T>;

/**
 * Creates a function that will generate the API schema with the supplied
 * `definition`. A `definition` is a mapping of endpoint names to
 * `ResourceDefinition` objects, which describe how the endpoint is used, and
 * what data it returns.
 *
 * @see ./v1/index.ts for an example.
 *
 * @param definition the `ApiDefinition` schema.
 * @returns a function that will create the API wrapper.
 */
export const createApi = <T extends ApiDefinition>(definition: T) =>
  /**
   * @param options global options for all endpoints in this instance
   * @returns the actual flow-like wrapper for the API.
   */
  ({ ...options }: CreateApiOptions = {}): Api<T> =>
    buildApi('', definition, options);
