# Backend Refactor Priorities
**Branch:** `refactor/backend`  
**Date:** January 2025  
**Based on:** ARCHITECTURAL_REVIEW.md

---

## Priority Framework

**P0 - Critical (Do First)**
- Security vulnerabilities
- Production bugs
- Breaking changes that block other work

**P1 - High Priority (Do Soon)**
- Technical debt that impacts maintainability
- Performance issues affecting users
- Code quality issues that slow development

**P2 - Medium Priority (Do When Time Permits)**
- Code organization improvements
- Developer experience enhancements
- Non-critical optimizations

**P3 - Low Priority (Nice to Have)**
- Documentation improvements
- Code style consistency
- Future-proofing

---

## Prioritized Refactor Tasks

### P0 - Critical (0 items)
✅ **None** - No critical security or production-blocking issues identified

---

### P1 - High Priority (4 items)

#### 1. Upgrade Mongoose from 5.7.7 to 8.x
**Priority:** P1  
**Impact:** Security, Performance, Features  
**Effort:** Medium (2-3 days)  
**Risk:** Medium (breaking changes possible)

**Why:**
- Current version (5.7.7) is outdated (current is 8.x)
- Missing security patches and performance improvements
- Missing newer features that could simplify code

**Steps:**
1. Review Mongoose 8.x migration guide
2. Update package.json
3. Run full test suite
4. Fix any breaking changes
5. Test in staging environment
6. Deploy to production

**Dependencies:** None  
**Blocks:** None

---

#### 2. Refactor `openai.realtime.service.js` (4000+ lines)
**Priority:** P1  
**Impact:** Maintainability, Testability, Code Quality  
**Effort:** High (5-7 days)  
**Risk:** Medium (complex refactor, needs thorough testing)

**Why:**
- File is too large (4000+ lines) - violates single responsibility
- Hard to test individual components
- Difficult to maintain and debug
- High cognitive load for developers

**Proposed Split:**
```
src/services/ai/realtime/
├── connection.manager.js      # WebSocket connection management
├── state.machine.js           # Conversation state machine
├── audio.processor.js         # Audio processing and buffering
├── message.handler.js         # Message accumulation and saving
├── event.handler.js           # Event handling (OpenAI events)
└── index.js                   # Main service (orchestrates above)
```

**Steps:**
1. Create new directory structure
2. Extract connection management
3. Extract state machine
4. Extract audio processing
5. Extract message handling
6. Update all imports
7. Run full test suite
8. Integration testing

**Dependencies:** None  
**Blocks:** Future AI feature development

---

#### 3. Add Caching Layer (Redis)
**Priority:** P1  
**Impact:** Performance, Scalability  
**Effort:** Medium (3-4 days)  
**Risk:** Low (additive change)

**Why:**
- No caching layer currently exists
- Frequently accessed data (sessions, user data) could benefit
- Rate limiting could use Redis
- Improves scalability

**Implementation:**
- Add Redis client
- Cache session data
- Cache frequently accessed user/patient data
- Use Redis for rate limiting
- Add cache invalidation strategies

**Steps:**
1. Set up Redis infrastructure (Docker/local)
2. Add Redis client library
3. Create cache service wrapper
4. Implement session caching
5. Add cache for frequently accessed data
6. Update rate limiting to use Redis
7. Add cache invalidation
8. Performance testing

**Dependencies:** None  
**Blocks:** None

---

#### 4. Expand API Documentation (Swagger/OpenAPI)
**Priority:** P1  
**Impact:** Developer Experience, Onboarding  
**Effort:** Medium (2-3 days)  
**Risk:** Low (documentation only)

**Why:**
- Swagger setup exists but incomplete
- New developers struggle to understand API
- Missing endpoint documentation
- Improves API discoverability

**Steps:**
1. Document all endpoints
2. Add request/response schemas
3. Add authentication requirements
4. Add example requests/responses
5. Add error response documentation
6. Set up Swagger UI in production (if needed)

**Dependencies:** None  
**Blocks:** None

---

### P2 - Medium Priority (4 items)

#### 5. Standardize Service Exports Pattern
**Priority:** P2  
**Impact:** Code Consistency  
**Effort:** Low (1 day)  
**Risk:** Low

**Why:**
- Mixed patterns: some services use `services/index.js`, others use direct requires
- Inconsistent patterns make code harder to navigate
- Should pick one pattern and standardize

**Steps:**
1. Decide on standard pattern (recommend: use `services/index.js`)
2. Update all service imports to use index
3. Update all service exports in index.js
4. Run tests to ensure nothing breaks

**Dependencies:** None  
**Blocks:** None

---

#### 6. Review and Optimize Database Indexes
**Priority:** P2  
**Impact:** Performance  
**Effort:** Medium (2-3 days)  
**Risk:** Low (can be done incrementally)

**Why:**
- No comprehensive index review done
- Query patterns may benefit from additional indexes
- Missing indexes can cause performance issues at scale

**Steps:**
1. Analyze query patterns (MongoDB profiler)
2. Identify slow queries
3. Review existing indexes
4. Add missing indexes
5. Remove unused indexes
6. Performance testing
7. Monitor in production

**Dependencies:** None  
**Blocks:** None

---

#### 7. Expand Rate Limiting to More Endpoints
**Priority:** P2  
**Impact:** Security, Abuse Prevention  
**Effort:** Low (1 day)  
**Risk:** Low

**Why:**
- Currently only auth endpoints are rate limited
- Other endpoints could be abused
- Prevents DDoS and abuse

**Steps:**
1. Identify endpoints that need rate limiting
2. Add rate limiting middleware to those routes
3. Configure appropriate limits
4. Test rate limiting behavior
5. Monitor in production

**Dependencies:** None  
**Blocks:** None

---

#### 8. Split Configuration File (`config.js` - 380+ lines)
**Priority:** P2  
**Impact:** Maintainability  
**Effort:** Low (1 day)  
**Risk:** Low

**Why:**
- Single large config file (380+ lines)
- Hard to navigate
- Could be split into logical modules

**Proposed Split:**
```
src/config/
├── config.js              # Main config (exports everything)
├── database.config.js      # MongoDB configuration
├── auth.config.js         # JWT, MFA configuration
├── email.config.js        # Email/SES configuration
├── asterisk.config.js     # Asterisk/ARI configuration
├── openai.config.js       # OpenAI configuration
├── aws.config.js          # AWS services configuration
└── billing.config.js      # Billing configuration
```

**Steps:**
1. Create new config modules
2. Move related config to modules
3. Update main config.js to import and export
4. Update all imports
5. Run tests

**Dependencies:** None  
**Blocks:** None

---

### P3 - Low Priority (2 items)

#### 9. API Versioning Strategy
**Priority:** P3  
**Impact:** Future-proofing  
**Effort:** Low (1 day)  
**Risk:** Low

**Why:**
- Currently using `/v1/` but no strategy documented
- Need plan for future breaking changes
- Good practice for API evolution

**Steps:**
1. Document versioning strategy
2. Plan for `/v2/` when needed
3. Document deprecation process
4. Add version headers if needed

**Dependencies:** None  
**Blocks:** None

---

#### 10. Consider TypeScript Migration (Long-term)
**Priority:** P3  
**Impact:** Type Safety, Developer Experience  
**Effort:** Very High (weeks/months)  
**Risk:** High (major refactor)

**Why:**
- TypeScript provides better type safety
- Better IDE support
- Catches errors at compile time
- Industry standard for large codebases

**Note:** This is a long-term consideration, not immediate priority. Would require:
- Gradual migration strategy
- Significant time investment
- Team training

**Dependencies:** Team decision  
**Blocks:** None

---

## Recommended Execution Order

### Phase 1: Foundation (Week 1-2)
1. ✅ Upgrade Mongoose (P1) - **Start here**
2. Standardize Service Exports (P2) - Quick win, do in parallel
3. Split Configuration File (P2) - Quick win, do in parallel

### Phase 2: Major Refactoring (Week 3-4)
4. Refactor `openai.realtime.service.js` (P1) - **Biggest impact**
5. Review Database Indexes (P2) - Do in parallel if time permits

### Phase 3: Infrastructure (Week 5-6)
6. Add Caching Layer (P1)
7. Expand Rate Limiting (P2) - Quick, do in parallel

### Phase 4: Documentation (Week 7)
8. Expand API Documentation (P1)

### Phase 5: Future Planning (Ongoing)
9. API Versioning Strategy (P3)
10. TypeScript Migration (P3) - Long-term consideration

---

## Success Metrics

- **Code Quality:**
  - Reduce largest file from 4000+ lines to <500 lines per file
  - Increase test coverage (maintain current 811 tests)
  - Zero linting errors

- **Performance:**
  - Reduce database query times (after index optimization)
  - Reduce API response times (after caching)
  - Improve scalability metrics

- **Developer Experience:**
  - Complete API documentation
  - Consistent code patterns
  - Easier onboarding for new developers

---

## Risk Mitigation

1. **Mongoose Upgrade:**
   - Test thoroughly in staging
   - Have rollback plan
   - Monitor production closely after deployment

2. **Service Refactoring:**
   - Keep old code until new code is fully tested
   - Feature flag if possible
   - Extensive integration testing

3. **Caching Layer:**
   - Start with non-critical data
   - Implement cache invalidation carefully
   - Monitor cache hit rates

---

## Notes

- All refactoring should maintain 100% test pass rate
- Each change should be reviewed and tested before merging
- Consider doing refactors in small, incremental PRs
- Document breaking changes clearly



