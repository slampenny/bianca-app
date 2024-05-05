const faker = require('faker');
const { Patient, Caregiver } = require('../../../src/models');

describe('Caregiver model', () => {
  describe('Caregiver validation', () => {
    let newCaregiver;
    beforeEach(() => {
      newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        isEmailVerified: false,
      };
    });

    test('should correctly validate a valid patient', async () => {
      await expect(new Caregiver(newCaregiver).validate()).resolves.toBeUndefined();
    });

    test('should throw a validation error if email is invalid', async () => {
      newCaregiver.email = 'invalidEmail';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });

    test('should throw a validation error if phone is invalid', async () => {
      newCaregiver.phone = 'invalidPhone';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password length is less than 8 characters', async () => {
      newCaregiver.password = 'passwo1';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password does not contain numbers', async () => {
      newCaregiver.password = 'password';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password does not contain letters', async () => {
      newCaregiver.password = '11111111';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });
  });

  describe('Caregiver toJSON()', () => {
    test('should not return caregiver password when toJSON is called', () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        isEmailVerified: false,
        caregiver: null,
        schedules: [],
      };
      expect(new Caregiver(newCaregiver).toJSON()).not.toHaveProperty('password');
    });
  });
});