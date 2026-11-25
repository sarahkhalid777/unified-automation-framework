import { expect } from '@wdio/globals';
import { DEMO_USERS, MESSAGES } from '../../src/app/mydemoapp/data/demo-users';
import { MyDemoApp } from '../../src/app/mydemoapp/my-demo-app';
import { getMobileConfig } from '../../src/mobile/mobile-config';

describe('Login', () => {
  // Created in a hook: the global browser only has its commands once the session exists.
  let app: MyDemoApp;
  before(() => {
    app = new MyDemoApp(browser, getMobileConfig());
  });

  beforeEach(async () => {
    await app.freshStart();
    await app.nav.openLogin();
  });

  it('MOB-AUTH-001 a valid user logs in and returns to the catalogue @smoke', async () => {
    await app.login.logIn(DEMO_USERS.standard.username, DEMO_USERS.standard.password);

    await app.catalog.waitUntilShown();
    expect(await app.nav.isLoggedIn()).toBe(true);
  });

  it('MOB-AUTH-002 login without a username is rejected', async () => {
    await app.login.logIn('', DEMO_USERS.standard.password);

    expect(await app.login.usernameErrorText()).toBe(MESSAGES.usernameRequired);
    expect(await app.login.isShown()).toBe(true);
  });

  it('MOB-AUTH-003 a locked-out user cannot log in', async () => {
    await app.login.logIn(DEMO_USERS.lockedOut.username, DEMO_USERS.lockedOut.password);

    expect(await app.login.passwordErrorText()).toBe(MESSAGES.lockedOut);
    expect(await app.login.isShown()).toBe(true);
    expect(await app.nav.isLoggedIn()).toBe(false);
  });
});
