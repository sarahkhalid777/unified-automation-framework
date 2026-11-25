import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';

/** Reference catalogue. Upserted by SKU so seeding is idempotent and never duplicates rows. */
export const PRODUCTS = [
  ['SL-BAG-001', 'Trailblazer Backpack', 'Water-resistant 28L backpack with padded laptop sleeve.', 'Bags', 5999, 40],
  ['SL-BAG-002', 'City Commuter Tote', 'Canvas tote with zip pocket and reinforced handles.', 'Bags', 2499, 60],
  ['SL-TOP-001', 'Classic Cotton T-Shirt', 'Organic cotton crew-neck t-shirt.', 'Clothing', 1599, 150],
  ['SL-TOP-002', 'Merino Wool Sweater', 'Lightweight merino sweater for all seasons.', 'Clothing', 7900, 35],
  ['SL-JKT-001', 'Storm Shell Jacket', 'Breathable waterproof jacket with taped seams.', 'Clothing', 12900, 20],
  ['SL-ELE-001', 'Wireless Earbuds Pro', 'Noise-cancelling earbuds with 24h battery case.', 'Electronics', 8999, 75],
  ['SL-ELE-002', 'Bluetooth Speaker Mini', 'Pocket-size speaker with 12h playback.', 'Electronics', 3499, 90],
  ['SL-ELE-003', 'USB-C Fast Charger', '65W GaN charger with two USB-C ports.', 'Electronics', 2999, 120],
  ['SL-HOM-001', 'Ceramic Pour-Over Set', 'Hand-glazed dripper with matching mug.', 'Home', 3200, 45],
  ['SL-HOM-002', 'Bamboo Desk Organiser', 'Five-compartment organiser made from bamboo.', 'Home', 1899, 80],
  ['SL-FIT-001', 'Yoga Mat Plus', '6mm non-slip yoga mat with carry strap.', 'Fitness', 3999, 55],
  ['SL-FIT-002', 'Insulated Water Bottle', 'Stainless steel bottle keeps drinks cold for 24h.', 'Fitness', 2299, 200],
];

export const DEMO_CUSTOMER = { email: 'demo@shoplite.test', password: 'Demo@12345', firstName: 'Demo', lastName: 'Shopper' };

export async function seed() {
  for (const [sku, name, description, category, priceCents, stock] of PRODUCTS) {
    await pool.query(
      `INSERT INTO products (sku, name, description, category, price_cents, stock)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sku) DO UPDATE
         SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
             price_cents = EXCLUDED.price_cents, stock = GREATEST(products.stock, EXCLUDED.stock)`,
      [sku, name, description, category, priceCents, stock],
    );
  }
  const hash = await bcrypt.hash(DEMO_CUSTOMER.password, 10);
  await pool.query(
    `INSERT INTO customers (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
    [DEMO_CUSTOMER.email, hash, DEMO_CUSTOMER.firstName, DEMO_CUSTOMER.lastName],
  );
}

if (process.argv[1].endsWith('seed.js')) {
  seed()
    .then(() => console.log(`[seed] ${PRODUCTS.length} products and demo customer ensured`))
    .catch((error) => {
      console.error('[seed] failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
