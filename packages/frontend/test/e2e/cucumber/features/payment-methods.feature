@skip
Feature: Payment Methods Management
  As an organization admin
  I want to manage payment methods
  So that I can pay for services

  Background:
    Given the frontend is running on "http://localhost:8082"
    And the backend is running on "http://localhost:3000"
    And I am an organization admin

  Scenario: View payment methods
    When I navigate to the payment methods screen
    Then I should see the payment methods screen
    And I should see existing payment methods or empty state

  Scenario: Add a new payment method
    Given I am on the payment methods screen
    When I click the "Add Payment Method" button
    And I fill in the payment form
    And I submit the payment form
    Then I should see the new payment method in the list

  Scenario: Remove a payment method
    Given I am on the payment methods screen
    And I have at least one payment method
    When I click the "Remove" button for a payment method
    And I confirm the removal
    Then the payment method should be removed

  Scenario: Set default payment method
    Given I am on the payment methods screen
    And I have at least two payment methods
    When I click the "Set Default" button for a payment method to set default
    Then that payment method should be marked as default

