import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ApiError, notFound } from '../http.js';
import { toProduct } from '../mappers.js';

export const productsRouter = Router();

productsRouter.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const conditions = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length} OR sku ILIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM products ${where} ORDER BY name`, params);
  res.json({ items: rows.map(toProduct), total: rows.length });
});

productsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Product id must be a positive integer');
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  if (!rows[0]) throw notFound('Product');
  res.json(toProduct(rows[0]));
});
