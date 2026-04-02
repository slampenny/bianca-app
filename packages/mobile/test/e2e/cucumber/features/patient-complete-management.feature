Feature: Complete Client Management
  As a caregiver
  I want to manage clients comprehensively
  So that I can coordinate complete care

  Background:
    Given the frontend is running on "http://localhost:8084"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "orgAdmin"

  Scenario: Create a new client
    Given a client exists with name "John Doe"
    When I navigate to the clients screen
    Then I should see the new client in the list
    And the client should have name "John Doe"

  Scenario: Edit existing client
    Given a client exists with name "Test Client"
    When I navigate to the clients screen
    And I click on the client "Test Client"
    And I edit the client name to "Updated Client"
    And I save the client changes
    Then the client should have name "Updated Client"

  Scenario: View client details
    Given a client exists with name "Test Client"
    When I navigate to the clients screen
    And I click on the client "Test Client"
    Then I should see the client details screen
    And I should see client name "Test Client"
    And I should see client contact information

  Scenario: Manage client avatar
    Given a client exists with name "Test Client"
    When I navigate to the clients screen
    And I click on the client "Test Client"
    And I click the "Change Avatar" button
    And I upload an avatar image
    Then the client avatar should be updated

  Scenario: Access client schedules
    Given a client exists with name "Test Client"
    When I navigate to the clients screen
    And I click on the client "Test Client"
    And I click the "Manage Schedules" button
    Then I should see the schedules screen
    And I should see schedules for "Test Client"
