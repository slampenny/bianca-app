# MyPhoneFriend Backend API

> Secure healthcare communication platform for caregivers and wellness monitoring

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/)
[![AWS](https://img.shields.io/badge/AWS-Cloud-orange.svg)](https://aws.amazon.com/)

## 🏥 Overview

MyPhoneFriend Backend is a comprehensive healthcare communication API that enables secure caregiver coordination, automated wellness checks, and patient monitoring. Built with enterprise-grade security and HIPAA compliance.

### 🎯 Key Features

- 🔐 **Secure Authentication** - JWT-based auth with role-based access control
- 📞 **Voice Communication** - Real-time voice calls via Asterisk/FreePBX
- 🤖 **AI Transcription** - Automated call transcription using OpenAI Whisper
- 👥 **Patient Management** - Comprehensive patient and caregiver coordination
- 📅 **Scheduling System** - Automated wellness check scheduling
- 📧 **Email Services** - HIPAA-compliant email notifications via AWS SES
- 🏢 **Multi-Organization** - Support for healthcare organizations
- 📊 **Analytics & Reporting** - Wellness check analytics and insights
- 💳 **Automated Billing** - Real-time cost calculation and daily billing cycles
- 🔒 **HIPAA Compliance** - End-to-end encryption and audit trails

## 🛠️ Technology Stack

### Core Framework
- **Node.js 18+** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB Atlas** - NoSQL database with encryption
- **Mongoose** - MongoDB object modeling

### Security & Authentication
- **JWT** - Stateless authentication
- **bcrypt** - Password hashing
- **Helmet.js** - Security headers
- **Rate Limiting** - API abuse prevention

### Communication & Voice
- **Asterisk/FreePBX** - VoIP server for voice calls
- **Twilio** - SIP trunk provider
- **WebRTC** - Real-time peer-to-peer communication
- **Socket.io** - Real-time bidirectional communication

### AI & Machine Learning
- **OpenAI API** - GPT-4 integration
- **OpenAI Whisper** - Speech-to-text transcription

### Cloud Infrastructure (AWS)
- **ECS** - Container orchestration
- **SES** - Email delivery
- **S3** - File storage
- **Route53** - DNS management
- **VPC** - Network isolation

## 📚 Documentation

All technical documentation is organized in the [`docs/`](./docs/) directory:

- **[📋 Documentation Index](./docs/INDEX.md)** - Complete list of all documentation
- **[🚨 Emergency System](./docs/EMERGENCY_SYSTEM.md)** - Emergency detection and notification system
- **[📞 Call Workflows](./docs/CALL_WORKFLOW_README.md)** - Voice call handling and workflows
- **[🧠 AI & Analysis](./docs/SENTIMENT_ANALYSIS_API.md)** - AI-powered analysis features
- **[🧪 Testing](./docs/testing-strategy.md)** - Testing strategies and test suites

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- AWS account with SES configured
- Docker (optional)

### Installation

```bash
git clone https://github.com/jordanlapp/bianca-app-backend.git
cd bianca-app-backend
yarn install
cp .env.example .env
# Configure your .env file
```

### Development

```bash
npm run dev     # Start development server
npm test        # Run tests
npm run lint    # Lint code
```

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
└── validations/     # Request validations
```

## 🔌 API Endpoints

### Authentication
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - User login
- `GET /v1/auth/verify-email` - Verify email address

### Clients & Care
- `GET /v1/clients` - Get clients
- `POST /v1/clients` - Create client
- `GET /v1/wellness-checks` - Get wellness checks
- `POST /v1/calls/initiate` - Initiate voice call

### Billing & Payments
- `GET /v1/payments/orgs/:orgId/unbilled-costs` - Get unbilled costs by organization
- `POST /v1/payments/patients/:patientId/invoices` - Create invoice for patient
- `GET /v1/payments/orgs/:orgId/invoices` - Get invoices by organization
- `GET /v1/payments/patients/:patientId/invoices` - Get invoices by patient

## 📚 Documentation

- **[Documentation Hub](docs/README.md)** - Complete documentation index
- **[Workflows](docs/WORKFLOWS.md)** - System workflows sorted by business value
- **[Billing System](docs/BILLING_SYSTEM.md)** - Automated billing and payment processing
- **[AI Test Suite](docs/AI_TEST_SUITE.md)** - AI tests and diagnostic capabilities
- **[Testing Strategy](docs/testing-strategy.md)** - Comprehensive testing approach
- **[Medical Analysis API](docs/MEDICAL_ANALYSIS_API.md)** - Medical analysis endpoints
- **[Emergency System](docs/EMERGENCY_SYSTEM.md)** - Emergency detection system

## 🔧 Troubleshooting

### Docker layout

Compose files and the API `Dockerfile` live under [`docker/`](./docker/README.md). Use the `yarn docker:*` scripts from this package directory — do not rely on removed root-level `docker-compose*.yml` copies.

### Docker: "network ... not found" when running `yarn dev`

If you see `failed to set up container networking: network ... not found`, Docker’s Compose network was removed or is stale. Reset it and try again:

```bash
cd packages/backend
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.dev.yml down --remove-orphans
docker network prune -f
```

Then from the repo root run `yarn dev` again. Compose will recreate the network and start mongodb, redis, and asterisk.

## 📞 Support

- **Email**: support@biancawellness.com
- **Phone**: +1-604-562-4263
- **Address**: 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

---

**MyPhoneFriend** - Secure Healthcare Communication Platform
