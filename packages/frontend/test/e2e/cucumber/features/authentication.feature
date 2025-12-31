Feature: Authentication Workflow
  As a caregiver
  I want to authenticate with the system
  So that I can access protected features

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"

  Scenario: Login with valid credentials
    Given I am not logged in
    When I navigate to the login page
    And I enter email "fake@example.org"
    And I enter password "Password1"
    And I click the login button
    Then I should be logged in
    And I should see the home screen

  Scenario: Login with invalid credentials
    Given I am not logged in
    When I navigate to the login page
    And I enter email "invalid@test.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see an error message
    And I should remain on the login page

  Scenario: Register a new caregiver
    Given I am not logged in
    When I navigate to the registration page
    And I enter registration name "Test User"
    And I enter registration email "{random}@test.com"
    And I enter registration password "SecurePass123!"
    And I enter registration phone "+16045624263"
    And I submit the registration form
    Then I should see the email verification screen
    And my account should be created

  Scenario: Registration form validation - empty name
    Given I am on the registration page
    When I enter registration email "test@example.com"
    And I enter registration password "SecurePass123!"
    And I enter registration phone "+16045624263"
    And I submit the registration form
    Then I should see an error message about name being required

  Scenario: Registration form validation - invalid email
    Given I am on the registration page
    When I enter registration name "Test User"
    And I enter registration email "invalid-email"
    And I enter registration password "SecurePass123!"
    And I enter registration phone "+16045624263"
    And I submit the registration form
    Then I should see an error message about invalid email

  Scenario: Registration form validation - weak password
    Given I am on the registration page
    When I enter registration name "Test User"
    And I enter registration email "test@example.com"
    And I enter registration password "weak"
    And I enter registration phone "+16045624263"
    And I submit the registration form
    Then I should see an error message about password requirements

  Scenario: Registration form validation - password mismatch
    Given I am on the registration page
    When I enter registration name "Test User"
    And I enter registration email "test@example.com"
    And I enter registration password "SecurePass123!"
    And I enter registration confirm password "DifferentPass123!"
    And I enter registration phone "+16045624263"
    And I submit the registration form
    Then I should see an error message about passwords not matching

  Scenario: Registration form validation - invalid phone
    Given I am on the registration page
    When I enter registration name "Test User"
    And I enter registration email "test@example.com"
    And I enter registration password "SecurePass123!"
    And I enter registration phone "123"
    And I submit the registration form
    Then I should see an error message about invalid phone number

