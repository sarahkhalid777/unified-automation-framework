import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { correlation, errorHandler, notFound } from './http.js';
import { logger } from './logger.js';
import { cartRouter } from './routes/cart.js';
import { authRouter, customersRouter } from './routes/customers.js';
import { ordersRouter } from './routes/orders.js';
import { productsRouter } from './routes/products.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(correlation);

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api', () => {
    throw notFound('Endpoint');
  });

  app.use(express.static(path.join(config.appRoot, 'public'), { extensions: ['html'] }));
  app.use(errorHandler);
  return app;
}

export function startServer() {
  return new Promise((resolve) => {
    const server = createApp().listen(config.port, () => {
      logger.info(`ShopLite listening on http://localhost:${config.port}`);
      resolve(server);
    });
  });
}

if (process.argv[1].endsWith('server.js')) {
  await startServer();
}
