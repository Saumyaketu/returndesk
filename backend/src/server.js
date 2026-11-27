const express = require('express');
const cors = require('cors');
require('dotenv').config();

const requestRoutes = require('./routes/requestRoutes');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./lib/errors');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ReturnDesk Backend API',
    timestamp: new Date().toISOString(),
  });
});

// Mount domain routes
app.use('/api/requests', requestRoutes);

// Catch-all for undefined routes (Prevents default HTML 404 response per assignment spec)
app.use((req, res, next) => {
  next(new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found.`, 'ROUTE_NOT_FOUND'));
});

// Centralized error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[ReturnDesk] Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
