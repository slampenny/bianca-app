# ⚠️ Build Notes Location

**This file is deprecated. Please use the root BUILD_NOTES.md instead.**

## Where to Find Build Notes

All build notes are maintained in a single file at the project root:

**`/BUILD_NOTES.md`** (project root)

This ensures all release notes, deployment information, and change logs are in one centralized location.

## Why?

- **Single Source of Truth**: One file prevents duplication and inconsistencies
- **Complete History**: All backend and frontend changes are documented together
- **Easier Maintenance**: Updates only need to be made in one place
- **Confluence Integration**: The automated script pushes the root BUILD_NOTES.md to Confluence

## What About This File?

This file exists for historical reference only. **Do not update this file.** All new build notes should be added to the root `/BUILD_NOTES.md`.

## Need to Update Build Notes?

1. Edit `/BUILD_NOTES.md` (project root)
2. Run the Confluence push script: `bianca-app-backend/scripts/push-build-notes-to-confluence.sh`

---

**Last Updated**: November 19, 2025  
**Status**: Deprecated - Use root BUILD_NOTES.md
