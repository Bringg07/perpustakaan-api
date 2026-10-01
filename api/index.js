/**
 * Entry point untuk Vercel Serverless Function.
 *
 * Vercel akan menjalankan file ini sebagai satu fungsi serverless dan
 * meneruskan seluruh request (lihat `vercel.json`) ke instance Express di
 * `src/app.js`.
 */

// Muat .env saat dijalankan lokal via `vercel dev`. Di Vercel production,
// environment berasal dari dashboard (Environment Variables), pemanggilan ini
// bersifat no-op bila file .env tidak ada.
try {
  require('dotenv').config();
} catch {
  // dotenv opsional — abaikan bila tidak tersedia.
}

const app = require('../src/app');

module.exports = app;
// Alias untuk interoperabilitas ESM (`import app from '../api/index.js'`).
module.exports.default = app;
