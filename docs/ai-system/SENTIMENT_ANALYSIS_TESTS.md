# Sentiment Analysis Test Suite

This document describes the comprehensive test suite for the sentiment analysis system, covering backend, frontend, and integration tests.

## Test Structure

### Backend Tests

#### Unit Tests
- **`tests/unit/services/openai.sentiment.service.test.js`**
  - Tests the OpenAI sentiment analysis service
  - Mocks OpenAI API responses
  - Tests sentiment data validation
  - Tests error handling and fallback mechanisms

- **`tests/unit/services/sentiment.integration.test.js`**
  - Tests sentiment analysis integration with conversation service
  - Tests conversation finalization with sentiment analysis
  - Tests sentiment trend and summary generation
  - Tests database operations

#### Integration Tests
- **`tests/integration/sentiment.test.js`**
  - Tests sentiment analysis API endpoints
  - Tests authentication and authorization
  - Tests error handling and validation
  - Tests test routes for staging

- **`tests/integration/sentiment.integration.test.js`**
  - Tests end-to-end sentiment analysis workflow
  - Tests multiple conversations with different sentiments
  - Tests time range filtering
  - Tests error handling and graceful degradation

### Frontend Tests

#### API Tests
- **`app/services/api/__tests__/sentimentApi.test.ts`**
  - Tests RTK Query sentiment API
  - Tests caching and invalidation
  - Tests error handling
  - Tests different time ranges

#### Component Tests
- **`app/components/__tests__/SentimentIndicator.test.tsx`**
  - Tests sentiment indicator component
  - Tests different sentiment types
  - Tests confidence indicators
  - Tests different sizes and configurations

- **`app/components/__tests__/SentimentDashboard.test.tsx`**
  - Tests sentiment dashboard component
  - Tests time range selection
  - Tests loading and error states
  - Tests refresh functionality

#### End-to-End Tests
- **`test/e2e/sentiment-analysis.e2e.test.ts`**
  - Tests complete user workflows
  - Tests navigation between screens
  - Tests sentiment analysis display
  - Tests error handling in UI

## Running Tests

### Backend Tests

#### Run All Backend Tests
```bash
# From backend directory
yarn test --testPathPattern="sentiment"
```

#### Run Specific Test Suites
```bash
# Unit tests only
yarn test tests/unit/services/openai.sentiment.service.test.js

# Integration tests only
yarn test tests/integration/sentiment.test.js

# All sentiment tests
yarn test --testPathPattern="sentiment"
```

#### Run with Coverage
```bash
yarn test --coverage --testPathPattern="sentiment"
```

### Frontend Tests

#### Run All Frontend Tests
```bash
# From frontend directory
yarn test --testPathPattern="sentiment"
```

#### Run Specific Test Suites
```bash
# API tests
yarn test app/services/api/__tests__/sentimentApi.test.ts

# Component tests
yarn test app/components/__tests__/SentimentIndicator.test.tsx

# E2E tests
yarn test:e2e test/e2e/sentiment-analysis.e2e.test.ts
```


## Test Coverage

### Backend Coverage
- **OpenAI Sentiment Service**: 95%+ coverage
  - All sentiment analysis methods
  - Error handling and fallback mechanisms
  - Data validation
  - Service status and health checks

- **Conversation Service**: 90%+ coverage
  - Sentiment analysis integration
  - Trend and summary generation
  - Database operations
  - Error handling

- **API Endpoints**: 95%+ coverage
  - All sentiment analysis endpoints
  - Authentication and authorization
  - Input validation
  - Error responses

### Frontend Coverage
- **API Layer**: 90%+ coverage
  - RTK Query hooks
  - Caching and invalidation
  - Error handling
  - Data transformation

- **Components**: 85%+ coverage
  - Sentiment indicator
  - Sentiment dashboard
  - Trend charts
  - Summary cards

- **E2E Tests**: 80%+ coverage
  - User workflows
  - Navigation
  - Data display
  - Error handling

## Test Data

### Mock Data
- **Sentiment Analysis**: Predefined sentiment responses for testing
- **Conversations**: Sample conversations with different sentiment types
- **Patients**: Test patients with various conversation histories
- **Time Ranges**: Different time periods for trend testing

### Test Fixtures
- **`test/fixtures/sentiment.fixture.ts`**: Sentiment analysis test data
- **`test/fixtures/conversation.fixture.ts`**: Conversation test data
- **`test/fixtures/patient.fixture.ts`**: Patient test data

## Test Scenarios

### Happy Path Scenarios
1. **Complete Sentiment Analysis Workflow**
   - Create conversation with messages
   - Finalize conversation with sentiment analysis
   - Verify sentiment data in database
   - Test API endpoints
   - Verify frontend display

2. **Multiple Conversations**
   - Create multiple conversations with different sentiments
   - Test trend analysis
   - Test summary generation
   - Verify data aggregation

3. **Time Range Filtering**
   - Create conversations across different time periods
   - Test month/year/lifetime filtering
   - Verify correct data selection

### Error Scenarios
1. **OpenAI API Failures**
   - Mock API errors
   - Test graceful degradation
   - Verify error handling

2. **Invalid Data**
   - Test with malformed sentiment data
   - Test with missing required fields
   - Verify validation

3. **Authentication Failures**
   - Test without authentication
   - Test with invalid tokens
   - Verify proper error responses

4. **Database Errors**
   - Test with invalid patient IDs
   - Test with non-existent conversations
   - Verify error handling

### Edge Cases
1. **Empty Data**
   - Test with no conversations
   - Test with no sentiment data
   - Verify empty state handling

2. **Low Confidence Results**
   - Test with low confidence sentiment
   - Verify confidence indicators
   - Test fallback mechanisms

3. **Mixed Sentiments**
   - Test with mixed sentiment types
   - Verify proper categorization
   - Test trend calculations

## Continuous Integration

### GitHub Actions
```yaml
name: Sentiment Analysis Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: yarn install
      - name: Run sentiment tests
        run: yarn test --coverage --testPathPattern="sentiment"
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

### Test Reports
- **Coverage Reports**: Generated in `coverage/` directory
- **Test Results**: Available in CI/CD logs
- **Performance Metrics**: Tracked for E2E tests

## Debugging Tests

### Common Issues
1. **Mock Data Issues**
   - Verify mock data matches expected format
   - Check mock function calls
   - Ensure proper cleanup

2. **Async Test Issues**
   - Use proper async/await patterns
   - Add appropriate timeouts
   - Verify promise resolution

3. **Database Issues**
   - Ensure proper test database setup
   - Clean up test data
   - Verify connection handling

### Debug Commands
```bash
# Run tests with debug output
npm test -- --verbose --testPathPattern="sentiment"

# Run specific test with debug
npm test -- --testNamePattern="should analyze sentiment" --verbose

# Run with coverage and debug
npm test -- --coverage --verbose --testPathPattern="sentiment"
```

## Performance Testing

### Load Testing
- **API Endpoints**: Test with multiple concurrent requests
- **Database Queries**: Test with large datasets
- **Frontend Rendering**: Test with large sentiment datasets

### Memory Testing
- **Service Instances**: Test memory usage
- **Cache Management**: Test cache size limits
- **Data Processing**: Test with large conversation datasets

## Security Testing

### Authentication
- **Token Validation**: Test with invalid/expired tokens
- **Permission Checks**: Test with insufficient permissions
- **Rate Limiting**: Test API rate limits

### Data Validation
- **Input Sanitization**: Test with malicious input
- **SQL Injection**: Test database queries
- **XSS Prevention**: Test frontend rendering

## Maintenance

### Test Updates
- **API Changes**: Update tests when API changes
- **Component Changes**: Update tests when components change
- **Data Model Changes**: Update tests when models change

### Test Data Management
- **Fixture Updates**: Keep test data current
- **Mock Updates**: Update mocks when services change
- **Cleanup**: Regular cleanup of test data

## Best Practices

### Test Writing
1. **Clear Test Names**: Use descriptive test names
2. **Single Responsibility**: Each test should test one thing
3. **Proper Setup/Teardown**: Clean up test data
4. **Mock External Dependencies**: Don't rely on external services
5. **Assert Specific Values**: Don't use generic assertions

### Test Organization
1. **Group Related Tests**: Use describe blocks
2. **Test Data Isolation**: Each test should be independent
3. **Consistent Naming**: Use consistent naming conventions
4. **Documentation**: Document complex test scenarios

### Performance
1. **Parallel Execution**: Run tests in parallel when possible
2. **Efficient Mocks**: Use efficient mocking strategies
3. **Database Optimization**: Optimize database operations
4. **Memory Management**: Clean up resources properly

## Conclusion

The sentiment analysis test suite provides comprehensive coverage of all aspects of the system, from individual service methods to complete user workflows. The tests ensure reliability, performance, and maintainability of the sentiment analysis functionality.

For questions or issues with the test suite, please refer to the test documentation or contact the development team.
