const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ---------- Konfigurasi dasar ----------
app.disable('x-powered-by');
app.set('trust proxy', true);

// ---------- Middleware global ----------
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger sederhana (hanya saat development agar log Vercel tetap ringkas).
const SILENT_ENVS = ['production', 'test'];
if (!SILENT_ENVS.includes(process.env.NODE_ENV)) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });
}

// ---------- Rute ----------
// Dipasang pada root DAN /api supaya kompatibel baik saat dijalankan lokal
// maupun setelah di-deploy ke Vercel (rewrite ke /api).
app.use('/', routes);
app.use('/api', routes);

// ---------- Penanganan 404 & error ----------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
