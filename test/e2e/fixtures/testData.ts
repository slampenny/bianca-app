// Test user data for E2E tests
export const TEST_USERS = {
  WITH_PATIENTS: {
    name: "Test User",
    email: "fake@example.org",
    password: "Password1",
  },
  WITHOUT_PATIENTS: {
    name: "Test User No Patients",
    email: "no-patients@example.org",
    password: "Password1",
  },
  ORGANIZATION: {
    name: "Test Org User",
    email: "org@example.org",
    password: "Password1",
    orgName: "Test Organization",
  },
  // Role-based test users for patient management tests - using actual seeded users
  STAFF: {
    name: "Test User",
    email: "fake@example.org",
    password: "Password1",
    phone: "+16045624263",
    role: "staff" as const,
  },
  ORG_ADMIN: {
    name: "Admin User",
    email: "admin@example.org",
    password: "Password1",
    phone: "+16045624263",
    role: "orgAdmin" as const,
  },
  SUPER_ADMIN: {
    name: "Super Admin",
    email: "superadmin@example.org",
    password: "Password1",
    phone: "+16045624263",
    role: "superAdmin" as const,
  },
} as const;

// Test patient data
export const TEST_PATIENTS = {
  AGNES: {
    name: "Agnes Alphabet",
    email: "agnes@example.org",
    phone: "1234567890",
  },
  BARNABY: {
    name: "Barnaby Button",
    email: "barnaby@example.org",
    phone: "0987654321",
  },
} as const;

// Helper function to generate unique test data
export function generateUniqueTestData(prefix: string = 'test') {
  const timestamp = Date.now();
  return {
    email: `${prefix}-${timestamp}@example.org`,
    phone: `123456${timestamp.toString().slice(-4)}`,
    name: `${prefix} User ${timestamp}`,
  };
}

// Registration test data
export function generateRegistrationData() {
  const timestamp = Date.now();
  return {
    name: "Valid User",
    email: `valid_success_${timestamp}@example.org`,
    password: "StrongPass!1",
    confirmPassword: "StrongPass!1",
    phone: `123456${timestamp.toString().slice(-4)}`,
  };
}

// Alert test data
export function generateAlertData() {
  const timestamp = Date.now();
  return {
    message: `Test Alert ${timestamp}`,
    importance: "high" as const,
    alertType: "patient" as const,
  };
}

// Patient creation test data
export function generatePatientData() {
  const timestamp = Date.now();
  return {
    name: `Test Patient ${timestamp}`,
    email: `test-patient-${timestamp}@example.com`,
    phone: "1234567890",
  };
} 