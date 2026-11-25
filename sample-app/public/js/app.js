// Shared browser-side helpers for ShopLite pages.
const TOKEN_KEY = 'shoplite.token';
const CUSTOMER_KEY = 'shoplite.customer';

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get customer() {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save(token, customer) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
  },
};

export class ApiRequestError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  const response = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 401 && session.token) {
    session.clear();
    redirectToLogin();
  }
  if (!response.ok) throw new ApiRequestError(response.status, data);
  return data;
}

export const formatMoney = (cents) => `$${(cents / 100).toFixed(2)}`;

export function redirectToLogin() {
  const returnTo = encodeURIComponent(location.pathname + location.search);
  location.assign(`/login?returnTo=${returnTo}`);
}

export function requireLogin() {
  if (!session.token) {
    redirectToLogin();
    return false;
  }
  return true;
}

export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

export function showMessage(target, message, kind = 'error') {
  target.textContent = message;
  target.className = `message message-${kind}`;
  target.hidden = false;
}

export async function refreshCartBadge() {
  const badge = document.querySelector('[data-testid="cart-count"]');
  if (!badge) return;
  if (!session.token) {
    badge.textContent = '0';
    return;
  }
  try {
    const cart = await api('/cart');
    badge.textContent = String(cart.itemCount);
  } catch {
    badge.textContent = '0';
  }
}

function renderHeader() {
  const header = document.querySelector('header.site-header');
  if (!header) return;
  const customer = session.customer;
  const account = customer
    ? [
        el('span', { 'data-testid': 'user-greeting', text: `Hi, ${customer.firstName}` }),
        el('a', { href: '/orders', text: 'My orders' }),
        el('button', {
          type: 'button',
          class: 'link-button',
          'data-testid': 'logout-button',
          text: 'Log out',
          onclick: () => {
            session.clear();
            location.assign('/login?loggedOut=1');
          },
        }),
      ]
    : [el('a', { href: '/login', 'data-testid': 'login-link', text: 'Log in' }), el('a', { href: '/register', text: 'Register' })];

  header.replaceChildren(
    el('a', { href: '/', class: 'brand', text: 'ShopLite' }),
    el(
      'nav',
      { 'aria-label': 'Main' },
      el('a', { href: '/', text: 'Products' }),
      el('a', { href: '/cart', 'aria-label': 'Cart' }, 'Cart (', el('span', { 'data-testid': 'cart-count', text: '0' }), ')'),
      ...account,
    ),
  );
  refreshCartBadge();
}

renderHeader();
