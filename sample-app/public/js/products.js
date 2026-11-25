import { api, el, formatMoney } from './app.js';

const form = document.querySelector('[data-testid="search-form"]');
const input = document.querySelector('[data-testid="search-input"]');
const list = document.querySelector('[data-testid="product-list"]');
const summary = document.querySelector('[data-testid="result-summary"]');

function card(product) {
  return el(
    'article',
    { class: 'card product-card', 'data-testid': 'product-card', 'data-product-id': String(product.id), 'data-sku': product.sku },
    el('h2', {}, el('a', { href: `/product?id=${product.id}`, 'data-testid': 'product-link', text: product.name })),
    el('p', { class: 'muted', 'data-testid': 'product-category', text: product.category }),
    el('p', { class: 'price', 'data-testid': 'product-price', text: formatMoney(product.priceCents) }),
  );
}

async function load(search) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const { items, total } = await api(`/products${query}`);
  list.replaceChildren(...items.map(card));
  summary.textContent = search ? `${total} result${total === 1 ? '' : 's'} for "${search}"` : `${total} products`;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const search = input.value.trim();
  const url = new URL(location.href);
  if (search) url.searchParams.set('search', search);
  else url.searchParams.delete('search');
  history.replaceState(null, '', url);
  load(search);
});

const initial = new URLSearchParams(location.search).get('search') ?? '';
input.value = initial;
load(initial);
