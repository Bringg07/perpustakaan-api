/**
 * Health check / info API.
 * Berguna untuk memastikan deployment Vercel berjalan.
 */
function getHealth(req, res) {
  return res.status(200).json({
    success: true,
    message: 'API Pencatatan Peminjaman Buku Perpustakaan berjalan dengan baik.',
    data: {
      service: 'perpustakaan-api',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = { getHealth };
