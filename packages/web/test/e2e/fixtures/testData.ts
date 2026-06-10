/** Seeded test users (matches backend /v1/test/seed). */
export const TEST_USERS = {
  /** B2B facility staff dashboard */
  WITH_CLIENTS: {
    email: "fake@example.org",
    password: "Password1",
  },
  /** B2C family / mobile dev */
  FAMILY_PARENT: {
    email: "parent@example.org",
    password: "Password1",
  },
} as const
