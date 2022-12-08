import { chain, mapValues } from 'lodash';

/**
 * Primitive types for request queries.
 */
type Primitive = string | number | null;

/**
 *
 */
export type IsFilter = Primitive | RegExp;

/**
 *
 */
export type NotFilter = {
  readonly $ne: Primitive | RegExp;
};

/**
 *
 */
export type ExistFilter = boolean;

/**
 *
 */
export type IncludeFilter = Primitive[];

/**
 *
 */
export type ExcludeFilter = {
  readonly $nin: Primitive[];
}

/**
 *
 */
export interface ComparisonFilter {
  readonly $gt?: number;
  readonly $gte?: number;
  readonly $lt?: number;
  readonly $lte?: number;
}

/**
 *
 */
export type Filter =
  | IsFilter
  | NotFilter
  | ExistFilter
  | IncludeFilter
  | ExcludeFilter
  | ComparisonFilter;

/**
 * @param filter a filter to check
 * @returns true iff the filter should be encoded when serialized
 */
const canEncode = (filter: Filter): filter is string | RegExp =>
  typeof filter === 'string' || filter instanceof RegExp;

/**
 *
 * @param filter a filter to encode
 * @returns a URL-encoded version of the filter if it can be encoded, or the
 *    filter again (unmodified) otherwise.
 */
const encode = <T extends Filter>(filter: T): string | T => {
  if (Array.isArray(filter)) return filter.map(encode) as T;

  return canEncode(filter) ? encodeURIComponent(filter.toString()) : filter;
};

/**
 * Convert API endpoint filter definitions into the appropriate URL-encoded
 * query parameters with a specific MongoDB-related filter syntax.
 *
 * @param filters the set of filters
 * @returns a URL-encoded representation of the filters to be used in API
 *    requests as query parameters.
 */
export const stringifyFilters = (filters: Record<string, Filter>) =>
  chain(filters)
    .mapKeys((value, key) => encode(key))
    .mapValues((value, key) => encode(value))
    .entries()
    .flatMap(([ key, value ]) => {
      // Existence filtering
      if (typeof value === 'boolean') return `${value ? '' : '!'}${key}`;

      // Include filtering
      if (Array.isArray(value)) return `${key}=${value.join(',')}`;

      // Equality filtering
      if (value === null || typeof value !== 'object') {
        return `${key}=${value}`;
      }

      // Negations
      if ('$ne' in value) return `${key}!=${value.$ne}`;
      if ('$nin' in value) return `${key}!=${value.$nin.join(',')}`;

      // Numeric comparisons
      // TODO: Shouldn't allow all of these to be present at the same time...
      const comparisons: string[] = [];
      if ('$gt' in value) comparisons.push(`${key}>${value.$gt}`);
      if ('$lt' in value) comparisons.push(`${key}<${value.$lt}`);
      if ('$gte' in value) comparisons.push(`${key}>=${value.$gte}`);
      if ('$lte' in value) comparisons.push(`${key}<=${value.$lte}`);

      return comparisons;
    })
    .join('&')
    .value();
