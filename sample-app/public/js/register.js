import { api, showMessage } from './app.js';

const form = document.querySelector('[data-testid="register-form"]');
const error = document.querySelector('[data-testid="register-error"]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  try {
    await api('/customers', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    location.assign('/login?registered=1');
  } catch (e) {
    const details = e.body?.error?.details?.map((d) => d.message).join('. ');
    showMessage(error, details || e.message);
  }
});
