Feature: Billing Information
  As an organization admin
  I want to view billing information
  So that I can manage my organization's payments

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am an organization admin

  Scenario: View billing screen
    When I navigate to the billing screen
    Then I should see the billing screen
    And I should see billing tabs

  Scenario: View current charges
    Given I am on the billing screen
    When I click the "Current Charges" tab
    Then I should see current charges information

  Scenario: View billing information
    Given I am on the billing screen
    When I click the "Billing Info" tab
    Then I should see billing information

  Scenario: View payment methods from billing
    Given I am on the billing screen
    When I click the "Payment Methods" tab
    Then I should see the payment methods list









