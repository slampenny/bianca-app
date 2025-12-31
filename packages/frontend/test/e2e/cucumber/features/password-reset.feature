Feature: Password Reset
  As a user
  I want to reset my password
  So that I can regain access to my account

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"

  Scenario: Request password reset
    Given I am not logged in
    When I navigate to the login page
    And I click the "Forgot Password" link
    And I enter email "user@example.com" for password reset
    And I click the "Send Reset Link" button
    Then I should see a confirmation message about password reset
    And I should receive a password reset email

  Scenario: Reset password with token
    Given I have received a password reset email
    When I click the reset link
    Then I should see the password reset form
    When I enter a new password "NewSecurePass123!"
    And I confirm the new password "NewSecurePass123!"
    And I submit the reset form
    Then I should see a success message
    And I should be able to login with the new password

