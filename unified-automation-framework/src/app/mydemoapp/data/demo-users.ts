/**
 * Accounts built into the demo app and printed on its own login screen. They are public
 * sample values, not secrets, which is why they can live in code. Never do this for a real app.
 */
export const DEMO_USERS = {
  standard: { username: 'bod@example.com', password: '10203040' },
  lockedOut: { username: 'alice@example.com', password: '10203040' },
} as const;

export const MESSAGES = {
  usernameRequired: 'Username is required',
  passwordRequired: 'Enter Password',
  lockedOut: 'Sorry this user has been locked out.',
} as const;

/**
 * Version 2.3.0 crashes when most catalogue tiles are tapped (see the test plan): only the first
 * six positions can open, and position 1 ("Backpack (green)") crashes too. Tests that open a
 * product use the two entries below, which open reliably. Bike Light is only ever scrolled to.
 */
export const PRODUCTS = {
  backpack: 'Sauce Labs Backpack',
  backpackOrange: 'Sauce Labs Backpack (orange)',
  bikeLight: 'Sauce Labs Bike Light',
} as const;
