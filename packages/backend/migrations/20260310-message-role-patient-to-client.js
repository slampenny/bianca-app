/**
 * Migration: Message.role 'patient' → 'client'
 *
 * Conversation messages used role 'patient' for the caller; we standardize on 'client'
 * to match the rest of the app (clientId, Client model, etc.). This migration updates
 * all existing Message documents with role 'patient' to role 'client'.
 *
 * Safe to run multiple times: only updates documents where role === 'patient'.
 *
 * Created: 2026-03-10
 */

module.exports = {
  async up(db) {
    try {
      const result = await db.collection('messages').updateMany(
        { role: 'patient' },
        { $set: { role: 'client' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Migration] messages: migrated ${result.modifiedCount} document(s) role 'patient' → 'client'`);
      }
      console.log('[Migration] message role patient → client completed.');
    } catch (err) {
      console.error('[Migration] message role patient → client failed:', err);
      throw err;
    }
  },

  async down(db) {
    console.log('[Migration] Down: message role migration does not auto-rollback.');
    console.log('[Migration] To restore role "patient", restore from backup or run a custom script.');
  },
};
