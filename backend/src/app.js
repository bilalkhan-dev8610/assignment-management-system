const express = require('express');
const cors = require('cors');

const config = require('./config/env');
const routes = require('./routes');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5173',
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests like Postman/curl that don't send an Origin header
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '');

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
  })
);

app.use(express.json());

app.use('/api', routes);

app.use(notFound);

app.use(errorHandler);

module.exports = app;