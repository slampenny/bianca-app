Feature: Complete Patient Management
  As a caregiver
  I want to manage patients comprehensively
  So that I can coordinate complete care

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "orgAdmin"

  Scenario: Create a new patient
    Given a patient exists with name "John Doe"
    When I navigate to the patients screen
    Then I should see the new patient in the list
    And the patient should have name "John Doe"

  @skip
  Scenario: Edit existing patient
    Given a patient exists with name "Test Patient"
    When I navigate to the patients screen
    And I click on the patient "Test Patient"
    And I edit the patient name to "Updated Patient"
    And I save the patient changes
    Then the patient should have name "Updated Patient"

  @skip
  Scenario: View patient details
    Given a patient exists with name "Test Patient"
    When I navigate to the patients screen
    And I click on the patient "Test Patient"
    Then I should see the patient details screen
    And I should see patient name "Test Patient"
    And I should see patient contact information

  @skip
  Scenario: Manage patient avatar
    Given a patient exists with name "Test Patient"
    When I navigate to the patients screen
    And I click on the patient "Test Patient"
    And I click the "Change Avatar" button
    And I upload an avatar image
    Then the patient avatar should be updated

  @skip
  Scenario: Access patient schedules
    Given a patient exists with name "Test Patient"
    When I navigate to the patients screen
    And I click on the patient "Test Patient"
    And I click the "Manage Schedules" button
    Then I should see the schedules screen
    And I should see schedules for "Test Patient"












