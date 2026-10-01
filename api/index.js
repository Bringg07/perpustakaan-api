/**
 * Entry point untuk Vercel Serverless Function.
 *
 * Vercel akan menjalankan file ini sebagai satu fungsi serverless dan
 * meneruskan seluruh request (lihat `vercel.json`) ke instance Express di
 * `src/app.js`.
 */
const app = require('../src/app');

module.exports = app;
