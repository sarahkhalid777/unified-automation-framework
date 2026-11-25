// How a request proves who it is. Swapping strategies lets the same client serve anonymous and
// bearer-token calls (and, for another app, e.g. an API key) without branching inside the client.
export interface AuthStrategy {
  headers(): Record<string, string>;
}

export const noAuth: AuthStrategy = { headers: () => ({}) };

export class BearerTokenAuth implements AuthStrategy {
  constructor(private readonly token: string) {}

  headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }
}

export const bearer = (token: string): AuthStrategy => new BearerTokenAuth(token);
