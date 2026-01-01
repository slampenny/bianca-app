Feature: Privacy Request (PIPEDA Compliance)
  As a caregiver
  I want to request my personal data
  So that I can access my information under PIPEDA

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "caregiver"
    And my organization is in Canada

  Scenario: Submit privacy request
    When I navigate to the privacy request screen
    And I submit a privacy request
    Then I should see a confirmation message
    And I should receive an email with my data

  Scenario: View privacy request status
    Given I have submitted a privacy request
    When I navigate to the privacy request screen
    Then I should see my request status

  Scenario: Download personal data
    Given I have a completed privacy request
    When I navigate to the privacy request screen
    And I click the download button
    Then I should receive my data as JSON









