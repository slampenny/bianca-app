# MyPhoneFriend Documentation

This directory contains the complete documentation for MyPhoneFriend, deployed automatically to GitHub Pages.

## 📚 Documentation Structure

- **[Documentation Hub](README.md)** - Complete documentation index
- **[User Workflows](WORKFLOWS.md)** - User journeys and business processes
- **[AI Test Suite](AI_TEST_SUITE.md)** - AI testing and diagnostics
- **[Emergency System](EMERGENCY_SYSTEM.md)** - Emergency detection system
- **[Medical Analysis API](MEDICAL_ANALYSIS_API.md)** - Medical analysis endpoints
- **[Testing Strategy](testing-strategy.md)** - Development testing approach

## 🚀 GitHub Pages Deployment

This documentation is automatically deployed to GitHub Pages when changes are pushed to the main branch.

**Live Documentation**: [https://jordanlapp.github.io/myphonefriend-docs](https://jordanlapp.github.io/myphonefriend-docs)

## 🛠️ Local Development

To run the documentation locally:

```bash
cd docs
bundle install
bundle exec jekyll serve
```

Then visit `http://localhost:4000` to view the documentation.

## 📝 Adding New Documentation

1. Create new `.md` file in this directory
2. Add entry to the documentation hub
3. Update navigation in `_config.yml`
4. Push changes to trigger automatic deployment

## 🔧 Configuration

- **Jekyll Config**: `_config.yml`
- **GitHub Actions**: `.github/workflows/docs.yml`
- **Dependencies**: `Gemfile`

## 📊 Documentation Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| User Workflows | ✅ Complete | 2024-09-21 |
| AI Test Suite | ✅ Complete | 2024-09-21 |
| Emergency System | ✅ Complete | 2024-09-21 |
| Medical Analysis API | ✅ Complete | 2024-09-21 |
| Testing Strategy | ✅ Complete | 2024-09-21 |

---

**Need help?** Contact the development team or create an issue in the repository.