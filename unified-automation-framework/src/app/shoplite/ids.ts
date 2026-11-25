import type { Brand } from '../../data/value-objects/brand';

// ShopLite identifiers. The API and database hand these out; tests only pass them along,
// so there is no constructor - values arrive already typed through the model and row types.
export type CustomerId = Brand<number, 'CustomerId'>;
export type ProductId = Brand<number, 'ProductId'>;
export type CartId = Brand<number, 'CartId'>;
export type OrderId = Brand<number, 'OrderId'>;

/** For negative tests that need an id the application has never issued. */
export const nonExistentProductId = 999_999_999 as ProductId;
