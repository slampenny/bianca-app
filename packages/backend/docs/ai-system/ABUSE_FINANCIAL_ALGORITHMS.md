# AI Algorithms for Abuse Detection and Financial Issues

This document outlines the AI algorithms used in the Bianca application for detecting abuse, neglect, and financial exploitation patterns in patient conversations.

## Overview

The system uses a multi-layered approach combining:
- **Rule-based pattern matching** with keyword detection
- **Weighted scoring algorithms** for risk assessment
- **Temporal pattern analysis** to detect escalation over time
- **Natural language processing** for text analysis

All algorithms are implemented using the `natural` NLP library and operate on patient conversation messages.

---

## 1. Financial Exploitation Detection

**Service:** `FinancialExploitationDetector`

### Algorithm Components

#### 1.1 Large Amount Detection
- **Method:** Regular expression pattern matching
- **Patterns:**
  - Currency amounts with thousands/millions: `$1,000`, `5 thousand`, `2 million`
  - Written amounts: `ten dollars`, `hundred bucks`
  - Large numeric amounts: `5000 dollars` or more
- **Scoring:** Count-based with density calculation
  - Score = `min(count * 10, 100)`
  - Weight: 25% of overall risk score

#### 1.2 Transfer Method Detection
- **Method:** Keyword matching for money transfer services
- **Keywords:** wire transfer, Western Union, MoneyGram, gift cards, prepaid cards, Bitcoin, cryptocurrency, Venmo, PayPal, Zelle, Cash App, money orders, cashier checks
- **Scoring:** 
  - Score = `min(count * 15, 100)`
  - Weight: 20% of overall risk score

#### 1.3 Scam Indicator Detection
- **Method:** Keyword matching for common scam patterns
- **Categories:**
  - Prize/lottery scams: "prize", "lottery", "winner", "you won"
  - Government impersonation: "IRS", "tax", "Social Security", "Medicare"
  - Threats: "arrest warrant", "suspended", "expired"
  - Classic scams: "Nigerian prince", "inheritance", "unclaimed money"
  - Tech support: "tech support", "Microsoft", "Apple", "Amazon refund"
- **Scoring:**
  - Score = `min(count * 12, 100)`
  - Weight: 30% of overall risk score (highest weight)

#### 1.4 Urgency Language Detection
- **Method:** Phrase matching for pressure tactics
- **Patterns:** "act now", "urgent", "immediately", "today only", "don't tell anyone", "keep this secret", "this is your last chance"
- **Scoring:**
  - Score = `min(count * 20, 100)`
  - Weight: 15% of overall risk score

#### 1.5 Help Request Detection
- **Method:** Phrase matching for financial distress
- **Patterns:** "need money", "loan", "borrow", "lend me", "emergency money", "help with bills", "behind on payments"
- **Scoring:**
  - Score = `min(count * 8, 100)`
  - Weight: 10% of overall risk score

#### 1.6 Relationship-Money Pattern Detection
- **Method:** Phrase matching for new relationships asking for money
- **Patterns:** "new friend", "met someone", "they need help", "they asked for", "they want me to send"
- **Scoring:**
  - Score = `min(count * 15, 100)`
  - Weight: 15% of overall risk score

#### 1.7 Temporal Pattern Analysis
- **Method:** Time-series analysis of financial mentions
- **Algorithm:**
  1. Count financial mentions per message over time
  2. Split into recent (last 5 messages) vs. earlier (first half)
  3. Calculate averages for each period
  4. Detect escalation: `recentAvg > earlierAvg * 1.5`
- **Escalation Bonus:** +20 points to risk score if escalation detected

#### 1.8 Overall Risk Score Calculation
```
riskScore = (
  largeAmountsScore * 0.25 +
  transferMethodsScore * 0.20 +
  scamIndicatorsScore * 0.30 +
  urgencyLanguageScore * 0.15 +
  helpRequestsScore * 0.10 +
  relationshipMoneyScore * 0.15
) + escalationBonus

Final score = min(riskScore, 100)
```

#### 1.9 Confidence Calculation
- **Low:** Text length < 500 characters OR < 3 messages
- **Medium:** Text length < 2000 characters OR < 10 messages
- **High:** Text length ≥ 2000 characters AND ≥ 10 messages

---

## 2. Abuse and Neglect Detection

**Service:** `AbuseNeglectDetector`

### Algorithm Components

#### 2.1 Physical Abuse Detection

**Sub-components:**

##### 2.1.1 Injury Detection
- **Method:** Keyword matching for physical injuries
- **Keywords:** bruise, cut, hit, punched, slapped, pushed, shoved, grabbed, pulled, hurt me, injured, wound, black eye, swollen, bleeding, sore, painful
- **Scoring:** `min(injuryCount * 15, 100)` weighted at 30%

##### 2.1.2 Fear of Person Detection
- **Method:** Phrase matching for fear indicators
- **Patterns:** "afraid of", "scared of", "fear", "worried about", "don't like", "makes me nervous", "intimidated by", "threatened by"
- **Scoring:** `min(fearCount * 20, 100)` weighted at 30%

##### 2.1.3 Punishment Language Detection
- **Method:** Phrase matching for punishment-related language
- **Patterns:** "punished", "punishment", "disciplined", "taught a lesson", "got what I deserved", "had it coming", "deserved it"
- **Scoring:** `min(punishmentCount * 25, 100)` weighted at 30%

##### 2.1.4 Inconsistent Explanations Detection
- **Method:** Cross-message analysis
- **Algorithm:**
  1. Identify messages mentioning injuries
  2. Check if same messages contain vague explanations
  3. Vague patterns: "fell", "accident", "bumped into", "tripped", "don't remember", "not sure how"
- **Scoring:** `inconsistentCount * 30` weighted at 10%

**Physical Abuse Score:**
```
score = min(
  (injuryScore * 0.3 + fearScore * 0.3 + punishmentScore * 0.3 + inconsistentScore * 0.1),
  100
)
```

#### 2.2 Emotional Abuse Detection

**Sub-components:**

##### 2.2.1 Isolation Detection
- **Patterns:** "not allowed to", "can't talk to", "forbidden to", "told me not to", "won't let me", "keeps me from"
- **Scoring:** `min(isolationCount * 15, 100)` weighted at 25%

##### 2.2.2 Control Detection
- **Patterns:** "controls", "tells me what to do", "makes decisions for me", "has to approve", "needs permission"
- **Scoring:** `min(controlCount * 20, 100)` weighted at 25%

##### 2.2.3 Threat Detection
- **Patterns:** "threatened", "threat", "threatens", "warned me", "said they would", "going to", "will hurt", "will take away"
- **Scoring:** `min(threatCount * 25, 100)` weighted at 20%

##### 2.2.4 Belittling Detection
- **Keywords:** "stupid", "worthless", "useless", "burden", "incompetent", "can't do anything right", "always wrong"
- **Scoring:** `min(belittlingCount * 18, 100)` weighted at 15%

##### 2.2.5 Fear Language Detection
- **Patterns:** "afraid to", "scared to", "fear", "worried", "anxious about", "don't want to upset", "walking on eggshells"
- **Scoring:** `min(fearCount * 15, 100)` weighted at 15%

**Emotional Abuse Score:**
```
score = min(
  (isolationScore * 0.25 + controlScore * 0.25 + threatScore * 0.20 + 
   belittlingScore * 0.15 + fearScore * 0.15),
  100
)
```

#### 2.3 Neglect Detection

**Sub-components:**

##### 2.3.1 Basic Needs Detection
- **Patterns:** "no food", "hungry", "haven't eaten", "no medication", "missed medication", "out of medicine", "no water", "thirsty", "dirty", "haven't showered", "no clean clothes", "cold", "no heat", "no electricity"
- **Scoring:** `min(basicNeedsCount * 20, 100)` weighted at 30%

##### 2.3.2 Medical Care Detection
- **Patterns:** "can't see doctor", "no doctor", "missed appointment", "no medical care", "pain", "sick", "not feeling well", "need help", "need care"
- **Scoring:** `min(medicalCareCount * 25, 100)` weighted at 35%

##### 2.3.3 Isolation Detection
- **Patterns:** "alone", "no one visits", "no one calls", "lonely", "isolated", "left alone", "abandoned", "forgotten", "no one cares"
- **Scoring:** `min(isolationCount * 15, 100)` weighted at 20%

##### 2.3.4 Time Alone Detection
- **Patterns:** "days alone", "weeks alone", "left me", "gone for", "hasn't been here", "no one here", "by myself", "all alone"
- **Scoring:** `min(timeAloneCount * 18, 100)` weighted at 15%

**Neglect Score:**
```
score = min(
  (basicNeedsScore * 0.30 + medicalCareScore * 0.35 + 
   isolationScore * 0.20 + timeAloneScore * 0.15),
  100
)
```

#### 2.4 Temporal Pattern Analysis
- **Method:** Time-series analysis of abuse/neglect mentions
- **Algorithm:**
  1. Count abuse/neglect keyword mentions per message
  2. Compare recent (last 5 messages) vs. earlier (first half)
  3. Detect escalation: `recentAvg > earlierAvg * 1.5`
- **Escalation Bonus:** +15 points to overall risk score

#### 2.5 Overall Abuse/Neglect Risk Score
```
riskScore = (
  physicalAbuseScore * 0.40 +
  emotionalAbuseScore * 0.35 +
  neglectScore * 0.25
) + escalationBonus

Final score = min(riskScore, 100)
```

---

## 3. Relationship Pattern Analysis

**Service:** `RelationshipPatternAnalyzer`

### Algorithm Components

#### 3.1 New People Detection
- **Method:** Phrase matching for new relationships
- **Patterns:** "new friend", "met someone", "someone I met", "person I know", "new person", "stranger", "someone new", "just met", "recently met"
- **Scoring:** `min(count * 8, 30)` (moderate concern)

#### 3.2 Isolation Detection
- **Method:** Phrase matching for social isolation
- **Patterns:** "don't see", "haven't seen", "stopped visiting", "no longer", "cut off", "not allowed", "forbidden", "told not to", "isolated", "alone", "no one visits", "no one calls"
- **Scoring:** `min(count * 12, 40)` (high concern)

#### 3.3 Control Detection
- **Method:** Phrase matching for controlling behavior
- **Patterns:** "tells me", "makes me", "won't let me", "doesn't want me to", "controls", "decides for me", "has to approve", "needs permission"
- **Scoring:** `min(count * 15, 45)` (high concern)

#### 3.4 Dependency Detection
- **Method:** Phrase matching for unhealthy dependency
- **Patterns:** "only person", "only one", "only friend", "only help", "depends on", "rely on", "need them", "can't without"
- **Scoring:** `min(count * 10, 35)` (moderate concern)

#### 3.5 Suspicious Behavior Detection
- **Method:** Phrase matching for financial exploitation in relationships
- **Patterns:** "asks for money", "wants money", "needs money", "borrow", "loan", "help financially", "send money", "give money", "takes care of", "manages", "handles", "in charge of"
- **Scoring:** `min(count * 20, 50)` (very high concern)

#### 3.6 Temporal Change Analysis
- **Method:** Three-period comparison (early, middle, late)
- **Algorithm:**
  1. Split messages into three equal periods
  2. Count relationship-related mentions in each period
  3. Detect isolation increase: `lateCount > earlyCount * 1.5`
  4. Detect new people increase: `lateNewPeople > earlyNewPeople * 1.5`
- **Change Bonus:** +20 points if significant changes detected

#### 3.7 Overall Relationship Risk Score
```
riskScore = (
  newPeopleScore +
  isolationScore +
  controlScore +
  dependencyScore +
  suspiciousScore
) + temporalChangeBonus + combinationBonus

// Combination bonus: +15 if 3+ indicators present
Final score = min(riskScore, 100)
```

---

## 4. Overall Risk Scoring

**Service:** `FraudAbuseAnalyzer`

### Combined Risk Calculation

The system combines all three detection services into an overall risk score:

```
overallRiskScore = (
  financialRiskScore * 0.35 +
  abuseRiskScore * 0.40 +
  relationshipRiskScore * 0.25
) + multipleHighRiskBonus

// Multiple high-risk bonus: +15 if 2+ areas exceed thresholds
Final score = min(overallRiskScore, 100)
```

### Risk Thresholds

- **Financial Risk Threshold:** 40/100
- **Abuse Risk Threshold:** 40/100
- **Relationship Risk Threshold:** 30/100
- **Overall Risk Threshold:** 50/100

### Baseline Comparison

The system can compare current analysis against historical baselines:
- Calculates changes in risk scores over time
- Detects significant increases (>15-20 points)
- Uses 3-month rolling baseline for comparison

---

## 5. Technical Implementation Details

### Natural Language Processing
- **Library:** `natural` (Node.js NLP library)
- **Tokenization:** Word and sentence tokenization
- **Pattern Matching:** Regular expressions with word boundary detection
- **Text Normalization:** Lowercase conversion for case-insensitive matching

### Algorithm Characteristics
- **Rule-based:** Primarily keyword and pattern matching
- **Weighted Scoring:** Multi-factor risk assessment with configurable weights
- **Temporal Analysis:** Time-series pattern detection for escalation
- **Confidence Levels:** Data quality assessment (low/medium/high/none)

### Performance Considerations
- Processes patient messages in batches
- Limits flagged phrases to top 10 per category
- Efficient regex matching with word boundaries
- Minimal computational overhead for real-time analysis

---

## 6. Output Structure

Each detection service returns:
- **Risk Score:** 0-100 numerical score
- **Confidence:** low/medium/high/none
- **Indicators:** Array of detected patterns with severity
- **Metrics:** Counts of specific mention types
- **Temporal Patterns:** Escalation detection and trends
- **Flagged Phrases:** Examples of concerning language

The combined analyzer provides:
- Individual risk scores for each category
- Overall risk score
- Warnings array
- Recommendations array
- Baseline change tracking

---

## 7. Limitations and Considerations

1. **False Positives:** Keyword-based detection may flag legitimate conversations
2. **Context Sensitivity:** Limited understanding of conversational context
3. **Language Variations:** May miss variations in phrasing
4. **Cultural Differences:** Patterns may not apply universally
5. **Data Requirements:** Requires sufficient conversation volume for accurate analysis

---

## 8. Future Enhancements

Potential improvements:
- Machine learning models for pattern recognition
- Sentiment analysis for emotional tone detection
- Named entity recognition for person identification
- Contextual understanding improvements
- Multi-language support
- Adaptive threshold tuning based on historical data
