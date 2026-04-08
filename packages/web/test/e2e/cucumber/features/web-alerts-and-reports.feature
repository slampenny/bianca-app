Feature: Web alerts and reports
  Alerts hub and report library are reachable; optional drill-in when data exists

  Background:
    Given the web frontend is available at "http://localhost:5173"
    And the API is available at "http://localhost:3000"

  Scenario: Alerts hub and optional alert detail
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "alerts" section
    Then I should see the web alerts hub
    When I open the first web alert if any exist
    Then I should see the web alert detail or stay on alerts
    When I go back to alerts from alert detail

  Scenario: Reports hub from sidebar
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "reports" section
    Then I should see the web reports library

  Scenario: Open a report template and return to the library
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "reports" section
    Then I should see the web reports library
    When I open the web report template "call_log"
    Then I should see the web report detail view
    When I go back to reports from report detail
    Then I should see the web reports library
