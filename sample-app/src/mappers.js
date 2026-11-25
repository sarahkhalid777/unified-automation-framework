export const toCustomer = (row) => ({
  id: Number(row.id),
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  phone: row.phone,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const toProduct = (row) => ({
  id: Number(row.id),
  sku: row.sku,
  name: row.name,
  description: row.description,
  category: row.category,
  priceCents: row.price_cents,
  currency: 'USD',
  stock: row.stock,
});
