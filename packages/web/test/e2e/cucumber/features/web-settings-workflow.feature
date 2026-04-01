Feature: Web settings and security subpages
  Profile hub links to MFA, privacy, and phone verification flows

  Background:
    Given the web frontend is available at "http://localhost:5173"
    And the API is available at "http://localhost:3000"

  Scenario: Reach MFA and privacy screens from settings
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "settings" section
    Then I should see the web settings page
    When I follow web settings link "mfa"
    Then I should see the web MFA settings page
    When I go back to web settings from subpage
    And I follow web settings link "privacy"
    Then I should see the web privacy settings page
    When I go back to web settings from subpage
    Then I should see the web settings page

  Scenario: Phone verification screen is reachable
    Given I am signed in on the web as the seeded test caregiver
    When I navigate directly to web settings phone
    Then I should see the web phone verification page

  Scenario: Sign out ends the session
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "settings" section
    And I sign out from web settings
    Then I should be on the web login page

  Scenario: Privacy page supports access, correction, and deletion requests
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "settings" section
    And I follow web settings link "privacy"
    Then I should see the web privacy settings page
    When I submit a privacy access request
    Then I should see privacy confirmation containing "access request"
    When I submit a privacy correction request
    Then I should see privacy confirmation containing "correction request"
    When I submit a privacy deletion request
    Then I should see privacy confirmation containing "deletion request"

  Scenario: Billing settings are visible only to org admin
    Given I am signed in on the web as the seeded test caregiver
    When I open the web sidebar "settings" section
    Then I should not see billing settings navigation
    Given I am signed in on the web as the seeded org admin
    When I open the web sidebar "settings" section
    Then I should see billing settings navigation
    When I open web billing settings
    Then I should see the web billing settings page

  Scenario: Non-admin direct billing URL is denied
    Given I am signed in on the web as the seeded test caregiver
    When I navigate directly to web settings billing
    Then I should not see the web billing settings page
