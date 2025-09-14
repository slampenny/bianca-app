# Medical Analysis Test Suite

This document describes the comprehensive test suite for the medical analysis functionality, including sophisticated fixtures that simulate realistic patient-assistant conversations with progressive degradation patterns over time.

## Overview

The medical test suite is designed to thoroughly test the medical analysis pipeline, including:

- **Cognitive Decline Detection**: Tests for identifying gradual cognitive deterioration
- **Psychiatric Decline Detection**: Tests for detecting worsening mental health conditions
- **Baseline Comparison**: Tests for comparing current analysis with historical baselines
- **Integration Testing**: End-to-end pipeline testing
- **Edge Case Handling**: Tests for various edge cases and error conditions

## Test Structure

### 1. Medical Conversation Fixtures (`tests/fixtures/medicalConversations.fixture.js`)

Sophisticated test data that simulates realistic patient-assistant interactions with progressive degradation patterns:

#### Patient Types
- **Cognitive Decline Patient**: Shows gradual cognitive deterioration over 6 months
- **Psychiatric Decline Patient**: Shows worsening psychiatric symptoms over 6 months
- **Mixed Decline Patient**: Shows both cognitive and psychiatric decline patterns
- **Stable Patient**: Control patient with stable condition for comparison

#### Conversation Patterns
Each patient type includes 6 months of conversations showing:
- **Month 1**: Baseline/normal function
- **Month 2**: Early signs of decline
- **Month 3**: Noticeable changes
- **Month 4**: Clear decline indicators
- **Month 5**: Significant decline
- **Month 6**: Advanced decline

#### Example Cognitive Decline Progression
```
Month 1: "Good morning! I hope you're having a wonderful day. I wanted to discuss my medication schedule with you today."
Month 3: "Hello, I'm... I'm not sure why I called today. Can you help me remember?"
Month 6: "Help me... please help me. I don't know where I am or what's happening."
```

#### Example Psychiatric Decline Progression
```
Month 1: "Hi, I wanted to talk about how I've been feeling lately. I've been having some ups and downs."
Month 3: "I don't want to be here anymore. I can't take this pain anymore."
Month 6: "I don't know why I keep trying. Nothing ever gets better."
```

### 2. Cognitive Decline Tests (`tests/unit/medicalCognitiveDecline.test.js`)

Tests for detecting cognitive decline patterns:

#### Progressive Decline Scenarios
- **6-Month Decline Tracking**: Verifies gradual cognitive deterioration
- **Vocabulary Complexity Decline**: Tests for decreasing language complexity
- **Speech Pattern Changes**: Detects increasing filler words and vague references

#### Cognitive Indicators
- **Memory-Related Language**: "I forgot what I was going to say"
- **Confusion Patterns**: "I don't know where I am"
- **Word-Finding Difficulties**: "I need the thing... you know, the thing you use to..."
- **Repetitive Speech**: Detects concerning repetition patterns

#### Speech Pattern Analysis
- **Incomplete Sentences**: "I was going to... But then I..."
- **Topic Coherence Issues**: Detects fragmented conversation topics
- **Word Substitutions**: "I put the food in the... the cold box"

### 3. Psychiatric Decline Tests (`tests/unit/medicalPsychiatricDecline.test.js`)

Tests for detecting psychiatric decline patterns:

#### Progressive Decline Scenarios
- **6-Month Psychiatric Deterioration**: Tracks worsening mental health
- **Anxiety and Hopelessness**: Detects increasing anxiety indicators
- **Functional Impairment**: Identifies decreasing functional capacity

#### Depression Detection
- **Mild Depression**: "I've been feeling down lately"
- **Moderate Depression**: "I feel hopeless and worthless"
- **Severe Depression**: "I am completely worthless and a burden to everyone"

#### Anxiety Detection
- **Generalized Anxiety**: "I worry about everything constantly"
- **Panic Symptoms**: "I had a panic attack yesterday"
- **Social Anxiety**: "I avoid social situations because I'm afraid"

#### Crisis Detection
- **Suicidal Ideation**: "I don't want to be here anymore"
- **Self-Harm Indicators**: "I cut myself yesterday because the emotional pain was too much"
- **Hopelessness**: "There's no point in anything anymore"

### 4. Baseline Comparison Tests (`tests/unit/medicalBaselineComparison.test.js`)

Tests for baseline establishment and comparison:

#### Baseline Establishment
- **Initial Baseline**: Creates baseline from first month of conversations
- **Baseline Updates**: Updates baseline with new data points over time
- **Seasonal Adjustments**: Accounts for seasonal variations

#### Deviation Detection
- **Cognitive Decline from Baseline**: Detects significant cognitive changes
- **Psychiatric Decline from Baseline**: Identifies psychiatric deterioration
- **Stable Patient Validation**: Ensures stable patients aren't flagged

#### Trend Analysis
- **Cognitive Trends**: Analyzes cognitive decline over multiple months
- **Psychiatric Trends**: Tracks psychiatric deterioration patterns
- **Stable Trends**: Verifies stable patient patterns

### 5. Integration Tests (`tests/integration/medicalAnalysisPipeline.test.js`)

End-to-end pipeline testing:

#### Full Pipeline Testing
- **Cognitive Decline Patient**: Complete analysis pipeline
- **Psychiatric Decline Patient**: Full psychiatric analysis
- **Mixed Decline Patient**: Combined cognitive and psychiatric analysis
- **Stable Patient**: Stable patient analysis validation

#### Scheduler Integration
- **Monthly Analysis Jobs**: Tests scheduled analysis functionality
- **No Conversations Handling**: Tests empty conversation scenarios
- **Error Handling**: Tests error recovery mechanisms

#### Data Flow Integration
- **Data Consistency**: Ensures data consistency across components
- **Concurrent Analysis**: Tests multiple simultaneous analyses
- **Mixed Conversation Types**: Handles various conversation formats

### 6. Edge Case Tests (`tests/unit/medicalEdgeCases.test.js`)

Comprehensive edge case testing:

#### Minimal Data Edge Cases
- **Single Character Messages**: "a", "b", "c"
- **Whitespace Only**: "   ", "\n\t"
- **Punctuation Only**: "...", "!!!", "???"
- **Numbers Only**: "123", "456", "789"

#### Language and Cultural Edge Cases
- **Mixed Languages**: "I feel muy triste today"
- **Cultural Expressions**: "I have a heavy heart and my soul is weary"
- **Religious Language**: "I pray for peace but God seems to have abandoned me"

#### Technical Edge Cases
- **HTML Tags**: "I feel <strong>very sad</strong> today"
- **URLs and Emails**: "https://example.com", "patient@example.com"
- **Special Characters**: "I feel @#$% confused today!"

#### Speech-to-Text Edge Cases
- **Transcription Errors**: Handles speech-to-text mistakes
- **Background Noise**: "[unclear]", "[background noise]"
- **Partial Words**: "I feel very sa... sad today"

#### Medical Condition Edge Cases
- **Medication Language**: "I take my medication every day but I still feel depressed"
- **Medical Terminology**: "I have been diagnosed with major depressive disorder"
- **Symptom Descriptions**: "I have been experiencing persistent sadness"

#### Extreme Value Edge Cases
- **Extremely Long Messages**: Very long single messages
- **Extremely Short Messages**: "Yes", "No", "Maybe"
- **Extremely Repetitive**: "I am sad. I am sad. I am sad."

#### Data Structure Edge Cases
- **Missing Content**: null, undefined, empty strings
- **Missing Roles**: Malformed message objects
- **Malformed Objects**: Invalid data structures

#### Performance Edge Cases
- **Large Datasets**: 100+ conversations
- **Deep Nesting**: Complex data structures
- **Error Recovery**: Graceful failure handling

## Running the Tests

### Using the Test Runner Script

```bash
# Run all medical tests
node tests/scripts/runMedicalTests.js all

# Run unit tests only
node tests/scripts/runMedicalTests.js unit

# Run integration tests only
node tests/scripts/runMedicalTests.js integration

# Display help
node tests/scripts/runMedicalTests.js help
```

### Using Jest Directly

```bash
# Run all medical tests
npx jest tests/unit/medical*.test.js tests/integration/medical*.test.js

# Run specific test file
npx jest tests/unit/medicalCognitiveDecline.test.js

# Run with verbose output
npx jest tests/unit/medical*.test.js --verbose

# Run with coverage
npx jest tests/unit/medical*.test.js --coverage
```

### Using Yarn (if available)

```bash
# Run all medical tests
yarn test tests/unit/medical*.test.js tests/integration/medical*.test.js

# Run with specific options
yarn test tests/unit/medical*.test.js --verbose --coverage
```

## Test Data Characteristics

### Realistic Conversation Patterns
- **Natural Language**: Conversations use natural, realistic language patterns
- **Progressive Degradation**: Clear progression from normal to concerning states
- **Medical Context**: Conversations are set in appropriate medical contexts
- **Cultural Sensitivity**: Includes diverse cultural and linguistic expressions

### Degradation Patterns
- **Cognitive Decline**: Memory issues, confusion, word-finding difficulties
- **Psychiatric Decline**: Depression, anxiety, crisis indicators
- **Mixed Patterns**: Combined cognitive and psychiatric symptoms
- **Stable Patterns**: Control data for comparison

### Data Quality
- **Sufficient Volume**: Enough data for meaningful analysis
- **Temporal Progression**: Clear time-based progression
- **Baseline Establishment**: Clear baseline for comparison
- **Edge Case Coverage**: Comprehensive edge case scenarios

## Expected Test Outcomes

### Cognitive Decline Detection
- **Month 1**: Risk score < 30 (normal)
- **Month 3**: Risk score 40-60 (mild decline)
- **Month 6**: Risk score > 70 (significant decline)

### Psychiatric Decline Detection
- **Month 1**: Depression score < 50 (mild)
- **Month 3**: Depression score 50-80 (moderate)
- **Month 6**: Depression score > 80 (severe)

### Baseline Comparison
- **Stable Patients**: No significant deviations from baseline
- **Declining Patients**: Significant deviations detected
- **Trend Analysis**: Clear trend identification

### Integration Testing
- **Pipeline Completion**: All components work together
- **Data Consistency**: Data flows correctly through pipeline
- **Error Handling**: Graceful error recovery

## Maintenance and Updates

### Adding New Test Cases
1. Add new conversation patterns to fixtures
2. Create corresponding test scenarios
3. Update documentation
4. Run full test suite

### Updating Degradation Patterns
1. Modify conversation fixtures
2. Update expected outcomes
3. Validate test results
4. Update documentation

### Performance Monitoring
- Monitor test execution times
- Track memory usage
- Identify performance bottlenecks
- Optimize as needed

## Conclusion

This comprehensive medical test suite provides thorough coverage of the medical analysis functionality, including sophisticated fixtures that simulate realistic patient-assistant conversations with progressive degradation patterns. The tests ensure reliable detection of cognitive and psychiatric decline while handling various edge cases and error conditions.

The test suite is designed to be maintainable, comprehensive, and realistic, providing confidence in the medical analysis system's ability to detect concerning patterns in patient conversations over time.

