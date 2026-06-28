const auth = {
  welcomeTo: "Welcome to",
  gameTitle: "Adventure Time TCG",
  description:
    "Collect cards of your favorite characters, open packs, complete quests, and discover rare treasures from the Land of Ooo.",
  features: {
    openPacks: "Open Packs",
    collectCards: "Collect Cards",
    completeQuests: "Complete Quests",
  },
  tabs: {
    signIn: "Sign in",
    register: "Register",
  },
  language: {
    label: "Language",
  },
  fields: {
    email: "Email",
    password: "Password",
    passwordMin: "Password (8+ characters)",
    newPassword: "New password (8+ characters)",
    displayNameOptional: "Display name (optional)",
    verificationCode: "Verification code",
  },
  actions: {
    signIn: "Sign in",
    register: "Register",
    verify: "Verify",
    forgotPassword: "Forgot password?",
    sendResetLink: "Send reset email",
    resetPassword: "Update password",
    resendCode: "Resend code",
    resendResetEmail: "Send another reset email",
    useDifferentEmail: "Use a different email",
    backToSignIn: "Back to sign in",
    continueWithApple: "Continue with Apple",
    continueWithGoogle: "Continue with Google",
  },
  labels: {
    madeWithLoveBy: "Made with love by Zak",
  },
  status: {
    verificationCodeSentCheckEmail: "Verification code sent. Check your email.",
    verificationCodeSentAccessRequested:
      "Verification code sent. Access request submitted automatically.",
    deepLinkReady: "Verification details filled in. Confirm when you're ready.",
    deepLinkVerifying: "Finishing your email confirmation...",
    deepLinkResetReady:
      "Reset details are filled in. Enter your new password when you're ready.",
    verifyTitle: "Check your email",
    verifyBody:
      "Enter the 6-digit code we sent you, or use the confirmation page link in the email to come back here with everything filled in.",
    resetRequestTitle: "Reset your password",
    resetRequestBody:
      "Enter your email and we'll send a 6-digit reset code if this account is ready for password reset.",
    resetReadyTitle: "Check your reset email",
    resetReadyBody:
      "Enter the 6-digit reset code from your email, then choose a new password. You can also use the reset page link from the email.",
    resetLinkSentCheckEmail:
      "If this email matches an account, a password reset code has been sent.",
    passwordResetSuccess:
      "Password updated. Sign in with your new password when you're ready.",
    emailVerifiedCanSignIn: "Email verified. You can now sign in.",
    emailVerifiedPendingApproval:
      "Email verified and account created. Your access request is pending super admin approval.",
    applePendingApproval:
      "This Apple account is pending approval. Your access request has been submitted.",
    googlePendingApproval:
      "This Google account is pending approval. Your access request has been submitted.",
    pendingApprovalTitle: "You're almost in",
    pendingApprovalBodyEmail:
      "Your email is confirmed and your account is waiting for super admin approval. Once approved, come back here and sign in with the same email and password.",
    pendingApprovalBodyGoogle:
      "Your Google account is waiting for super admin approval. Once approved, come back here and continue with Google again.",
    pendingApprovalBodyApple:
      "Your Apple account is waiting for super admin approval. Once approved, come back here and continue with Apple again.",
    pendingApprovalFootnoteEmail:
      "You can return to sign in when access has been approved.",
    pendingApprovalFootnoteGoogle:
      "You can continue with Google when access has been approved.",
    pendingApprovalFootnoteApple:
      "You can continue with Apple when access has been approved.",
    newVerificationCodeSent: "A new verification code was sent.",
    newResetCodeSent:
      "If this email matches an account, another reset code has been sent.",
    googleNotConfigured:
      "Google sign-in is not configured for this app environment yet.",
    googleLoading: "Google sign-in is still loading. Please try again.",
    completingGoogleSignIn: "Finishing Google sign-in...",
  },
  errors: {
    failed: "Authentication failed",
    invalidEmail: "Enter a valid email address.",
    passwordTooShort: "Password must be at least 8 characters.",
    verificationCodeInvalid: "Enter the 6-digit code from your email.",
    displayNameInvalid: "Display name must be between 1 and 64 characters.",
    googleTokenMissing: "Google sign-in did not finish correctly. Please try again.",
    networkFallback: "We couldn't reach the server. Please try again.",
    networkTitle: "We couldn't connect to the game server.",
    networkBody:
      "Your sign-in details are still here. This usually means your connection dropped for a moment or the server needs another try.",
    networkDetail: "Refresh this step once your connection is back.",
    networkAction: "Refresh and try again",
  },
};

export default auth;
