import { api, session, showMessage } from './app.js';

const form = document.querySelector('[data-testid="login-form"]');
const error = document.querySelector('[data-testid="login-error"]');
const notice = document.querySelector('[data-testid="login-notice"]');
const params = new URLSearchParams(location.search);

if (params.has('loggedOut')) showMessage(notice, 'You have been logged out.', 'success');
else if (params.has('registered')) showMessage(notice, 'Account created. Please log in.', 'success');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const data = new FormData(form);
  try {
    const { token, customer } = await api('/auth/login', {
      method: 'POST',
      body: { email: String(data.get('email')).trim(), password: String(data.get('password')) },
    });
    session.save(token, customer);
    const returnTo = params.get('returnTo');
    location.assign(returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/');
  } catch (e) {
    showMessage(error, e.message);
  }
});
