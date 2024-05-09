# Bianca App Backend

This is the backend for the Bianca App. It's built with Node.js, Express, and Mongoose, and it includes a variety of features such as authentication, request validation, logging, testing, error handling, and more.

## Features

- **NoSQL database**: MongoDB object data modeling using Mongoose
- **Authentication and authorization**: using Passport
- **Validation**: request data validation using Joi
- **Logging**: using Winston and Morgan
- **Testing**: unit and integration tests using Jest
- **Error handling**: centralized error handling mechanism
- **API documentation**: with Swagger-jsdoc and Swagger-ui-express
- **Process management**: advanced production process management using PM2
- **Dependency management**: with Yarn
- **Environment variables**: using Dotenv and Cross-env
- **Security**: set security HTTP headers using Helmet
- **Sanitizing**: sanitize request data against XSS and query injection
- **CORS**: Cross-Origin Resource-Sharing enabled using Cors
- **Compression**: gzip compression with Compression
- **CI**: continuous integration with Travis CI
- **Docker support**
- **Code coverage**: using Coveralls
- **Code quality**: with Codacy
- **Git hooks**: with Husky and Lint-staged

## Getting Started

To get started with this project, clone the repository and install the dependencies.

```bash
git clone https://github.com/slampenny/bianca-app-backend.git
cd bianca-app-backend
yarn install