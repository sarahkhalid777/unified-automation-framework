import { faker } from '@faker-js/faker';

export interface ShippingAddress {
  name: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
}

export class ShippingAddressBuilder {
  private readonly data: ShippingAddress = {
    name: faker.person.fullName(),
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    postcode: faker.string.numeric(5),
    country: faker.location.country(),
  };

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withPostcode(postcode: string): this {
    this.data.postcode = postcode;
    return this;
  }

  withCountry(country: string): this {
    this.data.country = country;
    return this;
  }

  build(): ShippingAddress {
    return { ...this.data };
  }
}

export const aShippingAddress = (): ShippingAddressBuilder => new ShippingAddressBuilder();
