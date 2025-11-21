# OpenAI Model Cost Analysis

## Current Configuration

**Realtime API Model**: `gpt-4o-realtime-preview-2024-12-17`
**Standard API Model**: `gpt-4o` (for non-realtime operations)

---

## Important Note: Realtime API vs Standard API Pricing

⚠️ **The Realtime API uses different pricing than the standard API!**

- **Standard API**: Billed per token (input/output tokens)
- **Realtime API**: Billed per minute of conversation time (not per token)

This means we need to find Realtime API-specific pricing, which may not be publicly documented in the same way.

---

## Standard API Pricing (for reference)

### GPT-4o Series
- **GPT-4o**: 
  - Input: $2.50 per million tokens
  - Output: $10.00 per million tokens
- **GPT-4o Mini**: 
  - Input: $0.15 per million tokens
  - Output: $0.60 per million tokens
  - **~94% cheaper than GPT-4o**

### GPT-4.1 Series (April 2025)
- **GPT-4.1**: 
  - Input: $2.00 per million tokens
  - Output: $8.00 per million tokens
- **GPT-4.1 Mini**: 
  - Input: $0.40 per million tokens
  - Output: $1.60 per million tokens
  - **~80% cheaper than GPT-4.1**

### GPT-5 Series
- **GPT-5.1**: 
  - Input: $1.25 per million tokens
  - Output: $10.00 per million tokens
- **GPT-5 Mini**: 
  - Input: $0.25 per million tokens
  - Output: $2.00 per million tokens
- **GPT-5 Nano**: 
  - Input: $0.05 per million tokens
  - Output: $0.40 per million tokens

---

## Realtime API Models Available

### Known Realtime Models
1. **gpt-4o-realtime-preview-2024-12-17** (current)
   - Status: ✅ Currently in use
   - Pricing: **Need to verify** (likely per-minute billing)

2. **gpt-4o-mini-realtime** (if available)
   - Status: ❓ Need to verify availability
   - Expected savings: Potentially 80-90% if available
   - Quality: Should be similar for conversational use cases

### Questions to Answer
1. **Is `gpt-4o-mini-realtime` available?**
   - Check OpenAI Realtime API documentation
   - Test if model name works in API calls

2. **What is the per-minute pricing for Realtime API?**
   - Check OpenAI pricing page
   - Check billing dashboard
   - May need to contact OpenAI support

3. **Are there newer Realtime models?**
   - Check for `gpt-4.1-realtime` or similar
   - Check for `gpt-5-realtime` variants

---

## Cost Comparison Scenarios

### Scenario 1: 10-minute call
Assuming Realtime API pricing follows similar ratios to standard API:

| Model | Estimated Cost | Savings vs Current |
|-------|---------------|-------------------|
| gpt-4o-realtime (current) | $X.XX | Baseline |
| gpt-4o-mini-realtime | $0.1X - $0.2X | ~80-90% |
| gpt-4.1-mini-realtime | $0.2X - $0.4X | ~60-80% |

**Note**: Actual pricing needs to be verified from OpenAI.

### Scenario 2: 100 calls/month, 10 min average
- Current: 1,000 minutes/month
- With mini model: Potentially 80-90% savings

---

## Quality vs Cost Analysis

### GPT-4o vs GPT-4o Mini (Standard API)
Based on OpenAI documentation and community feedback:

**GPT-4o Mini Strengths:**
- ✅ Excellent for conversational AI
- ✅ Good understanding of context
- ✅ Fast response times
- ✅ Lower latency
- ✅ Sufficient for most healthcare conversations

**GPT-4o Strengths:**
- ✅ Better for complex reasoning
- ✅ More nuanced responses
- ✅ Better handling of edge cases
- ✅ Superior for technical/medical terminology

**For Healthcare Conversations:**
- **GPT-4o Mini** is likely sufficient for:
  - General conversation
  - Empathy and support
  - Basic information gathering
  - Standard responses
  
- **GPT-4o** may be better for:
  - Complex medical scenarios
  - Detailed explanations
  - Multi-step problem solving
  - Emergency detection (if more sophisticated)

---

## Recommendations

### Phase 1: Research & Testing (1-2 days)
1. **Verify Realtime API Pricing**
   - Check OpenAI dashboard/billing
   - Review latest documentation
   - Contact support if needed

2. **Test Model Availability**
   - Try `gpt-4o-mini-realtime` in API
   - Check for newer model versions
   - Verify feature parity

3. **Create Test Plan**
   - Test with sample conversations
   - Compare response quality
   - Measure latency differences

### Phase 2: A/B Testing (1 week)
1. **Staged Rollout**
   - Test mini model on staging
   - Compare with current model
   - Monitor user feedback
   - Track cost savings

2. **Metrics to Track**
   - Response quality (subjective)
   - Response time/latency
   - User satisfaction
   - Cost per call
   - Error rates

### Phase 3: Implementation (if successful)
1. **Configuration Update**
   - Update `OPENAI_REALTIME_MODEL` env var
   - Update default in `config.js`
   - Deploy to staging first

2. **Monitoring**
   - Track costs before/after
   - Monitor quality metrics
   - Have rollback plan ready

---

## Implementation Steps (if switching to mini)

### 1. Update Configuration
```javascript
// src/config/config.js
OPENAI_REALTIME_MODEL: Joi.string().default('gpt-4o-mini-realtime'),

// Or via environment variable
OPENAI_REALTIME_MODEL=gpt-4o-mini-realtime
```

### 2. Test Model Availability
```bash
# Test if model name is valid
curl https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### 3. Update Code (if needed)
- No code changes needed if model name is valid
- Model is passed in WebSocket URL
- All other configuration remains the same

---

## Risk Assessment

### Low Risk
- ✅ Testing on staging first
- ✅ Easy to rollback (just change env var)
- ✅ No code changes required
- ✅ Can A/B test with feature flags

### Medium Risk
- ⚠️ Quality degradation (mitigated by testing)
- ⚠️ Different behavior patterns (monitor closely)
- ⚠️ Latency differences (measure and compare)

### Mitigation Strategies
1. **Feature Flag**: Add ability to switch models per call
2. **Monitoring**: Track quality metrics closely
3. **Rollback Plan**: Keep current model as fallback
4. **Gradual Rollout**: Start with 10% of calls, increase if successful

---

## Next Steps

1. **Immediate**: Check OpenAI Realtime API documentation for:
   - Available models
   - Per-minute pricing
   - Model comparison guide

2. **Short-term**: Test `gpt-4o-mini-realtime` availability
   - Try connecting with mini model
   - Compare response quality
   - Measure cost difference

3. **Medium-term**: If mini works well:
   - A/B test on staging
   - Monitor for 1 week
   - Roll out to production if successful

---

## Resources

- [OpenAI Pricing Page](https://openai.com/api/pricing/)
- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Model Comparison](https://platform.openai.com/docs/models)

---

## Cost Savings Estimate

**If gpt-4o-mini-realtime is available and 80% cheaper:**

| Monthly Usage | Current Cost | Mini Cost | Savings |
|--------------|--------------|-----------|---------|
| 1,000 min | $X | $0.2X | $0.8X |
| 5,000 min | $5X | $1X | $4X |
| 10,000 min | $10X | $2X | $8X |

**Note**: Replace $X with actual per-minute pricing once verified.

---

## Conclusion

**Potential Savings**: 80-90% if mini model is available and suitable

**Risk Level**: Low (easy to test and rollback)

**Recommendation**: 
1. ✅ Verify pricing and model availability
2. ✅ Test on staging with sample conversations
3. ✅ A/B test for 1 week
4. ✅ Roll out if quality is acceptable

**Priority**: High (significant cost savings with low risk)

