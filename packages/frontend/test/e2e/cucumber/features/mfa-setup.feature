Feature: Multi-Factor Authentication Setup
  As a caregiver
  I want to enable MFA
  So that my account is more secure

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "caregiver"

  Scenario: Navigate to MFA setup
    When I navigate to the profile screen
    And I navigate to the MFA setup screen
    Then I should see the MFA setup screen

  Scenario: View MFA status
    Given I am on the MFA setup screen
    Then I should see MFA status information

  Scenario: Enable MFA
    Given I am on the MFA setup screen
    And MFA is currently disabled
    When I enable MFA
    Then I should see the QR code
    And I should see the secret key
    And I should see backup codes

  Scenario: Cancel MFA setup
    Given I am on the MFA setup screen
    And I have initiated MFA setup
    When I cancel MFA setup
    Then I should return to the profile screen









