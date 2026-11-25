import type { ShippingAddress } from '../../../data/builders/shipping-address.builder';
import type { CartPage } from '../pages/cart.page';
import type { OrderNumber } from '../value-objects/order-number';
import type { CheckoutPage } from '../pages/checkout.page';
import type { ConfirmationPage } from '../pages/confirmation.page';
import type { LoginPage } from '../pages/login.page';
import type { ProductDetailPage } from '../pages/product-detail.page';
import type { ProductsPage } from '../pages/products.page';

export interface ShopperPages {
  login: LoginPage;
  products: ProductsPage;
  product: ProductDetailPage;
  cart: CartPage;
  checkout: CheckoutPage;
  confirmation: ConfirmationPage;
}

// What a customer does, in business terms, built from page objects. Each step waits until
// the UI has finished reacting, so the next step starts from a settled page. Verifying
// the outcome is left to the test.
export class ShopperFlow {
  constructor(private readonly pages: ShopperPages) {}

  async logIn(credentials: { email: string; password: string }): Promise<void> {
    await this.pages.login.open();
    await this.pages.login.logIn(credentials);
    await this.pages.login.header.greeting.waitFor();
  }

  async searchAndOpen(term: string, productName: string): Promise<void> {
    await this.pages.products.open();
    await this.pages.products.search(term);
    await this.pages.products.productCard(productName).waitFor();
    await this.pages.products.openProduct(productName);
    await this.pages.product.waitUntilReady();
  }

  async addOpenProductToCart(quantity: number): Promise<void> {
    await this.pages.product.addToCart(quantity);
    await this.pages.product.message.filter({ hasText: `Added ${quantity} to cart.` }).waitFor();
  }

  /** From the cart page through to the confirmation page. Returns the order number. */
  async checkOut(address: ShippingAddress): Promise<OrderNumber> {
    await this.pages.cart.open();
    await this.pages.cart.proceedToCheckout.click();
    await this.pages.checkout.waitUntilReady();
    await this.pages.checkout.fillShipping(address);
    await this.pages.checkout.placeOrder();
    await this.pages.confirmation.panel.waitFor();
    return this.pages.confirmation.orderNumberFromUrl();
  }
}
