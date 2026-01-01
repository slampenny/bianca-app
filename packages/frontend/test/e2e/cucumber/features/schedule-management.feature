Feature: Schedule Management
  As a caregiver
  I want to manage patient schedules
  So that I can coordinate wellness calls

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "caregiver"

  Scenario: View patient schedules
    Given I am on the schedules screen
    Then I should see the schedules screen
    And I should see at least one schedule or empty state

  Scenario: Create a new schedule
    Given I am on the schedules screen
    When I create a new schedule
    And I set schedule time to "10:00"
    And I set schedule days to "Monday, Wednesday, Friday"
    And I save the schedule
    Then I should see the schedule in the list

  Scenario: View multiple schedules
    Given I am on the schedules screen
    Then I should see the schedules screen
    And I should see at least one schedule or empty state












