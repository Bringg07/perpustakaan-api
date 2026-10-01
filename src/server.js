require('dotenv').config();

const app = require('./app');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  ============================================================');
  console.log('   API Pencatatan Peminjaman Buku Perpustakaan');
  console.log('  ============================================================');
  console.log(`   Berjalan di : http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Base URL    : http://localhost:${PORT}/loans`);
  console.log('  ============================================================');
  console.log('');
});

// Tangani sinyal berhenti agar koneksi ditutup dengan rapi.
const shutdown = (signal) => {
  console.log(`\nMenerima ${signal}, menutup server...`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
