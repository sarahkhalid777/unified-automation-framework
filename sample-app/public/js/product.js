import { api, formatMoney, refreshCartBadge, requireLogin, showMessage } from './app.js';

const id = new URLSearchParams(location.search).get('id') ?? '';
const detail = document.querySelector('[data-testid="product-detail"]');
const message = document.querySelector('[data-testid="product-message"]');
const setText = (testId, value) => {
  document.querySelector(`[data-testid="${testId}"]`).textContent = value;
};

try {
  const product = await api(`/products/${encodeURIComponent(id)}`);
  document.title = `${product.name} | ShopLite`;
  detail.dataset.productId = String(product.id);
  setText('product-name', product.name);
  setText('product-sku', product.sku);
  setText('product-category', product.category);
  setText('product-description', product.description);
  setText('product-price', formatMoney(product.priceCents));
  setText('product-stock', String(product.stock));
  detail.hidden = false;
} catch (e) {
  showMessage(message, e.status === 404 ? 'Product not found.' : e.message);
}

document.querySelector('[data-testid="add-to-cart"]').addEventListener('click', async () => {
  if (!requireLogin()) return;
  const quantity = Number(document.querySelector('[data-testid="product-quantity"]').value);
  try {
    await api('/cart/items', { method: 'POST', body: { productId: Number(id), quantity } });
    showMessage(message, `Added ${quantity} to cart.`, 'success');
    await refreshCartBadge();
  } catch (e) {
    showMessage(message, e.message);
  }
});
