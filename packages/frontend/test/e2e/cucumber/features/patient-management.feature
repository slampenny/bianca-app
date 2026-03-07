Feature: Client Management Workflow
  As a caregiver
  I want to manage clients
  So that I can coordinate care and monitor wellness

  Background:
    Given the frontend is running on "http://localhost:8084"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "orgAdmin"

  Scenario: View client list
    When I navigate to the clients screen
    Then I should see the client list
    And I should see at least one client

  Scenario: Create a new client
    When I navigate to the clients screen
    And I click the "Add Client" button
    And I enter client name "John Doe"
    And I enter client email "john.doe@example.com"
    And I enter client phone "+16045624264"
    And I submit the client form
    Then I should see the new client in the list
    And the client should have name "John Doe"

  Scenario: View client details
    Given a client exists with name "Test Client"
    When I navigate to the clients screen
    And I click on the client "Test Client"
    Then I should see the client details screen
    And I should see client name "Test Client"












