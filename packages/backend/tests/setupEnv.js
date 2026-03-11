/**
 * Runs before the test framework and any other setup.
 * Ensures NODE_ENV (and other env) are set before config or app code loads.
 */
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
