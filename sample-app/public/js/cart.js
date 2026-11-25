import { api, el, formatMoney, refreshCartBadge, requireLogin, showMessage } from './app.js';

const rows = document.querySelector('[data-testid="cart-items"]');
const content = document.querySelector('[data-testid="cart-content"]');
const empty = document.querySelector('[data-testid="cart-empty"]');
const message = document.querySelector('[data-testid="cart-message"]');

function render(cart) {
  rows.replaceChildren(...cart.items.map(row));
  document.querySelector('[data-testid="cart-subtotal"]').textContent = formatMoney(cart.subtotalCents);
  content.hidden = cart.items.length === 0;
  empty.hidden = cart.items.length > 0;
}

async function mutate(path, method, body, successText) {
  try {
    render(await api(path, { method, body }));
    showMessage(message, successText, 'success');
    await refreshCartBadge();
  } catch (e) {
    showMessage(message, e.message);
  }
}

function row(item) {
  const quantity = el('input', {
    type: 'number', min: '1', max: '99', value: String(item.quantity),
    'aria-label': `Quantity for ${item.name}`, 'data-testid': 'cart-item-quantity',
  });
  const itemPath = `/cart/items/${item.productId}`;
  return el(
    'tr',
    { 'data-testid': 'cart-item', 'data-product-id': String(item.productId) },
    el('td', { 'data-testid': 'cart-item-name', text: item.name }),
    el('td', { 'data-testid': 'cart-item-unit-price', text: formatMoney(item.unitPriceCents) }),
    el('td', {}, quantity),
    el('td', { 'data-testid': 'cart-item-line-total', text: formatMoney(item.lineTotalCents) }),
    el(
      'td',
      {},
      el('button', {
        type: 'button', class: 'secondary', 'data-testid': 'cart-item-update', text: 'Update',
        onclick: () => mutate(itemPath, 'PATCH', { quantity: Number(quantity.value) }, `Updated ${item.name}.`),
      }),
      ' ',
      el('button', {
        type: 'button', class: 'secondary', 'data-testid': 'cart-item-remove', text: 'Remove',
        onclick: () => mutate(itemPath, 'DELETE', undefined, `Removed ${item.name}.`),
      }),
    ),
  );
}

if (requireLogin()) {
  render(await api('/cart'));
}
