Feature: Mobile account mode (B2C vs org-family)
  As a mobile user
  I want the app to match my account type
  So that B2C owners can manage care and facility family users get read-only access

  Background:
    Given the frontend is running on "http://localhost:8084"
    And the backend is running on "http://localhost:3000"

  @account-mode
  Scenario: B2C account owner sees alerts and can manage loved ones
    Given I am logged in as "familyParent"
    Then I should see the alerts tab
    And I should see the add client button
    When I open the first linked loved one profile
    Then I should see the edit loved one button
    And I should see the schedule button on the profile
    And I should see the conversations button on the profile
    When I open the loved one schedule screen
    Then I should see the save schedule button

  @account-mode
  Scenario: Org-family portal user has read-only resident access
    Given I am logged in as "familyPortal"
    Then I should not see the alerts tab
    And I should not see the add client button
    When I open the first linked loved one profile
    Then I should not see the edit loved one button
    And I should see the schedule button on the profile
    And I should see the conversations button on the profile
    When I open the loved one schedule screen
    Then I should not see the save schedule button
    When I open the first linked loved one profile
    And I open the loved one conversations screen
    Then I should see the conversations screen
    And I should see at least one conversation on the list
    When I open the family weekly digests from insights
    Then I should see at least one family weekly digest
