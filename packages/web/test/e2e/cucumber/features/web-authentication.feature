Feature: Web authentication
  As a caregiver using the facility dashboard
  I want to sign in on the web app
  So that I can access protected pages

  Background:
    Given the web frontend is available at "http://localhost:5173"
    And the API is available at "http://localhost:3000"

  Scenario: Login with valid credentials
    Given I have cleared the web app session
    When I open the web login page
    And I type web login email "fake@example.org"
    And I type web login password "Password1"
    And I submit the web login form expecting success
    Then I should land on the web dashboard

  Scenario: Login with invalid credentials
    Given I have cleared the web app session
    When I open the web login page
    And I type web login email "invalid@test.com"
    And I type web login password "wrongpassword"
    And I submit the web login form allowing failure
    Then I should see a web login error message
    And the web login form should still be visible

  Scenario: Request password reset from forgot-password flow
    Given I have cleared the web app session
    When I open web forgot password from login
    And I submit web forgot password for "fake@example.org"
    Then I should see web forgot password confirmation
