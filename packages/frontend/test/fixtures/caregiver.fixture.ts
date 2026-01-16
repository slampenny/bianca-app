export function newCaregiver() {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
    return {
      name: "Test Caregiver",
      email: `test+${uniqueSuffix}@example.com`,
      password: "password1",
      phone: "1234567890",
    };
  }