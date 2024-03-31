const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const AWS = require('aws-sdk');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    // PORT: Joi.number().default(3000),
    // MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    // JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    // JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    // JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
    //   .default(10)
    //   .description('minutes after which reset password token expires'),
    // JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
    //   .default(10)
    //   .description('minutes after which verify email token expires'),
    // SMTP_HOST: Joi.string().description('server that will send the emails'),
    // SMTP_PORT: Joi.number().description('port to connect to the email server'),
    SMTP_USERNAME: Joi.string().description('username for email server'),
    SMTP_PASSWORD: Joi.string().description('password for email server'),
    //EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),
    TWILIO_PHONENUMBER: Joi.string().description('twilio phone number'),
    TWILIO_ACCOUNTSID: Joi.string().description('twilio account sid'),
    TWILIO_AUTHTOKEN: Joi.string().description('twilio auth token'),
    TWILIO_VOICEURL:  Joi.string().description('twilio voice url'),
    OPEN_AI_KEY: Joi.string().description('open ai key'),
    STRIPE_SECRET_KEY: Joi.string().description('stripe secret key'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Create a Secrets Manager client
const client = new AWS.SecretsManager();

async function getSecretValue(secretName) {
  try {
    const data = await client.getSecretValue({ SecretId: secretName }).promise();

    if ('SecretString' in data) {
      const secret = data.SecretString;
      return secret;
    } else {
      // If the secret is binary, convert it to ASCII
      const decodedBinarySecret = Buffer.from(data.SecretBinary, 'base64').toString('ascii');
      return decodedBinarySecret;
    }
  } catch (err) {
    console.error(err);
  }
}

if (process.env.NODE_ENV === 'production') {
  // Replace 'MySecret' with the name of your secret in AWS Secrets Manager
  const secrets = JSON.parse(await getSecretValue('MySecretsManagerSecret'));

  // Overwrite the environment variables with the secrets
  process.env = { ...process.env, ...secrets };
}

const configVars = {
  env: envVars.NODE_ENV,
  port: 3000,
  authEnabled: false,
  apiUrl: 'http://localhost:3000/v1',
  mongoose: {
    url: 'mongodb://mongo:27017/bianca-app' + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  billing: {
    ratePerMinute: 0.1,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: 30,
    refreshExpirationDays: 30,
    resetPasswordExpirationMinutes: 10,
    verifyEmailExpirationMinutes: 10,
  },
  email: {
    smtp: {
      host: smtp.ethereal.email,
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: 'support@bianca-app.com',
  },
  google: {
    language: 'en-US',
    name: 'en-US-News-L',
    gender: 'FEMALE',
    encoding: 'MP3',
  },
  twilio: {
    phone: envVars.TWILIO_PHONENUMBER,
    apiUrl: 'https://be0e-70-68-70-88.ngrok-free.app',
    accountSid: envVars.TWILIO_ACCOUNTSID,
    authToken: envVars.TWILIO_AUTHTOKEN,
  },
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
    model: "gpt-3.5-turbo"
  },
  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY,
  }
};

if (envVars.NODE_ENV === 'production') {
  configVars.authEnabled = true;
  configVars.API_URL = 'http://app.myphonefriend.com/v1';
  configVars.mongoose.url = 'mongodb://mongo:27017/bianca-app';
  configVars.email.smtp.secure = true;
  configVars.twilio.apiUrl = 'https://app.myphonefriend.com';
}

module.exports = configVars;
