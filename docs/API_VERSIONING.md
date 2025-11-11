# API Versioning Strategy

**Current Version:** `v1`  
**Status:** ✅ Well-implemented

---

## Current Implementation

### URL Structure

All API routes are prefixed with `/v1`:

```
/v1/auth/login
/v1/patients
/v1/conversations
/v1/alerts
```

### Route Organization

Routes are organized in `src/routes/v1/`:
- `auth.route.js`
- `patient.route.js`
- `conversation.route.js`
- `alert.route.js`
- etc.

All routes are aggregated in `src/routes/v1/index.js` and mounted at `/v1` in the main app.

---

## Versioning Strategy

### ✅ Current Approach: URL Path Versioning

**Pros:**
- Clear and explicit
- Easy to maintain multiple versions
- No breaking changes for existing clients
- Standard REST practice

**Implementation:**
```javascript
// src/app.js
app.use('/v1', routes);
```

---

## Future Versioning (When v2 is Needed)

### Recommended Approach

1. **Create new version directory:**
   ```
   src/routes/v2/
   ```

2. **Mount both versions:**
   ```javascript
   // src/app.js
   app.use('/v1', routesV1);
   app.use('/v2', routesV2);
   ```

3. **Deprecation Strategy:**
   - Announce v1 deprecation 6 months in advance
   - Add deprecation headers to v1 responses
   - Maintain v1 for 12 months after v2 launch
   - Provide migration guide

### Deprecation Headers

```javascript
// Add to v1 routes when v2 is available
res.set('Deprecation', 'true');
res.set('Sunset', '2026-01-01'); // Date when v1 will be removed
res.set('Link', '</v2>; rel="successor-version"');
```

---

## Breaking Changes Policy

### What Requires a New Version?

**Major Version Bump (v1 → v2):**
- Removing endpoints
- Changing request/response structure
- Changing authentication mechanism
- Removing required fields
- Changing data types

**Minor Changes (Stay in v1):**
- Adding new endpoints
- Adding optional fields
- Adding new query parameters
- Performance improvements
- Bug fixes

---

## Migration Path

### For Clients

1. **Gradual Migration:**
   - Update to v2 endpoints incrementally
   - Test thoroughly before full migration
   - Keep v1 fallback during transition

2. **Documentation:**
   - Provide migration guide
   - List breaking changes
   - Provide code examples

---

## Best Practices

### ✅ Do:
- Use semantic versioning (v1, v2, v3)
- Document breaking changes
- Provide migration guides
- Maintain backward compatibility during transition
- Add deprecation warnings

### ❌ Don't:
- Remove versions without notice
- Make breaking changes in same version
- Skip version numbers (v1 → v3)
- Change versioning strategy mid-project

---

## Current Status

**Version:** v1  
**Status:** Active  
**Deprecation:** Not planned  
**Next Version:** v2 (when needed)

---

**Conclusion:** Your API versioning strategy is solid. The `/v1` prefix is clear, maintainable, and follows REST best practices. No changes needed at this time.

