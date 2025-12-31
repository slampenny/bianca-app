Feature: Alert Management
  As a caregiver
  I want to view and manage alerts
  So that I can stay informed about important events

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am logged in as "caregiver"

  Scenario: View alert badge count
    When I navigate to the home screen
    Then I should see the alert badge count

  Scenario: View alerts screen
    When I navigate to the alerts screen
    Then I should see the alerts screen
    And I should see at least 0 alerts

  Scenario: Filter alerts by unread
    Given I am on the alerts screen
    When I click the "unread" alert filter
    Then I should see only unread alerts

  Scenario: Switch between Unread and All Alerts tabs
    Given I am on the alerts screen
    And I have both read and unread alerts
    When I view the "Unread" tab
    Then I should see only unread alerts
    When I switch to the "All Alerts" tab
    Then I should see all alerts including read ones

  Scenario: Mark all alerts as read
    Given I am on the alerts screen
    And I have unread alerts
    When I mark all alerts as read
    Then all alerts should be marked as read

