declare const brand: unique symbol;

/**
 * A number or string that the compiler treats as its own type. At run time it is the
 * plain value (JSON in, JSON out); at compile time a ProductId can't be passed where a
 * CustomerId is expected. Used for identifiers, which are otherwise all just numbers.
 */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
