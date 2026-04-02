Feature: Web registration client-side validation
  The register form blocks invalid input before a successful API call

  Background:
    Given the web frontend is available at "http://localhost:5173"
    And the API is available at "http://localhost:3000"

  Scenario: Full name is required for an individual account
    Given I have cleared session and opened web register
    When I clear the web register full name field
    And I set web register email to "newuser@example.com"
    And I set web register phone to "+16045550123"
    And I set web register password to "SecurePass123!"
    And I set web register confirm password to "SecurePass123!"
    And I submit web registration expecting client validation only
    Then I should see web register validation error containing "full name"

  Scenario: Invalid email format is rejected
    Given I have cleared session and opened web register
    When I set web register full name to "Test User"
    And I set web register email to "not-an-email"
    And I set web register phone to "+16045550123"
    And I set web register password to "SecurePass123!"
    And I set web register confirm password to "SecurePass123!"
    And I submit web registration expecting client validation only
    Then I should see web register validation error containing "valid email"

  Scenario: Weak password is rejected
    Given I have cleared session and opened web register
    When I set web register full name to "Test User"
    And I set web register email to "test@example.com"
    And I set web register phone to "+16045550123"
    And I set web register password to "weak"
    And I set web register confirm password to "weak"
    And I submit web registration expecting client validation only
    Then I should see web register validation error containing "Password must"

  Scenario: Password confirmation must match
    Given I have cleared session and opened web register
    When I set web register full name to "Test User"
    And I set web register email to "test@example.com"
    And I set web register phone to "+16045550123"
    And I set web register password to "SecurePass123!"
    And I set web register confirm password to "OtherPass123!"
    And I submit web registration expecting client validation only
    Then I should see web register validation error containing "do not match"

  Scenario: Phone number must have enough digits
    Given I have cleared session and opened web register
    When I set web register full name to "Test User"
    And I set web register email to "test@example.com"
    And I set web register phone to "123"
    And I set web register password to "SecurePass123!"
    And I set web register confirm password to "SecurePass123!"
    And I submit web registration expecting client validation only
    Then I should see web register validation error containing "10 digits"
