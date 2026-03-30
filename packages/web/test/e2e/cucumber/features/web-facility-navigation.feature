Feature: Web facility shell navigation
  Signed-in users can reach every main area from the sidebar

  Background:
    Given the web frontend is available at "http://localhost:5173"
    And the API is available at "http://localhost:3000"

  Scenario: Navigate across primary sidebar destinations
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "dashboard" section
    Then I should see the web dashboard
    When I open the web sidebar "residents" section
    Then I should see the web residents hub
    When I open the web sidebar "alerts" section
    Then I should see the web alerts hub
    When I open the web sidebar "reports" section
    Then I should see the web reports library
    When I open the web sidebar "settings" section
    Then I should see the web settings page
