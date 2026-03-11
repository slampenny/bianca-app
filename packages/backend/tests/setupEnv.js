/**
 * Runs before the test framework and any other setup.
 * Ensures NODE_ENV (and other env) are set before config or app code loads.
 * In CI (e.g. CodeBuild) NODE_ENV may be unset when config validates; setting it here avoids config env mismatch warnings.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
