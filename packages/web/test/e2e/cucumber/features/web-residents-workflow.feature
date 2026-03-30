Feature: Web residents directory
  Caregivers browse and open resident profiles

  Background:
    Given the web frontend is available at "http://localhost:5173"
    And the API is available at "http://localhost:3000"

  Scenario: Open first resident profile when data exists
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "residents" section
    Then I should see the web residents hub
    When I open the first web resident row
    Then I should see the web resident detail view
    When I go back to residents from resident detail
    Then I should see the web residents hub
