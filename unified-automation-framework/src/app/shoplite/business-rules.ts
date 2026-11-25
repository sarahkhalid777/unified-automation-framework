// ShopLite rules the tests compute expected values from. Source: sample-app/src/routes/orders.js.
export const TAX_RATE = 0.08;

// localStorage keys the web UI keeps its session in (sample-app/public/js/app.js).
export const SESSION_STORAGE_KEYS = { token: 'shoplite.token', customer: 'shoplite.customer' } as const;

export const MESSAGES = {
  invalidCredentials: 'Email or password is incorrect',
  loggedOut: 'You have been logged out.',
  validationFailed: 'Request validation failed',
} as const;
