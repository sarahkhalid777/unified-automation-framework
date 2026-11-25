import { api, el, formatMoney, requireLogin } from './app.js';

if (requireLogin()) {
  const { items } = await api('/orders');
  const table = document.querySelector('[data-testid="orders-table"]');
  table.querySelector('tbody').replaceChildren(
    ...items.map((order) =>
      el(
        'tr',
        { 'data-testid': 'order-row' },
        el('td', {}, el('a', { href: `/confirmation?order=${encodeURIComponent(order.orderNumber)}`, text: order.orderNumber })),
        el('td', { text: new Date(order.createdAt).toLocaleDateString() }),
        el('td', { text: order.status }),
        el('td', { text: formatMoney(order.totalCents) }),
      ),
    ),
  );
  table.hidden = items.length === 0;
  document.querySelector('[data-testid="orders-empty"]').hidden = items.length > 0;
}
