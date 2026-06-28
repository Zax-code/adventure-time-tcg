const auth = {
  welcomeTo: "Bienvenue sur",
  gameTitle: "Adventure Time TCG",
  description:
    "Collectionne les cartes de tes personnages préférés, ouvre des packs, termine des quêtes et découvre de rares trésors du Pays de Ooo.",
  features: {
    openPacks: "Ouvrir des packs",
    collectCards: "Collectionner des cartes",
    completeQuests: "Terminer des quêtes",
  },
  tabs: {
    signIn: "Se connecter",
    register: "S'inscrire",
  },
  language: {
    label: "Langue",
  },
  fields: {
    email: "E-mail",
    password: "Mot de passe",
    passwordMin: "Mot de passe (8+ caractères)",
    newPassword: "Nouveau mot de passe (8+ caractères)",
    displayNameOptional: "Pseudo (optionnel)",
    verificationCode: "Code de vérification",
  },
  actions: {
    signIn: "Se connecter",
    register: "S'inscrire",
    verify: "Vérifier",
    forgotPassword: "Mot de passe oublié ?",
    sendResetLink: "Envoyer l'e-mail de réinitialisation",
    resetPassword: "Mettre à jour le mot de passe",
    resendCode: "Renvoyer le code",
    resendResetEmail: "Envoyer un autre e-mail de réinitialisation",
    useDifferentEmail: "Utiliser un autre e-mail",
    backToSignIn: "Retour à la connexion",
    orContinueWithApple: "ou continuer avec Apple",
    orContinueWithGoogle: "ou continuer avec Google",
    enterCandyKingdom: "Entrer dans le Royaume des Bonbons",
  },
  labels: {
    madeWithLoveBy: "Fait avec amour par Zak",
  },
  status: {
    verificationCodeSentCheckEmail: "Code de vérification envoyé. Vérifie ton e-mail.",
    verificationCodeSentAccessRequested:
      "Code envoyé. La demande d'accès a été envoyée automatiquement.",
    deepLinkReady: "Les informations de vérification sont remplies. Confirme quand tu veux.",
    deepLinkVerifying: "Confirmation de ton e-mail en cours...",
    deepLinkResetReady:
      "Les informations de réinitialisation sont remplies. Entre ton nouveau mot de passe quand tu veux.",
    verifyTitle: "Vérifie ton e-mail",
    verifyBody:
      "Entre le code à 6 chiffres envoyé par e-mail, ou utilise le lien de confirmation dans l'e-mail pour revenir ici avec tout déjà rempli.",
    resetRequestTitle: "Réinitialise ton mot de passe",
    resetRequestBody:
      "Entre ton e-mail et on enverra un code à 6 chiffres si ce compte peut bien réinitialiser son mot de passe.",
    resetReadyTitle: "Vérifie ton e-mail de réinitialisation",
    resetReadyBody:
      "Entre le code à 6 chiffres reçu par e-mail, puis choisis un nouveau mot de passe. Tu peux aussi utiliser le lien de réinitialisation dans l'e-mail.",
    resetLinkSentCheckEmail:
      "Si cet e-mail correspond à un compte, un code de réinitialisation a été envoyé.",
    passwordResetSuccess:
      "Mot de passe mis à jour. Connecte-toi avec ton nouveau mot de passe quand tu veux.",
    emailVerifiedCanSignIn: "E-mail vérifié. Tu peux maintenant te connecter.",
    emailVerifiedPendingApproval:
      "E-mail vérifié et compte créé. Ta demande d'accès est en attente de validation par un super admin.",
    pendingApprovalTitle: "Tu y es presque",
    pendingApprovalBody:
      "Ton e-mail est confirmé et ton compte attend encore l'approbation d'un super admin. Une fois approuvé, reviens ici et connecte-toi avec le même e-mail et mot de passe.",
    pendingApprovalFootnote:
      "Tu pourras revenir à la connexion quand l'accès sera approuvé.",
    newVerificationCodeSent: "Un nouveau code de vérification a été envoyé.",
    newResetCodeSent:
      "Si cet e-mail correspond à un compte, un autre code de réinitialisation a été envoyé.",
    googlePendingApproval:
      "Ce compte Google est en attente d'approbation. Ta demande d'accès a été envoyée.",
    googleNotConfigured:
      "La connexion Google n'est pas encore configurée pour cet environnement de l'application.",
    googleLoading:
      "La connexion Google est encore en cours de chargement. Réessaie.",
    completingGoogleSignIn: "Finalisation de la connexion Google...",
  },
  errors: {
    failed: "Échec de l'authentification",
    invalidEmail: "Entre une adresse e-mail valide.",
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères.",
    verificationCodeInvalid: "Entre le code à 6 chiffres reçu par e-mail.",
    displayNameInvalid: "Le pseudo doit contenir entre 1 et 64 caractères.",
    googleTokenMissing:
      "La connexion Google ne s'est pas terminée correctement. Réessaie.",
    networkFallback: "Impossible de joindre le serveur. Réessaie.",
    networkTitle: "Impossible de se connecter au serveur du jeu.",
    networkBody:
      "Tes informations de connexion sont toujours là. Cela veut souvent dire que la connexion a coupé un instant ou que le serveur a besoin d'une nouvelle tentative.",
    networkDetail: "Actualise cette étape quand la connexion est revenue.",
    networkAction: "Actualiser et réessayer",
  },
};

export default auth;
