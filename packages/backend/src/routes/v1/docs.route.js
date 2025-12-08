const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('../../docs/swaggerDef');

const router = express.Router();

const specs = swaggerJsdoc({
  swaggerDefinition,
  apis: ['src/docs/*.yml', 'src/routes/v1/*.js'],
  // Exclude backup files and other non-route files
  ignore: ['**/*.backup', '**/*.bak', '**/*.old'],
});

router.get('/swagger.json', (_req, res) => res.json(specs, null, 2));
router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    swaggerOptions: {
      url: '/v1/docs/swagger.json',
      persistAuthorization: true,
      // Ensure requests use the correct base URL
      requestInterceptor: (request) => {
        // Ensure request URL is absolute if needed
        if (request.url && !request.url.startsWith('http')) {
          // If relative URL, it should work fine with the same origin
          // Swagger UI will handle relative URLs correctly
        }
        return request;
      },
    },
    customSiteTitle: 'Bianca API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui-standalone-preset.min.js',
    ],
  })
);

module.exports = router;
