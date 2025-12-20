# Staging-Old Migration Plan: Prioritized Feature Analysis

**Date:** 2025-12-19  
**Purpose:** Analyze commits on `staging-old` ahead of `staging` and prioritize migration without breaking AI voice functionality

## Executive Summary

There are **42 commits** on `staging-old` that are not on `staging`. The changes span several critical areas:
- **Audio Processing & Noise Reduction** (High Priority - Directly affects AI voice)
- **OpenAI Realtime Model Changes** (High Priority - Core AI functionality)
- **Call Status & Polling** (Medium Priority - UX improvements)
- **Deployment Infrastructure** (Medium Priority - Operational)
- **UI/UX Features** (Low Priority - Non-critical features)
- **Test Fixes** (Low Priority - Development tooling)

---

## Feature Breakdown by Category

### 🔴 **CRITICAL: Audio Processing & Noise Reduction** (AI Voice Impact: HIGH)

#### Commits:
- `c1bd0b2` - Add noise suppression improvements for noisy environments
- `5727a01` - making a ton of noise cancelling changes
- `e6eba54` - Add feature flags for noise reduction stages
- `49c4c81` - Disable built-in OpenAI noise reduction by default to match main
- `e1df1f6` - Disable noise reduction service by default
- `ca10afc` - Add feature flag for turn detection settings
- `c3680c6` - Add logging for turn detection mode

#### Changes Summary:

**1. Multi-Stage Noise Reduction Pipeline**
- **Stage 1: Noise Gate** - Filters low-energy audio (enabled by default)
- **Stage 2: Frequency Filtering** - Band-pass filter (300-3400Hz) to remove frequencies outside human speech range (NEW)
- **Stage 3: Primary Speaker Detection** - Focuses on loudest/most consistent speaker (enabled by default in staging-old)
- **Stage 4: Adaptive Noise Reduction** - Not yet implemented

**2. Master Feature Flag**
- `AUDIO_NOISE_REDUCTION_ENABLED` - Controls ALL noise reduction (default: `false` in staging-old)
- When disabled, all noise reduction stages are bypassed

**3. Turn Detection Settings**
- Feature flag: `AUDIO_TURN_DETECTION_NOISE_OPTIMIZED` (default: `false`)
- **Fast mode (default):** 500ms silence, 200ms padding (matches main branch)
- **Noise-optimized mode:** 1000ms silence, 300ms padding (for noisy environments)

**4. OpenAI Built-in Noise Reduction**
- Feature flag: `AUDIO_OPENAI_NOISE_REDUCTION_ENABLED` (default: `false`)
- Type: `near_field` (optimized for phone calls)

**5. Primary Speaker Detection Improvements**
- More sophisticated energy-based detection
- Handles sudden drops and background audio better
- More aggressive volume reduction for background audio

#### Files Modified:
- `packages/backend/src/services/audio/noise-reduction.service.js` - Major refactor
- `packages/backend/src/api/audio.utils.js` - Added band-pass filter functions
- `packages/backend/src/config/config.js` - Added extensive audio configuration
- `packages/backend/src/services/openai.realtime.service.js` - Turn detection configuration

#### Migration Risk: **HIGH** ⚠️
- These changes significantly alter audio processing pipeline
- Default behavior changed (noise reduction disabled by default)
- Turn detection timing affects conversation flow
- Frequency filtering is computationally intensive (async operations)

#### Recommended Approach:
1. **Start with feature flags disabled** (current staging-old defaults)
2. **Test AI voice quality** with noise reduction disabled
3. **Gradually enable features** one at a time:
   - First: Enable noise gate only
   - Second: Enable primary speaker detection
   - Third: Enable frequency filtering (test performance impact)
   - Fourth: Enable turn detection noise optimization (if needed)
4. **Monitor audio quality** and conversation flow at each stage
5. **Keep OpenAI built-in noise reduction disabled** unless specifically needed

---

### 🔴 **CRITICAL: OpenAI Realtime Model Changes** (AI Voice Impact: HIGH)

#### Commits:
- `c692f3d` - moving to a newer openai model
- `ea5b5bf` - Switch from 2025 to 2024 OpenAI realtime model
- `df978a9` - Fix remaining 2025 model reference in openai.realtime.service.js
- `be0adf3` - Enable polling for call status updates and switch to 2024 model

#### Changes Summary:
- **Model Change:** `gpt-realtime-2025-08-28` → `gpt-4o-realtime-preview-2024-12-17`
- **Reason:** "to eliminate model version as a possibility for audio/call status issues"
- This is a **downgrade** from a newer model to an older preview model

#### Files Modified:
- `packages/backend/src/config/config.js`
- `packages/backend/src/services/ai/realtime/connection.manager.js`

#### Migration Risk: **HIGH** ⚠️
- Model downgrade may affect AI response quality, accuracy, or capabilities
- The 2025 model may have better voice quality, latency, or features
- Need to verify if the downgrade was intentional or temporary

#### Recommended Approach:
1. **Investigate why the downgrade was made** - Check commit messages and related issues
2. **Test both models** if possible to compare:
   - Voice quality
   - Response accuracy
   - Latency
   - Conversation flow
3. **Consider staying on 2025 model** if it's stable and available
4. **If downgrade is necessary**, ensure all references are updated (commit `df978a9` suggests there was a missed reference)

---

### 🟡 **MEDIUM: Call Status & Polling Improvements** (AI Voice Impact: LOW, UX Impact: HIGH)

#### Commits:
- `153fbfa` - Fix call status not updating when answered
- `4d9ae4b` - Add polling to conversation query on call screen
- `be0adf3` - Enable polling for call status updates and switch to 2024 model
- `d44b0a5` - Fix polling skip conditions - use API status not local state
- `d1ec070` - Change v1 to v2 in call header for deployment verification
- `27ae2ee` - Add v1 to call header label for deployment verification

#### Changes Summary:
- **Frontend Polling:** Added polling intervals for call status and conversation updates
- **Status Detection:** Fixed issue where call status wasn't updating when answered
- **Skip Logic:** Changed from local state-based skipping to API status-based skipping
- **Deployment Verification:** Added version labels (v1/v2) to call headers

#### Files Modified:
- `packages/frontend/app/screens/CallScreen.tsx`
- `packages/frontend/app/components/CallStatusBanner.tsx`
- `packages/backend/src/controllers/callWorkflow.controller.js`

#### Migration Risk: **LOW** ✅
- These are UX improvements that don't affect AI voice processing
- Polling may increase API load but shouldn't affect audio quality
- Status updates are display-only

#### Recommended Approach:
1. **Merge these changes** - They improve user experience without affecting AI voice
2. **Monitor API load** from increased polling
3. **Test call status updates** to ensure they work correctly
4. **Remove version labels** (v1/v2) if not needed for production

---

### 🟡 **MEDIUM: Deployment & Infrastructure** (AI Voice Impact: NONE, Operational Impact: HIGH)

#### Commits:
- `299338e` - Install docker compose (plugin) instead of docker-compose (standalone)
- `fb33820` - Fix CodeDeploy scripts to use docker-compose (standalone)
- `f72e96a` - Update CodeDeploy scripts to prefer docker compose (plugin)
- `0e1835a` - Simplify docker compose usage - use plugin directly
- `d72952a` - Fix docker compose container startup issues
- `e0ffe7d` - fixing docker compose
- `dee4303` - disambugating docker-compose vs docker compose
- `ad415a0` - Fix ApplicationStart to exit on container startup failure
- `0b08bc0` - Add image verification to after_install script
- `b943c72` - Force aggressive image pull to ensure latest builds are deployed
- `7271ce9` - still fixing deployment
- `f65a85d` - fixing deploy
- `f477ec8` - fixing afterinstall script
- `ca7283d` - retrying the whole pipeline
- `983c141` - fixing staging pipeline

#### Changes Summary:
- **Docker Compose Migration:** Switched from standalone `docker-compose` to Docker plugin `docker compose`
- **Deployment Scripts:** Multiple fixes to CodeDeploy scripts
- **Image Verification:** Added checks to ensure correct Docker images are deployed
- **Container Startup:** Fixed issues with container startup and failure handling

#### Files Modified:
- `packages/backend/devops/codedeploy/scripts/after_install.sh`
- `packages/backend/devops/codedeploy/scripts/application_start.sh`
- `packages/backend/devops/codedeploy/scripts/application_stop.sh`
- `packages/backend/devops/codedeploy/scripts/validate_service.sh`
- `packages/backend/devops/terraform/staging-userdata.sh`
- `packages/backend/devops/terraform/staging-userdata-minimal.sh`

#### Migration Risk: **MEDIUM** ⚠️
- Infrastructure changes can cause deployment failures
- Docker compose plugin vs standalone may have compatibility issues
- Multiple "fixing" commits suggest instability

#### Recommended Approach:
1. **Test deployment scripts** in a non-production environment first
2. **Verify Docker compose plugin** is available on target systems
3. **Review all deployment script changes** carefully
4. **Consider keeping current working deployment** if staging is stable
5. **Merge incrementally** - one deployment script at a time

---

### 🟢 **LOW: UI/UX Features** (AI Voice Impact: NONE)

#### Commits:
- `08cb720` - country dropdown
- `eb635a0` - org jurisdiction changes
- Plus navigation, typography, and other frontend improvements

#### Changes Summary:

**1. Country Picker Component (New Reusable Component)**
- **New Component:** `CountryPicker.tsx` - A reusable, accessible country selection component
- **Features:**
  - Localized country names using `Intl.DisplayNames` API (automatically shows country names in user's language)
  - WCAG-compliant accessibility (ARIA labels, keyboard navigation, screen reader support)
  - Theme-aware styling (supports dark/light mode)
  - Web-specific CSS theming for dropdown
  - Supports 20 common countries + "Other" option
  - Proper focus indicators and hover states
- **Replaced:** Inline country picker code in `OrgScreen.tsx` and `RegisterScreen.tsx`
- **Default Country Changed:** From "US" to "CA" (Canada) in both screens

**2. Organization Jurisdiction Changes**
- **Test Seeder Update:** Changed default test org from `orgOne` (US) to `orgTwo` (CA)
- **Reason:** Privacy request UI differs between CA (PIPEDA) and US (HIPAA) - needed for proper test coverage
- **Impact:** Test organization now uses Canadian jurisdiction for privacy compliance testing

**3. Registration Screen Improvements**
- **Country Field:** Now shown for both individual and organization accounts (previously only for organizations)
- **Code Cleanup:** Removed duplicate country list code, now uses shared `CountryPicker` component
- **Default Country:** Changed from "US" to "CA"

**4. Organization Screen Refactoring**
- **Code Reduction:** Removed ~130 lines of duplicate picker styling code
- **Component Reuse:** Now uses shared `CountryPicker` component
- **Default Country:** Changed from "US" to "CA"
- **Cleaner Code:** Removed inline CSS injection for picker theming (now handled by component)

**5. Navigation Improvements**
- **AppNavigator.tsx:** Significant updates (+255 lines)
- **Navigation Utilities:** Enhanced navigation helper functions (+24 lines)
- **AppNavigators.tsx:** Minor updates (+11 lines)

**6. Typography Updates**
- **typography.ts:** Font and text styling improvements (+25 lines)

**7. Toast Component**
- **Toast.tsx:** Minor updates (+2 lines)

**8. Profile & Logout Screens**
- **ProfileScreen.tsx:** Removed 20 lines (cleanup)
- **LogoutScreen.tsx:** Enhanced with 31 new lines (improved logout flow)

#### Files Modified:
- `packages/frontend/app/components/CountryPicker.tsx` (NEW - 312 lines)
- `packages/frontend/app/components/index.ts` (export added)
- `packages/frontend/app/components/Toast.tsx` (minor updates)
- `packages/frontend/app/screens/OrgScreen.tsx` (refactored, -130 lines)
- `packages/frontend/app/screens/RegisterScreen.tsx` (refactored, -114 lines)
- `packages/frontend/app/screens/ProfileScreen.tsx` (cleanup, -20 lines)
- `packages/frontend/app/screens/LogoutScreen.tsx` (enhanced, +31 lines)
- `packages/frontend/app/navigators/AppNavigator.tsx` (major updates, +255 lines)
- `packages/frontend/app/navigators/AppNavigators.tsx` (minor updates)
- `packages/frontend/app/navigators/navigationUtilities.ts` (enhanced, +24 lines)
- `packages/frontend/app/theme/typography.ts` (updates, +25 lines)
- `packages/frontend/app/i18n/i18n.ts` (translation updates, +7 lines)
- `packages/backend/src/scripts/seeders/orgs.seeder.js` (test org change)
- `packages/backend/docs/PATIENT_ENGAGEMENT_IMPLEMENTATION.md` (NEW - 1092 lines)
- `packages/backend/docs/PATIENT_ENGAGEMENT_STRATEGY.md` (NEW - 681 lines)
- Test files updated for new country picker usage

#### Migration Risk: **LOW** ✅
- Pure UI/UX changes, no impact on AI voice or backend audio processing
- Component refactoring improves code maintainability
- Default country change (US → CA) may affect new registrations
- Test seeder change only affects test environment

#### Recommended Approach:
1. **Merge CountryPicker component** - Reusable, well-tested, accessible
2. **Review default country change** - Confirm if "CA" is desired default (or should remain "US")
3. **Test country picker** functionality:
   - Verify localization works (country names in user's language)
   - Test accessibility (screen readers, keyboard navigation)
   - Test on iOS, Android, and Web
   - Verify theme support (dark/light mode)
4. **Test registration flow** - Ensure country selection works for both account types
5. **Test organization settings** - Verify country can be updated
6. **Review navigation changes** - Test navigation flows work correctly
7. **Verify typography** - Check text rendering looks good
8. **Test logout flow** - Verify enhanced logout works correctly
9. **Review documentation** - New patient engagement docs are informational only
10. **Test seeder change** - Only affects test environment, verify privacy request tests pass

---

### 🟢 **LOW: Test Fixes & Development** (AI Voice Impact: NONE)

#### Commits:
- `3a6f780` - all tests should pass in staging
- `b8df3fa` - unit tests passing.
- `7fd5823` - fixing more tests in the pipeline
- `5f87159` - trying to get all test to pass in pipeline
- `a9ebcfe` - fixing test errors
- `82e574a` - all known bugs fixed
- `fc29aa5` - fixing calling

#### Changes Summary:
- Various test fixes and pipeline improvements
- Test configuration updates

#### Files Modified:
- Multiple test files
- Test configuration files

#### Migration Risk: **LOW** ✅
- Test-only changes don't affect production code

#### Recommended Approach:
1. **Merge test fixes** - They improve development workflow
2. **Run full test suite** after merging
3. **Verify all tests pass** on staging

---

### 🟢 **LOW: Frontend Infrastructure** (AI Voice Impact: NONE)

#### Commits:
- Multiple commits related to Expo font handling, Android fixes, navigation improvements

#### Changes Summary:
- Expo font polyfill and configuration
- Android crash fixes
- Navigation improvements
- Typography updates

#### Files Modified:
- `packages/frontend/plugins/withExpoFontDisabled.ts` (new)
- `packages/frontend/app/utils/expo-font-polyfill.ts` (new)
- `packages/frontend/app/theme/typography.ts`
- `packages/frontend/app/navigators/AppNavigator.tsx`
- Various frontend files

#### Migration Risk: **LOW** ✅
- Frontend-only changes, no backend audio processing impact

#### Recommended Approach:
1. **Merge frontend changes** - They're independent of audio processing
2. **Test on iOS and Android** to ensure no regressions
3. **Verify font loading** works correctly

---

## Prioritized Migration Plan

### Phase 1: Critical Audio & Model Changes (Week 1) 🔴

**Goal:** Safely migrate audio processing and model changes without breaking AI voice

1. **Day 1-2: Model Investigation**
   - [ ] Research why model was downgraded from 2025 to 2024
   - [ ] Test both models if possible (2025 vs 2024)
   - [ ] Document differences in voice quality, latency, accuracy
   - [ ] Decision: Keep 2024 or revert to 2025

2. **Day 3-4: Noise Reduction Migration**
   - [ ] Start with all noise reduction **disabled** (current staging-old default)
   - [ ] Test AI voice quality with no noise reduction
   - [ ] Enable noise gate only, test again
   - [ ] Enable primary speaker detection, test again
   - [ ] Document audio quality at each stage

3. **Day 5: Turn Detection Migration**
   - [ ] Keep turn detection in **fast mode** (default, matches main)
   - [ ] Test conversation flow and response timing
   - [ ] Only enable noise-optimized mode if needed for specific environments

4. **Day 6-7: Frequency Filtering (Optional)**
   - [ ] Test frequency filtering performance impact
   - [ ] Enable only if needed for noisy environments
   - [ ] Monitor CPU/memory usage

**Success Criteria:**
- ✅ AI voice quality is at least as good as current staging
- ✅ No increase in latency or response delays
- ✅ Conversation flow remains natural
- ✅ All audio processing features are feature-flag controlled

---

### Phase 2: Call Status & Polling (Week 2) 🟡

**Goal:** Improve UX without affecting audio processing

1. **Day 1-2: Frontend Polling**
   - [ ] Merge call status polling changes
   - [ ] Merge conversation polling changes
   - [ ] Test polling intervals and API load
   - [ ] Verify call status updates correctly

2. **Day 3: Status Detection Fixes**
   - [ ] Merge call status update fixes
   - [ ] Test call status transitions
   - [ ] Remove version labels (v1/v2) if not needed

**Success Criteria:**
- ✅ Call status updates correctly
- ✅ Polling doesn't cause performance issues
- ✅ User experience is improved

---

### Phase 3: Deployment Infrastructure (Week 3) 🟡

**Goal:** Update deployment scripts safely

1. **Day 1-2: Review Deployment Changes**
   - [ ] Review all CodeDeploy script changes
   - [ ] Test in non-production environment
   - [ ] Verify Docker compose plugin availability

2. **Day 3-4: Incremental Deployment Updates**
   - [ ] Update one script at a time
   - [ ] Test deployment after each change
   - [ ] Roll back if issues occur

**Success Criteria:**
- ✅ Deployment scripts work correctly
- ✅ No deployment failures
- ✅ Rollback plan is tested

---

### Phase 4: UI/UX & Other Features (Week 4) 🟢

**Goal:** Merge non-critical features

1. **Day 1-2: Country Picker & Jurisdiction**
   - [ ] Merge country picker component
   - [ ] Merge jurisdiction changes
   - [ ] Test functionality

2. **Day 3-4: Frontend Infrastructure**
   - [ ] Merge Expo font changes
   - [ ] Merge navigation improvements
   - [ ] Test on iOS and Android

3. **Day 5: Test Fixes**
   - [ ] Merge test fixes
   - [ ] Run full test suite
   - [ ] Verify all tests pass

**Success Criteria:**
- ✅ All features work correctly
- ✅ No regressions
- ✅ Tests pass

---

## Risk Mitigation Strategies

### For Audio Processing Changes:

1. **Feature Flags Everywhere**
   - All audio processing features must be feature-flag controlled
   - Default to "safe" settings (disabled or fast mode)
   - Allow gradual enablement

2. **A/B Testing**
   - Test audio processing changes with a subset of calls
   - Compare metrics: voice quality, latency, user satisfaction
   - Roll out gradually

3. **Monitoring**
   - Add metrics for audio processing stages
   - Monitor CPU/memory usage
   - Track audio quality metrics
   - Alert on anomalies

4. **Rollback Plan**
   - Keep current staging configuration as backup
   - Ability to disable all noise reduction instantly
   - Ability to switch models quickly

### For Model Changes:

1. **Model Comparison**
   - Test both 2025 and 2024 models side-by-side
   - Document differences
   - Make informed decision

2. **Gradual Rollout**
   - Start with small percentage of calls
   - Monitor quality metrics
   - Increase gradually

3. **Quick Rollback**
   - Keep ability to switch models via config
   - Test rollback procedure

---

## Key Configuration Variables

### Audio Processing (Feature Flags):
```bash
# Master switch - disables ALL noise reduction
AUDIO_NOISE_REDUCTION_ENABLED=false  # Default: false (safe)

# Individual stages
AUDIO_NOISE_GATE_ENABLED=true        # Default: true
AUDIO_FREQUENCY_FILTER_ENABLED=true  # Default: true
AUDIO_PRIMARY_SPEAKER_ENABLED=false  # Default: false (was true in staging-old)

# Turn detection
AUDIO_TURN_DETECTION_NOISE_OPTIMIZED=false  # Default: false (fast mode)

# OpenAI built-in noise reduction
AUDIO_OPENAI_NOISE_REDUCTION_ENABLED=false  # Default: false
```

### Model Configuration:
```javascript
// In config.js - verify model version
openai: {
  realtimeModel: 'gpt-4o-realtime-preview-2024-12-17'  // or 2025 version
}
```

---

## Testing Checklist

### Audio Quality Tests:
- [ ] AI voice is clear and natural
- [ ] No audio artifacts or distortion
- [ ] Conversation flow is natural (no awkward pauses)
- [ ] Response timing is appropriate
- [ ] Background noise is handled appropriately
- [ ] Multiple speakers are handled correctly

### Performance Tests:
- [ ] No increase in latency
- [ ] CPU/memory usage is acceptable
- [ ] Audio processing doesn't cause delays
- [ ] Frequency filtering doesn't impact performance

### Integration Tests:
- [ ] Call status updates correctly
- [ ] Polling works without issues
- [ ] Frontend displays correctly
- [ ] All feature flags work

### Regression Tests:
- [ ] Existing functionality still works
- [ ] No new bugs introduced
- [ ] Tests pass
- [ ] Deployment works

---

## Decision Points

### 1. Model Version
**Question:** Should we use 2024 or 2025 OpenAI realtime model?  
**Decision Needed:** Test both and choose based on quality metrics

### 2. Noise Reduction Defaults
**Question:** Should noise reduction be enabled by default?  
**Recommendation:** Start disabled, enable gradually based on testing

### 3. Frequency Filtering
**Question:** Is frequency filtering needed, or is it too computationally expensive?  
**Recommendation:** Test performance impact first, enable only if needed

### 4. Turn Detection Mode
**Question:** Fast mode or noise-optimized mode?  
**Recommendation:** Use fast mode (default) unless specific noisy environment needs

---

## Notes

- **Current staging-old defaults are conservative** (noise reduction disabled, fast turn detection)
- **This is good** - safer to start with minimal changes
- **Gradual enablement** is the key to success
- **Monitor everything** - audio quality, performance, user experience
- **Have rollback plan** - be able to disable features quickly if issues arise

---

## Questions to Resolve

1. Why was the OpenAI model downgraded from 2025 to 2024?
2. Were there specific audio quality issues that noise reduction was meant to solve?
3. What was the performance impact of frequency filtering?
4. Are there specific environments (noisy rooms, multiple speakers) that need noise optimization?
5. What metrics should we use to measure audio quality success?

---

**Document Status:** Draft - Ready for Review  
**Next Steps:** Review with team, prioritize based on business needs, begin Phase 1 migration


