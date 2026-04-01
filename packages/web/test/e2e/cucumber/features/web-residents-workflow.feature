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

  Scenario: Caregiver cannot access dangerous call controls
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "residents" section
    And I open the first web resident row
    Then I should not see the resident call action

  Scenario: Org admin can open dedicated resident call workspace
    Given I am signed in on the web as the seeded org admin
    When I open the web sidebar "residents" section
    And I open the first web resident row
    Then I should see the resident call action
    When I open the resident call workspace
    Then I should see the resident call workspace
    And I should see resident call controls
    When I go back to resident detail from resident call workspace
    Then I should see the web resident detail view

  Scenario: Caregiver cannot access resident call workspace via URL
    Given I am signed in on the web as the seeded test caregiver
    When I navigate directly to resident call workspace URL
    Then I should not see the resident call workspace

  Scenario: Resident analysis tabs and conversations are visible for org admin
    Given I am signed in on the web as the seeded org admin
    When I open the web sidebar "residents" section
    And I open the first web resident row
    Then I should see resident analysis tabs
    And sentiment should be the default analysis tab
    When I switch resident analysis tab to "Medical"
    Then the "Medical" analysis tab should be active
    When I switch resident analysis tab to "Security"
    Then the "Security" analysis tab should be active
    And I should see the recent conversations section

  Scenario: Caregivers area is visible only to org admin
    Given I am signed in on the web as the seeded test caregiver
    Then I should not see caregivers navigation
    Given I am signed in on the web as the seeded org admin
    Then I should see caregivers navigation
    When I open the web sidebar "caregivers" section
    Then I should see the caregivers management page

  Scenario: Org admin can add, edit, and delete resident schedules
    Given I am signed in on the web as the seeded org admin
    When I open the web sidebar "residents" section
    And I open the first web resident row
    Then I should see the resident schedules section
    When I add a weekly resident schedule at "10:15" for days "Mon,Wed"
    Then I should see a resident schedule containing "10:15"
    When I edit that resident schedule time to "10:45"
    Then I should see a resident schedule containing "10:45"
    When I delete the matching resident schedule
    Then I should not see a resident schedule containing "10:45"
