const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const AWS = require('aws-sdk');
const deasync = require('deasync');


dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
  JWT_SECRET: Joi.string().required(),
  MONGODB_URL: Joi.string(),
  SMTP_USERNAME: Joi.string(),
  SMTP_PASSWORD: Joi.string(),
  TWILIO_PHONENUMBER: Joi.string(),
  TWILIO_ACCOUNTSID: Joi.string(),
  TWILIO_AUTHTOKEN: Joi.string(),
  TWILIO_VOICEURL: Joi.string(),
  OPENAI_API_KEY: Joi.string(),
  STRIPE_SECRET_KEY: Joi.string()
}).unknown();

const client = new AWS.SecretsManager();

async function getSecretValue(secretName) {
  try {
    const data = await client.getSecretValue({ SecretId: secretName }).promise();
    if (data.SecretString) return data.SecretString;
    return Buffer.from(data.SecretBinary, 'base64').toString('ascii');
  } catch (err) {
    console.error('Error retrieving secrets:', err);
    return '{}';
  }
}

async function loadConfig() {
  if (process.env.NODE_ENV === 'production') {
    try {
      const secretData = await getSecretValue('MySecretsManagerSecret');
      const secrets = JSON.parse(secretData);
      process.env = { ...process.env, ...secrets };
    } catch (error) {
      console.error('Failed to load secrets:', error);
    }
  }
  const { value: envVars, error } = envVarsSchema.validate(process.env, { errors: { label: 'key' } });
  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
  const configVars = {
    env: envVars.NODE_ENV,
    port: 3000,
    authEnabled: true,
    apiUrl: 'http://localhost:3000/v1',
    mongoose: {
      url: (envVars.MONGODB_URL || 'mongodb://localhost:27017/bianca-app') + (envVars.NODE_ENV === 'test' ? '-test' : ''),
      options: {
        useCreateIndex: true,
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    },
    billing: { ratePerMinute: 0.1 },
    jwt: {
      secret: envVars.JWT_SECRET,
      accessExpirationMinutes: 30,
      refreshExpirationDays: 30,
      resetPasswordExpirationMinutes: 10,
      verifyEmailExpirationMinutes: 10,
      inviteExpirationMinutes: 10080
    },
    email: {
      smtp: {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: envVars.SMTP_USERNAME,
          pass: envVars.SMTP_PASSWORD
        }
      },
      from: 'support@myphonefriend.com'
    },
    google: {
      language: 'en-US',
      name: 'en-US-News-L',
      gender: 'FEMALE',
      encoding: 'MP3'
    },
    multer: { dest: path.join(__dirname, '../../uploads') },
    twilio: {
      phone: envVars.TWILIO_PHONENUMBER,
      apiUrl: 'https://505b-174-4-88-96.ngrok-free.app',
      accountSid: envVars.TWILIO_ACCOUNTSID,
      authToken: envVars.TWILIO_AUTHTOKEN
    },
    openai: {
      apiKey: envVars.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo'
    },
    stripe: { secretKey: envVars.STRIPE_SECRET_KEY }
  };

  if (envVars.NODE_ENV === 'production') {
    AWS.config.update({ region: 'us-east-2' })
    const ses = new AWS.SES({ apiVersion: '2010-12-01' })

    configVars.apiUrl = 'http://app.myphonefriend.com/v1';
    configVars.mongoose.url = 'mongodb://localhost:27017/bianca-app';
    configVars.email.smtp.secure = true;
    configVars.twilio.apiUrl = 'https://app.myphonefriend.com';
    configVars.email.smtp = {SES: { ses, aws: AWS }};
  }
  return configVars;
}

let config;
let done = false;
loadConfig()
  .then(cfg => {
    config = cfg;
    done = true;
  })
  .catch(err => {
    throw err;
  });
deasync.loopWhile(() => !done);
module.exports = config;
