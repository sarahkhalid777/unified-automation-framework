import authSession from './auth-session.json';
import cart from './cart.json';
import customer from './customer.json';
import error from './error.json';
import orderList from './order-list.json';
import order from './order.json';
import productList from './product-list.json';
import product from './product.json';

export const SHOPLITE_SCHEMAS = [customer, authSession, product, productList, cart, order, orderList, error];

// Referenced by $id so error messages name the contract that was broken.
export const Schema = {
  customer: customer.$id,
  authSession: authSession.$id,
  product: product.$id,
  productList: productList.$id,
  cart: cart.$id,
  order: order.$id,
  orderList: orderList.$id,
  error: error.$id,
} as const;
