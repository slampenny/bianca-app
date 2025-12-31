Feature: Patient Management Workflow
  As a caregiver
  I want to manage patients
  So that I can coordinate care and monitor wellness

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "caregiver"

  Scenario: View patient list
    When I navigate to the patients screen
    Then I should see the patient list
    And I should see at least one patient

  Scenario: Create a new patient
    When I navigate to the patients screen
    And I click the "Add Patient" button
    And I enter patient name "John Doe"
    And I enter patient phone "+16045624264"
    And I submit the patient form
    Then I should see the new patient in the list
    And the patient should have name "John Doe"

  Scenario: View patient details
    Given a patient exists with name "Test Patient"
    When I navigate to the patients screen
    And I click on the patient "Test Patient"
    Then I should see the patient details screen
    And I should see patient name "Test Patient"






