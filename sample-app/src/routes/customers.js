import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ApiError, EMAIL_PATTERN, Validator, isNonEmptyString, notFound, requireAuth, signToken } from '../http.js';
import { toCustomer } from '../mappers.js';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

function validateProfile(body, { partial }) {
  const v = new Validator();
  const has = (field) => body[field] !== undefined;
  if (!partial || has('firstName')) v.check(isNonEmptyString(body.firstName, 100), 'firstName', 'First name is required (max 100 chars)');
  if (!partial || has('lastName')) v.check(isNonEmptyString(body.lastName, 100), 'lastName', 'Last name is required (max 100 chars)');
  if (has('phone') && body.phone !== null) v.check(typeof body.phone === 'string' && PHONE_PATTERN.test(body.phone), 'phone', 'Phone number format is invalid');
  return v;
}

function assertSelf(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Customer id must be an integer');
  if (id !== req.customer.id) throw new ApiError(403, 'FORBIDDEN', 'Customers may only access their own record');
  return id;
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const v = new Validator();
  v.check(typeof email === 'string' && email.length > 0, 'email', 'Email is required');
  v.check(typeof password === 'string' && password.length > 0, 'password', 'Password is required');
  v.throwIfInvalid();

  const { rows } = await pool.query('SELECT * FROM customers WHERE email = $1', [email.trim().toLowerCase()]);
  const customer = rows[0];
  if (!customer || !(await bcrypt.compare(password, customer.password_hash))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  res.json({ token: signToken(customer), customer: toCustomer(customer) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.customer.id]);
  if (!rows[0]) throw notFound('Customer');
  res.json(toCustomer(rows[0]));
});

export const customersRouter = Router();

customersRouter.post('/', async (req, res) => {
  const body = req.body ?? {};
  const v = validateProfile(body, { partial: false });
  v.check(typeof body.email === 'string' && EMAIL_PATTERN.test(body.email) && body.email.length <= 254, 'email', 'A valid email address is required');
  v.check(typeof body.password === 'string' && PASSWORD_PATTERN.test(body.password), 'password', 'Password must be 8-72 characters and contain a letter and a digit');
  v.throwIfInvalid();

  const email = body.email.trim().toLowerCase();
  const hash = await bcrypt.hash(body.password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (email, password_hash, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [email, hash, body.firstName.trim(), body.lastName.trim(), body.phone ?? null],
    );
    res.status(201).location(`/api/customers/${rows[0].id}`).json(toCustomer(rows[0]));
  } catch (error) {
    if (error.code === '23505') throw new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    throw error;
  }
});

customersRouter.get('/:id', requireAuth, async (req, res) => {
  const id = assertSelf(req);
  const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
  if (!rows[0]) throw notFound('Customer');
  res.json(toCustomer(rows[0]));
});

async function updateProfile(req, res, partial) {
  const id = assertSelf(req);
  const body = req.body ?? {};
  if ('email' in body || 'password' in body) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password cannot be changed through this endpoint');
  }
  validateProfile(body, { partial }).throwIfInvalid();

  const fields = { first_name: body.firstName?.trim(), last_name: body.lastName?.trim(), phone: body.phone };
  if (!partial && fields.phone === undefined) fields.phone = null;
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'No updatable fields supplied');

  const assignments = entries.map(([column], index) => `${column} = $${index + 2}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE customers SET ${assignments}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...entries.map(([, value]) => value)],
  );
  if (!rows[0]) throw notFound('Customer');
  res.json(toCustomer(rows[0]));
}

customersRouter.put('/:id', requireAuth, (req, res) => updateProfile(req, res, false));
customersRouter.patch('/:id', requireAuth, (req, res) => updateProfile(req, res, true));

customersRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = assertSelf(req);
  const { rowCount } = await pool.query('DELETE FROM customers WHERE id = $1', [id]);
  if (rowCount === 0) throw notFound('Customer');
  res.status(204).end();
});
