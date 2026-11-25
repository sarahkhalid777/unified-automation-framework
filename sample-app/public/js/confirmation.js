import { api, el, formatMoney, requireLogin, showMessage } from './app.js';

const orderNumber = new URLSearchParams(location.search).get('order') ?? '';
const setText = (testId, value) => {
  document.querySelector(`[data-testid="${testId}"]`).textContent = value;
};

if (requireLogin()) {
  try {
    const order = await api(`/orders/${encodeURIComponent(orderNumber)}`);
    const s = order.shipping;
    setText('order-number', order.orderNumber);
    setText('order-status', order.status);
    setText('order-total', formatMoney(order.totalCents));
    setText('order-shipping', `${s.name}, ${s.address}, ${s.city} ${s.postcode}, ${s.country}`);
    document.querySelector('[data-testid="order-items"]').replaceChildren(
      ...order.items.map((item) =>
        el('li', { 'data-testid': 'order-item', text: `${item.quantity} x ${item.name} - ${formatMoney(item.lineTotalCents)}` }),
      ),
    );
    document.querySelector('[data-testid="order-confirmation"]').hidden = false;
  } catch (e) {
    showMessage(document.querySelector('[data-testid="confirmation-error"]'), e.message);
  }
}
