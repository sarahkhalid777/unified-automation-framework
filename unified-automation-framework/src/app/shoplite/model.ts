// Response shapes of the ShopLite REST API (sample-app/src/mappers.js and routes).
import type { ShippingAddress } from '../../data/builders/shipping-address.builder';
import type { CartId, CustomerId, OrderId, ProductId } from './ids';

export interface Customer {
  id: CustomerId;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  customer: Customer;
}

export interface Product {
  id: ProductId;
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  currency: 'USD';
  stock: number;
}

export interface ProductList {
  items: Product[];
  total: number;
}

export interface CartItem {
  productId: ProductId;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface Cart {
  id: CartId;
  customerId: CustomerId;
  status: 'OPEN' | 'CHECKED_OUT';
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  currency: 'USD';
}

export interface OrderItem {
  productId: ProductId;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderSummaryList {
  items: Array<Pick<Order, 'orderNumber' | 'status' | 'totalCents' | 'createdAt'>>;
  total: number;
}

export interface Order {
  id: OrderId;
  orderNumber: string;
  customerId: CustomerId;
  status: 'PLACED' | 'CANCELLED';
  items: OrderItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: 'USD';
  shipping: ShippingAddress;
  createdAt: string;
}
