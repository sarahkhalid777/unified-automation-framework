import { bodyOf } from '../../api/api-response';
import type { CustomerData } from '../../data/builders/customer.builder';
import type { ShippingAddress } from '../../data/builders/shipping-address.builder';
import type { ShopLiteEndpoints } from './api/shoplite-endpoints';
import type { OrderPlan } from './data/order.builder';
import type { ProductId } from './ids';
import type { AuthSession, Cart, Customer, Order, Product, ProductList } from './model';

// For arranging state in web and integration tests: each call returns the body or throws
// if the status is not the expected one. API tests use ShopLiteEndpoints directly instead,
// because they need to see every response, including errors.
export class ShopLiteApi {
  constructor(private readonly endpoints: ShopLiteEndpoints) {}

  async registerCustomer(customer: CustomerData): Promise<Customer> {
    return bodyOf(await this.endpoints.customers.register(customer), 201);
  }

  async logIn(email: string, password: string): Promise<AuthSession> {
    return bodyOf(await this.endpoints.auth.login({ email, password }), 200);
  }

  /** Cascades to the customer's carts and orders. 404 means it is already gone. */
  async deleteCustomer(session: AuthSession): Promise<void> {
    bodyOf(await this.endpoints.as(session).customers.delete(session.customer.id), 204, 404);
  }

  async listProducts(search?: string): Promise<ProductList> {
    return bodyOf(await this.endpoints.products.list(search ? { search } : {}), 200);
  }

  async getProduct(id: ProductId): Promise<Product> {
    return bodyOf(await this.endpoints.products.get(id), 200);
  }

  async getCart(session: AuthSession): Promise<Cart> {
    return bodyOf(await this.endpoints.as(session).cart.get(), 200);
  }

  async addToCart(session: AuthSession, productId: ProductId, quantity: number): Promise<Cart> {
    return bodyOf(await this.endpoints.as(session).cart.addItem({ productId, quantity }), 201);
  }

  /** Puts every line of the plan into the customer's cart. Returns the resulting cart. */
  async fillCart(session: AuthSession, plan: OrderPlan): Promise<Cart> {
    let cart: Cart | undefined;
    for (const line of plan.lines) cart = await this.addToCart(session, line.product.id, line.quantity);
    return cart!;
  }

  async placeOrder(session: AuthSession, shipping: ShippingAddress): Promise<Order> {
    return bodyOf(await this.endpoints.as(session).orders.place(shipping), 201);
  }
}
