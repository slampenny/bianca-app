@skip
Feature: Phone Verification
  As a caregiver
  I want to verify my phone number
  So that I can receive SMS notifications

  Background:
    Given the frontend is running on "http://localhost:8084"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "caregiver"

  Scenario: Request phone verification code
    When I navigate to the profile screen
    And I click the "Verify Phone" button
    Then I should receive a verification code via SMS

  Scenario: Verify phone with code
    Given I have received a verification code
    When I enter the verification code "123456"
    And I submit the verification code
    Then my phone should be verified
    And I should see a confirmation message

  Scenario: Resend verification code
    Given I am on the phone verification screen
    When I click the "Resend Code" button
    Then I should receive a new verification code












