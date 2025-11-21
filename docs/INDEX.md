# Bianca App Backend Documentation

This directory contains all the technical documentation for the Bianca App Backend.

## 📋 Table of Contents

### 🚨 Emergency System
- **[EMERGENCY_SYSTEM.md](./EMERGENCY_SYSTEM.md)** - Overview of the emergency detection system
- **[LOCALIZED_EMERGENCY_DETECTION.md](./LOCALIZED_EMERGENCY_DETECTION.md)** - Multi-language emergency phrase detection
- **[EMERGENCY_INTEGRATION_GUIDE.md](./EMERGENCY_INTEGRATION_GUIDE.md)** - How to integrate emergency features
- **Note:** Emergency notifications now use Twilio for SMS (see [Twilio Configuration](./technical/TWILIO_CONFIGURATION.md))

### 📞 Communication & Workflows
- **[CALL_WORKFLOW_README.md](./CALL_WORKFLOW_README.md)** - Call handling and workflow documentation
- **[WORKFLOWS.md](./WORKFLOWS.md)** - General workflow documentation
- **[PHONE_VERIFICATION_STRATEGY.md](./PHONE_VERIFICATION_STRATEGY.md)** - Phone verification implementation
- **[VERIFICATION_UX_ANALYSIS.md](./VERIFICATION_UX_ANALYSIS.md)** - Email and phone verification UX analysis

### 🧠 AI & Analysis
- **[SENTIMENT_ANALYSIS_API.md](./SENTIMENT_ANALYSIS_API.md)** - Sentiment analysis API documentation
- **[SENTIMENT_ANALYSIS_TESTS.md](./SENTIMENT_ANALYSIS_TESTS.md)** - Sentiment analysis testing
- **[MEDICAL_ANALYSIS_API.md](./MEDICAL_ANALYSIS_API.md)** - Medical analysis API documentation

### 💳 Billing & Payments
- **[BILLING_SYSTEM.md](./BILLING_SYSTEM.md)** - Comprehensive billing system documentation

### 🧪 Testing
- **[AI_TEST_SUITE.md](./AI_TEST_SUITE.md)** - AI testing suite documentation
- **[MEDICAL_TEST_SUITE.md](./MEDICAL_TEST_SUITE.md)** - Medical testing suite documentation
- **[testing-strategy.md](./testing-strategy.md)** - Overall testing strategy

### 🚀 Deployment & Operations
- **[DEPLOYMENT.md](./deployment/DEPLOYMENT.md)** - Deployment procedures
- **[DEPLOYMENT_IMPROVEMENTS.md](./deployment/DEPLOYMENT_IMPROVEMENTS.md)** - Deployment improvements
- **[DEPLOYMENT_OPTIMIZATIONS.md](./deployment/DEPLOYMENT_OPTIMIZATIONS.md)** - Deployment optimizations
- **[RECREATE_PRODUCTION_INSTANCE.md](./deployment/RECREATE_PRODUCTION_INSTANCE.md)** - Production instance recreation
- **[GITHUB_OIDC_SETUP.md](./deployment/GITHUB_OIDC_SETUP.md)** - GitHub OIDC setup
- **[WORDPRESS_VOLUME_MIGRATION_PLAN.md](./deployment/WORDPRESS_VOLUME_MIGRATION_PLAN.md)** - WordPress volume migration

### 📋 Planning & Refactoring
- **[REFACTORING_PLAN.md](./planning/REFACTORING_PLAN.md)** - Backend refactoring plan
- **[REFACTOR_PRIORITIES.md](./planning/REFACTOR_PRIORITIES.md)** - Refactoring priorities
- **[REMAINING_WORK.md](./planning/REMAINING_WORK.md)** - Remaining work from architectural review
- **[REMAINING_TASKS.md](./planning/REMAINING_TASKS.md)** - General remaining tasks
- **[NEXT_STEPS.md](./planning/NEXT_STEPS.md)** - Next steps for development
- **[BRANCH_SUMMARY.md](./planning/BRANCH_SUMMARY.md)** - Branch summaries
- **[TEST_FAILURE_ANALYSIS.md](./planning/TEST_FAILURE_ANALYSIS.md)** - Test failure analysis

### 🔧 Technical Documentation
- **[Technical Index](./technical/INDEX.md)** - Complete technical documentation index
- **[Twilio Configuration](./technical/TWILIO_CONFIGURATION.md)** - Twilio setup for voice and SMS
- **[SSO Setup](./technical/SSO_SETUP.md)** - Single Sign-On configuration

### 📖 General
- **[README.md](./README.md)** - General documentation overview
- **[RELEASE_NOTES.md](./RELEASE_NOTES.md)** - Release notes and changelog
- **[DOCUMENTATION_ORGANIZATION_SUMMARY.md](./DOCUMENTATION_ORGANIZATION_SUMMARY.md)** - Documentation organization summary

### 🏗️ Architecture
- **[Architectural Review 2025](./technical/ARCHITECTURAL_REVIEW_2025.md)** - Comprehensive architectural analysis

## 🚀 Quick Start

1. **New to the project?** Start with [README.md](./README.md)
2. **Setting up emergency features?** See [EMERGENCY_INTEGRATION_GUIDE.md](./EMERGENCY_INTEGRATION_GUIDE.md)
3. **Working with calls?** Check [CALL_WORKFLOW_README.md](./CALL_WORKFLOW_README.md)
4. **Testing?** Review [testing-strategy.md](./testing-strategy.md)

## 📝 Contributing

When adding new documentation:
1. Place it in this `docs/` directory
2. Update this INDEX.md file to include your new documentation
3. Follow the existing naming conventions (UPPERCASE_WITH_UNDERSCORES.md)
4. Include a brief description in the table of contents above

## 🔗 Related Documentation

- **Frontend Documentation**: See `../bianca-app-frontend/README.md`
- **WordPress Plugin**: See `../bianca-wordpress-plugin/README.md`
- **Main Project README**: See `../README.md`
