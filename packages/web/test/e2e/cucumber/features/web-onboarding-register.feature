Feature: Web onboarding and self-service registration
  New users complete onboarding choices and create an account

  Background:
    Given the web frontend is available at "http://localhost:5173"
    And the API is available at "http://localhost:3000"

  Scenario: Caregiver path through onboarding to registration and check-email
    Given I start web onboarding with a clean browser session
    When I choose the caregiver persona on web onboarding
    And I continue from web onboarding about you
    And I continue from web onboarding how it works
    Then I should see the web registration form
    When I complete web registration with random email
    Then I should see the web check email page
