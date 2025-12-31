Feature: Invite Caregiver
  As an organization admin
  I want to invite new caregivers
  So that they can join my organization

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am an organization admin

  Scenario: Send caregiver invite
    When I navigate to the caregivers screen
    And I click the "Invite Caregiver" button
    And I enter invite email "newcaregiver@example.com"
    And I select role "staff"
    And I send the invite
    Then I should see a confirmation that the invite was sent

  @skip
  Scenario: Accept invite and complete registration
    Given I have received an invite email
    When I click the invite link
    Then I should see the registration form
    And the email field should be pre-filled
    When I complete the registration form
    And I submit the registration
    Then I should be logged in
    And I should be added to the organization




