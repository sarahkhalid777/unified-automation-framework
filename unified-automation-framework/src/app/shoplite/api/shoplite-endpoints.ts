import type { ApiClient } from '../../../api/api-client';
import { bearer } from '../../../api/auth';
import type { CustomerData } from '../../../data/builders/customer.builder';
import type { ShippingAddress } from '../../../data/builders/shipping-address.builder';
import type { CustomerId, ProductId } from '../ids';
import type { AuthSession, Cart, Customer, Order, OrderSummaryList, Product, ProductList } from '../model';
import type { OrderNumber } from '../value-objects/order-number';

export type CustomerProfile = Pick<CustomerData, 'firstName' | 'lastName'> & { phone?: string | null };

// One class per resource. Methods return the raw ApiResponse so tests can assert on
// error responses as easily as on successful ones. Bodies are loosely typed where
// negative tests need to send incomplete or malformed data.

class AuthEndpoint {
  constructor(private readonly client: ApiClient) {}

  login(credentials: { email?: string; password?: string }) {
    return this.client.post<AuthSession>('auth/login', credentials);
  }

  me() {
    return this.client.get<Customer>('auth/me');
  }
}

class CustomersEndpoint {
  constructor(private readonly client: ApiClient) {}

  register(customer: Partial<CustomerData> | Record<string, unknown>) {
    return this.client.post<Customer>('customers', customer);
  }

  get(id: CustomerId) {
    return this.client.get<Customer>(`customers/${id}`);
  }

  replace(id: CustomerId, profile: CustomerProfile | Record<string, unknown>) {
    return this.client.put<Customer>(`customers/${id}`, profile);
  }

  update(id: CustomerId, changes: Partial<CustomerProfile> | Record<string, unknown>) {
    return this.client.patch<Customer>(`customers/${id}`, changes);
  }

  delete(id: CustomerId) {
    return this.client.delete(`customers/${id}`);
  }
}

class ProductsEndpoint {
  constructor(private readonly client: ApiClient) {}

  list(query: { search?: string; category?: string } = {}) {
    const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));
    return this.client.get<ProductList>('products', { params });
  }

  // Strings are accepted so negative tests can send ids like "abc".
  get(id: ProductId | string) {
    return this.client.get<Product>(`products/${id}`);
  }
}

class CartEndpoint {
  constructor(private readonly client: ApiClient) {}

  get() {
    return this.client.get<Cart>('cart');
  }

  create() {
    return this.client.post<Cart>('cart');
  }

  addItem(item: { productId: ProductId; quantity?: number }) {
    return this.client.post<Cart>('cart/items', item);
  }

  updateItem(productId: ProductId, quantity: number) {
    return this.client.patch<Cart>(`cart/items/${productId}`, { quantity });
  }

  removeItem(productId: ProductId) {
    return this.client.delete<Cart>(`cart/items/${productId}`);
  }

  clear() {
    return this.client.delete<Cart>('cart');
  }
}

class OrdersEndpoint {
  constructor(private readonly client: ApiClient) {}

  place(shipping: Partial<ShippingAddress>) {
    return this.client.post<Order>('orders', { shipping });
  }

  list() {
    return this.client.get<OrderSummaryList>('orders');
  }

  get(orderNumber: OrderNumber | string) {
    return this.client.get<Order>(`orders/${encodeURIComponent(String(orderNumber))}`);
  }
}

export class ShopLiteEndpoints {
  readonly auth: AuthEndpoint;
  readonly customers: CustomersEndpoint;
  readonly products: ProductsEndpoint;
  readonly cart: CartEndpoint;
  readonly orders: OrdersEndpoint;

  constructor(private readonly client: ApiClient) {
    this.auth = new AuthEndpoint(client);
    this.customers = new CustomersEndpoint(client);
    this.products = new ProductsEndpoint(client);
    this.cart = new CartEndpoint(client);
    this.orders = new OrdersEndpoint(client);
  }

  /** The same endpoints, calling as the given customer. */
  as(session: AuthSession | string): ShopLiteEndpoints {
    return new ShopLiteEndpoints(this.client.withAuth(bearer(typeof session === 'string' ? session : session.token)));
  }
}
