import { api, el, formatMoney, requireLogin, showMessage } from './app.js';

const TAX_RATE = 0.08;
const form = document.querySelector('[data-testid="checkout-form"]');
const error = document.querySelector('[data-testid="checkout-error"]');
const setText = (testId, value) => {
  document.querySelector(`[data-testid="${testId}"]`).textContent = value;
};

if (requireLogin()) {
  const cart = await api('/cart');
  if (cart.items.length === 0) location.replace('/cart');
  const tax = Math.round(cart.subtotalCents * TAX_RATE);
  document.querySelector('[data-testid="checkout-summary"]').replaceChildren(
    ...cart.items.map((item) =>
      el('li', { 'data-testid': 'checkout-line', text: `${item.quantity} x ${item.name} - ${formatMoney(item.lineTotalCents)}` }),
    ),
  );
  setText('checkout-subtotal', formatMoney(cart.subtotalCents));
  setText('checkout-tax', formatMoney(tax));
  setText('checkout-total', formatMoney(cart.subtotalCents + tax));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  form.querySelectorAll('[data-error-for]').forEach((node) => (node.textContent = ''));
  const button = document.querySelector('[data-testid="place-order"]');
  button.disabled = true;
  try {
    const order = await api('/orders', { method: 'POST', body: { shipping: Object.fromEntries(new FormData(form)) } });
    location.assign(`/confirmation?order=${encodeURIComponent(order.orderNumber)}`);
  } catch (e) {
    for (const detail of e.body?.error?.details ?? []) {
      const target = form.querySelector(`[data-error-for="${detail.field}"]`);
      if (target) target.textContent = detail.message;
    }
    showMessage(error, e.message);
    button.disabled = false;
  }
});
