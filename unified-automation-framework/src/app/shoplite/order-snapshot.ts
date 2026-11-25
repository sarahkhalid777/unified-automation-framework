import { Money } from '../../data/value-objects/money';
import type { OrderItemRow, OrderRow } from './database/shoplite-database';
import type { Order } from './model';
import type { ConfirmationPage } from './pages/confirmation.page';

// The same order as seen by the UI, the API and the database, reduced to one shape
// so the three can be compared with a single equality check.
export interface OrderSnapshot {
  orderNumber: string;
  status: string;
  lines: Array<{ name: string; quantity: number; lineTotalCents: number }>;
  totalCents: number;
  shipTo: string;
}

// Matches how the confirmation page renders an address (sample-app/public/js/confirmation.js).
const shipTo = (s: { name: string; address: string; city: string; postcode: string; country: string }) =>
  `${s.name}, ${s.address}, ${s.city} ${s.postcode}, ${s.country}`;

const byName = <T extends { name: string }>(lines: T[]) => [...lines].sort((a, b) => a.name.localeCompare(b.name));

export function snapshotFromApi(order: Order): OrderSnapshot {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    lines: byName(order.items.map((i) => ({ name: i.name, quantity: i.quantity, lineTotalCents: i.lineTotalCents }))),
    totalCents: order.totalCents,
    shipTo: shipTo(order.shipping),
  };
}

export function snapshotFromDatabase(order: OrderRow, items: OrderItemRow[]): OrderSnapshot {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    lines: byName(items.map((i) => ({ name: i.productName, quantity: i.quantity, lineTotalCents: i.lineTotalCents }))),
    totalCents: order.totalCents,
    shipTo: shipTo({
      name: order.shippingName,
      address: order.shippingAddress,
      city: order.shippingCity,
      postcode: order.shippingPostcode,
      country: order.shippingCountry,
    }),
  };
}

const LINE_PATTERN = /^(\d+) x (.+) - (\$[\d,]+\.\d{2})$/;

export async function snapshotFromConfirmationPage(page: ConfirmationPage): Promise<OrderSnapshot> {
  await page.panel.waitFor();
  const lines = (await page.items.allTextContents()).map((text) => {
    const match = LINE_PATTERN.exec(text.trim());
    if (!match) throw new Error(`Unexpected order line on the confirmation page: "${text}"`);
    return { name: match[2]!, quantity: Number(match[1]), lineTotalCents: Money.parse(match[3]!).cents };
  });
  return {
    orderNumber: (await page.orderNumber.textContent())!.trim(),
    status: (await page.status.textContent())!.trim(),
    lines: byName(lines),
    totalCents: Money.parse((await page.total.textContent())!).cents,
    shipTo: (await page.shipping.textContent())!.trim(),
  };
}
