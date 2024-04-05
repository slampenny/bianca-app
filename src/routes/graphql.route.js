const express = require('express');
const helmet = require('helmet');

const router = express.Router();

module.exports = (yoga) => {
    router.use(
        helmet({
          contentSecurityPolicy: {
            directives: {
              'default-src': ["'self'"],
              'style-src': ["'self'", 'unpkg.com'],
              'script-src': ["'self'", 'unpkg.com', "'unsafe-inline'"],
              'img-src': ["'self'", 'raw.githubusercontent.com'],
            },
          },
        })
    );
      
    router.use(yoga)

    return router
}