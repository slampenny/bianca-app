/**
 * Resolve the OpenAI client class from the official `openai` package.
 *
 * In CommonJS, `require('openai')` is often the module namespace; the constructor
 * is exposed as `OpenAI` (named export). Using `new (require('openai'))()` throws
 * "OpenAI is not a constructor".
 *
 * Jest mocks sometimes replace the whole module with `jest.fn()`; in that case
 * there is no `.OpenAI` and we fall back to the mock function itself.
 */
function getOpenAIConstructor() {
  const mod = require('openai');
  return mod.OpenAI || mod.default || mod;
}

module.exports = { getOpenAIConstructor };
