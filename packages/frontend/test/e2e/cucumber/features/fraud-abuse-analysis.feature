Feature: Fraud and Abuse Analysis
  As a caregiver
  I want to view fraud and abuse analysis reports
  So that I can monitor patient safety and detect potential issues

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "caregiver"

  Scenario: Navigate to fraud/abuse analysis screen
    When I navigate to the reports screen
    And I select a patient from the patient picker
    And I click the fraud/abuse reports button
    Then I should see the fraud/abuse analysis screen

  Scenario: View fraud/abuse analysis screen without errors
    Given I am on the fraud/abuse analysis screen
    Then the screen should load without crashing
    And I should see the fraud/abuse analysis title

  Scenario: Trigger fraud/abuse analysis
    Given I am on the fraud/abuse analysis screen
    When I click the "Trigger Analysis" button
    Then I should see analysis results or a success message

  Scenario: View analysis results when available
    Given I am on the fraud/abuse analysis screen
    And analysis results are available
    Then I should see risk score information
    And I should see analysis details

