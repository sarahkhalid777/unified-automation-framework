import { faker } from '@faker-js/faker';

export interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

// Reserved for documentation/testing (RFC 2606), so generated addresses can never reach a real inbox.
// The pre-run sweep deletes stale customers in this domain, so the two must stay in step - hence one constant.
export const TEST_EMAIL_DOMAIN = 'example.test';

// Timestamp + random suffix: unique across parallel workers and across re-runs against the same database.
export function uniqueEmail(prefix = 'qa'): string {
  const suffix = faker.string.alphanumeric({ length: 6, casing: 'lower' });
  return `${prefix}.${Date.now().toString(36)}.${suffix}@${TEST_EMAIL_DOMAIN}`;
}

// Meets the app's rule (8-72 chars, at least one letter and one digit) without depending on random luck.
export function validPassword(): string {
  return `Qa${faker.number.int({ min: 0, max: 9 })}${faker.string.alphanumeric(9)}`;
}

export class CustomerBuilder {
  private readonly data: CustomerData = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: uniqueEmail(),
    password: validPassword(),
  };

  withFirstName(firstName: string): this {
    this.data.firstName = firstName;
    return this;
  }

  withLastName(lastName: string): this {
    this.data.lastName = lastName;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withPassword(password: string): this {
    this.data.password = password;
    return this;
  }

  withPhone(phone: string): this {
    this.data.phone = phone;
    return this;
  }

  build(): CustomerData {
    return { ...this.data };
  }
}

export const aCustomer = (): CustomerBuilder => new CustomerBuilder();
