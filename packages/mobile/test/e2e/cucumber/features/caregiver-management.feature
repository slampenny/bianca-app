Feature: Caregiver Management
  As an organization admin
  I want to manage caregivers
  So that I can coordinate team members

  Background:
    Given the frontend is running on "http://localhost:8084"
    And the backend is running on "http://localhost:3000"
    And I am an organization admin

  Scenario: View caregivers list
    When I navigate to the caregivers screen
    Then I should see the caregivers list

  Scenario: Add new caregiver
    Given I am on the caregivers screen
    When I add a new caregiver with name "Dr. New Caregiver" and email "newcaregiver@clinic.com"
    Then I should see caregiver "Dr. New Caregiver" in the list

  Scenario: View existing caregivers
    Given I am on the caregivers screen
    Then I should see the caregivers list
    And I should see at least one caregiver or empty state












