Feature: Family portal invite onboarding
  As a digest recipient invited to the mobile app
  I want to complete signup from the invite link
  So that I land in read-only org-family mode

  Background:
    Given the frontend is running on "http://localhost:8084"
    And the backend is running on "http://localhost:3000"

  @family-invite
  Scenario: Family invite link completes signup and opens read-only home
    Given a pending family portal invite is prepared for "family.invite.e2e@example.org"
    When I open the family portal invite signup page
    And I complete the family invite registration with password "Password1"
    And I reach the home screen after family invite signup
    Then I should not see the add client button
    And I should not see the alerts tab
