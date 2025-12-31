Feature: Email Verification
  As a new user
  I want to verify my email address
  So that I can access all features

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"

  Scenario: Register and receive verification email
    Given I am not logged in
    When I navigate to the registration page
    And I enter registration name "Test User"
    And I enter registration email "{random}@test.com"
    And I enter registration password "SecurePass123!"
    And I enter registration phone "+16045624263"
    And I submit the registration form
    Then I should see the email verification screen
    And I should see a message about checking my email

  Scenario: Resend verification email
    Given I am not logged in
    When I navigate to the registration page
    And I enter registration name "Test User"
    And I enter registration email "{random}@test.com"
    And I enter registration password "SecurePass123!"
    And I enter registration phone "+16045624263"
    And I submit the registration form
    Then I should see the email verification screen
    When I click the "Resend Verification Email" button
    Then I should see a confirmation that email was sent

  # Scenario: Verify email with token
  #   Note: This test requires a real verification token from email, which is difficult to obtain in E2E tests
  #   Given I am not logged in
  #   And I have received a verification email
  #   When I click the verification link
  #   Then I should be logged in
  #   And I should see the home screen

