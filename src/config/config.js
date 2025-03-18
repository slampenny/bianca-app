const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const AWS = require('aws-sdk');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    MONGODB_URL: Joi.string().description('path to connect with mongo server'),
    SMTP_USERNAME: Joi.string().description('username for email server'),
    SMTP_PASSWORD: Joi.string().description('password for email server'),
    TWILIO_PHONENUMBER: Joi.string().description('twilio phone number'),
    TWILIO_ACCOUNTSID: Joi.string().description('twilio account sid'),
    TWILIO_AUTHTOKEN: Joi.string().description('twilio auth token'),
    TWILIO_VOICEURL:  Joi.string().description('twilio voice url'),
    OPENAI_API_KEY: Joi.string().description('open ai key'),
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

(async () => {
  if (process.env.NODE_ENV === 'production') {
    // Replace 'MySecret' with the name of your secret in AWS Secrets Manager
    const secrets = JSON.parse(await getSecretValue('MySecretsManagerSecret'));

    console.log(secrets);

    // Overwrite the environment variables with the secrets
    process.env = { ...process.env, ...secrets };
  }
})();

const configVars = {
  env: envVars.NODE_ENV,
  port: 3000,
  authEnabled: true,//process.env.NODE_ENV !== 'development',
  apiUrl: 'http://0.0.0.0:3000/v1',
  mongoose: {
    url: ((envVars.MONGODB_URL) ? envVars.MONGODB_URL: 'mongodb://0.0.0.0:27017/bianca-app') + (envVars.NODE_ENV === 'test' ? '-test' : ''),
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
    inviteExpirationMinutes: 10080,
  },
  email: {
    smtp: {
      host: 'smtp.ethereal.email',
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
  multer: {
    dest: path.join(__dirname, '../../uploads'),
  },
  twilio: {
    phone: envVars.TWILIO_PHONENUMBER,
    apiUrl: 'https://505b-174-4-88-96.ngrok-free.app',
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
  configVars.apiUrl = 'http://app.myphonefriend.com/v1';
  configVars.mongoose.url = 'mongodb://mongo:27017/bianca-app';
  configVars.email.smtp.secure = true;
  configVars.twilio.apiUrl = 'https://app.myphonefriend.com';
}

module.exports = configVars;
