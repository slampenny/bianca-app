const m2s = require('mongoose-to-swagger');
const config = require('../config/config');
const { version } = require('../../package.json');
const {
  Caregiver,  
  Conversation, 
  Call,
  Message,
  Org,
  Patient, 
  Report, 
  Schedule,
  Token, 
} = require('../models');

const swaggerDef = {
  openapi: '3.0.0',
  info: {
    title: 'Bianca--The Wellness Check app',
    version,
    license: {
      name: 'MIT',
      url: 'https://github.com/hagopj13/node-express-boilerplate/blob/master/LICENSE',
    },
  },
  components: {
    schemas: {
      Caregiver: m2s(Caregiver, { omitFields: ['password', 'isEmailVerified'] }),
      Conversation: m2s(Conversation),
      Call: m2s(Call),
      Org: m2s(Org),
      Patient: m2s(Patient),
      Token: m2s(Token),
      AuthToken: {
        title: 'AuthToken',
        required: ['value', 'expiry'],
        properties: {
          value: {
            type: 'string',
          },
          expiry: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      AuthTokens: {
        title: 'AuthTokens',
        required: ['accessToken', 'refreshToken'],
        properties: {
          accessToken: {
            $ref: '#/components/schemas/AuthToken',
          },
          refreshToken: {
            $ref: '#/components/schemas/AuthToken',
          },
        },
      },
      Schedule: m2s(Schedule),
      Message: m2s(Message),
      Report: m2s(Report),
      Error: {
        description: 'Server Error Occurred',
      },
    },
    responses: {
      NotFound: {
        description: 'Not Found',
      },
      Unauthorized: {
        description: 'Unauthorized',
      },
      Forbidden: {
        description: 'Forbidden',
      },
      DuplicateEmail: {
        description: 'Email already exists',
      },
      BadRequest: {
        description: 'Bad Request',
      },
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}/v1`,
    },
  ],
};

module.exports = swaggerDef;
