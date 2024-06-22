
const en = {
  common: {
    ok: "OK!",
    cancel: "Cancel",
    back: "Back",
    logOut: "Log Out",
  },
  welcomeScreen: {
    postscript:
      "psst  — This probably isn't what your app looks like. (Unless your designer handed you these screens, and in that case, ship it!)",
    readyForLaunch: "Your app, almost ready for launch!",
    exciting: "(ohh, this is exciting!)",
    letsGo: "Let's go!",
  },
  errorScreen: {
    title: "Something went wrong!",
    friendlySubtitle:
      "An error has occurred. You'll want to customize the layout as well (`app/screens/ErrorScreen`). If you want to remove this entirely, check `app/app.tsx` for the <ErrorBoundary> component.",
    reset: "RESET APP",
    traceTitle: "Error from %{name} stack",
  },
  emptyStateComponent: {
    generic: {
      heading: "So empty... so sad",
      content: "No data found yet. Try clicking the button to refresh or reload the app.",
      button: "Let's try this again",
    },
  },

  errors: {
    invalidEmail: "Invalid email address.",
  },
  loginScreen: {
    signIn: "Sign In",
    register: "Register",
    enterDetails:
      "Enter your details below to unlock top secret info. You'll never guess what we've got waiting. Or maybe you will; it's not rocket science here.",
    emailFieldLabel: "Email",
    passwordFieldLabel: "Password",
    emailFieldPlaceholder: "Enter your email address",
    passwordFieldPlaceholder: "Super secret password here",
    forgotPassword: "Forgot Password?",
    hint: "Hint: you can use any email address and your favorite password :)",
  },
  logoutScreen: {
    logoutButton: "Logout",
    logoutMessage: "Are you sure?",
  },
  registerScreen: {
    title: "Register",
    nameFieldLabel: "Name",
    emailFieldLabel: "Email",
    phoneFieldLabel: "Phone",
    passwordFieldLabel: "Password",
    goBack : "Go Back",
    confirmPasswordFieldLabel: "Confirm Password",
    organizationNameFieldLabel: "Orginization Name",
    nameFieldPlaceholder: "Enter your name",
    emailFieldPlaceholder: "Enter your email address",
    passwordFieldPlaceholder: "Enter your password",
    confirmPasswordFieldPlaceholder: "Confirm your password",
    phoneFieldPlaceholder: "(xxx)xxx-xxxx",
    organizationNameFieldPlaceholder: "Enter your Orginization's Name",
    organizationButton: "Organization",
    individualButton: "Individual"
  },
  requestResetScreen: {
    title: "Request Password Reset",
    emailFieldLabel: "Email",
    emailFieldPlaceholder: "Enter your email address",
    requestReset: "Request Reset",
  },
}

export default en
export type Translations = typeof en
