const common = {
  loading: "Chargement...",
  goBack: "Retour",
  cancel: "Annuler",
  clear: "Effacer",
  close: "Fermer",
  delete: "Supprimer",
  launch: {
    eyebrow: "Adventure Time TCG",
    title: "Le deck se prépare",
    subtitle:
      "Nous remettons en place tes cartes, tes couleurs et les portes du royaume avant l'aventure.",
    preparing: "Préparation de l'aventure...",
    restoring: "Réconnexion au Royaume des Bonbons...",
    errorTitle: "L'app n'a pas pu déverrouiller ta session enregistrée.",
    errorBody:
      "L'écran de démarrage a été libéré, mais tes informations de connexion ne sont pas encore disponibles.",
    errorTimeoutDetail:
      "La vérification du stockage sécurisé a pris trop de temps. Réessaie maintenant.",
    errorRejectedDetail:
      "La vérification du stockage sécurisé a temporairement échoué. Réessaie maintenant.",
    retry: "Relancer le démarrage",
  },
  loadingStates: {
    pageBody: "Un instant pendant que nous préparons cet écran.",
    sectionBody: "Les derniers détails arrivent.",
    battleBody:
      "Nous mettons en place le plateau et synchronisons l'ordre du tour.",
    rosterBody: "Nous vérifions les derniers joueurs et leurs compositions.",
    adminBody:
      "Nous rassemblons les derniers outils et données pour cet espace.",
  },
  errorStates: {
    network: {
      eyebrow: "Connexion interrompue",
      title: "Impossible de joindre le serveur du jeu pour le moment.",
      body: "Ta progression est en sécurité. Cela veut souvent dire que la connexion a coupé un instant ou que le serveur a besoin d'une nouvelle tentative.",
      detail: "Actualise cet écran quand la connexion est revenue.",
      action: "Actualiser l'écran",
    },
    generic: {
      eyebrow: "Petit contretemps",
      title: "Cet écran ne s'est pas chargé correctement.",
      body: "Demande une nouvelle tentative et nous irons chercher une version propre.",
      detail: "Si cela continue, reviens dans un instant.",
      action: "Réessayer",
    },
    technicalLabel: "Détails techniques",
    backAction: "Retour",
  },
};

export default common;
