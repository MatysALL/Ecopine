export const DEFAULT_TOTEMS = {
  corbeau: { badgeUnlocked: false, step: 0, completed: false },
  chouette: { badgeUnlocked: false, step: 0, completed: false, clickCount: 0 },
  renard: { badgeUnlocked: false, step: 0, completed: false, projectWishesDone: false },
  loup: { badgeUnlocked: false, step: 0, completed: false, requestedOnce: false, redlisted: false },
  chat: { badgeUnlocked: false, step: 0, completed: false, debtDeleted: false },
  panda: { badgeUnlocked: false, step: 0, completed: false, avatarToggled: false }
};

export const TOTEM_CONFIG = {
  corbeau: {
    id: 'corbeau',
    name: 'Corbeau',
    totemName: 'Wayfs',
    img: '/corbeau.png',
    theme: 'jour',
    greeting: "Salutations voyageur des chiffres. Le vent m'a porté jusqu'à ta trésorerie.",
    riddle: "Trouve le repère temporel où notre monde a pris vie."
  },
  chouette: {
    id: 'chouette',
    name: 'Chouette',
    totemName: 'Wayfs',
    img: '/chouette.png',
    theme: 'nuit',
    greeting: "Hou hou... Tu veilles bien tard dans l'obscurité budgétaire.",
    riddle: "Réveille mon alter-ego lorsque le soleil éclaire la ville en plein jour..."
  },
  renard: {
    id: 'renard',
    name: 'Renard',
    totemName: 'Saloquin',
    img: '/renard.png',
    theme: 'feu',
    greeting: "Hé hé ! Un petit curieux qui aime entasser de beaux désirs sans compter ?",
    riddleStep1: "Présente-moi au moins 6 de tes souhaits les plus chers, soigneusement décrits et ordonnés de A à Z.",
    riddleStep2: "Présente-moi 6 souhaits impeccablement structurés et alphabétiques au sein d'un Projet !"
  },
  loup: {
    id: 'loup',
    name: 'Loup',
    totemName: 'Nordlys',
    img: '/loup.png',
    theme: 'neige',
    greeting: "Grrr... Qui ose approcher mon territoire sans montrer patte blanche ?",
    riddle: "Il paraît qu'une liste rouge existe dans ce village... Trouve comment m'y consigner."
  },
  chat: {
    id: 'chat',
    name: 'Chat',
    totemName: 'Chouquette',
    img: '/chat.png',
    theme: 'chat',
    greeting: "Miaou ! Tu regardes tes sous ou tu viens m'apporter des friandises ?",
    riddle: "Les dettes n'ont de dette que le nom ! Si tu veux mon avis, une dette disparaît dès qu'on appuie sur une croix. Efface donc ce fardeau !"
  },
  panda: {
    id: 'panda',
    name: 'Panda',
    totemName: 'ToT',
    img: '/panda.png',
    theme: 'panda',
    greeting: "Bonjour... Tout est tellement bruyant ici, respirons un peu dans le calme.",
    riddleStep1: "Éprouve la superficialité des apparences, puis reviens à la source.",
    riddleStep2: "Définis ton identité par ce que le système exige sans oser le nommer."
  }
};

/**
 * Checks if a list of wishes has at least 6 wishes with non-empty descriptions
 * and sorted in alphabetical order by their title/name.
 */
export const checkAlphabeticalWishes = (wishesList) => {
  if (!Array.isArray(wishesList)) return false;

  // Filter wishes that have a non-empty description
  const describedWishes = wishesList.filter(w => {
    const desc = (w.description || w.desc || '').trim();
    const title = (w.name || w.title || '').trim();
    return desc.length > 0 && title.length > 0;
  });

  if (describedWishes.length < 6) return false;

  // Check if they are ordered alphabetically from A to Z
  for (let i = 1; i < describedWishes.length; i++) {
    const prevTitle = (describedWishes[i - 1].name || describedWishes[i - 1].title || '').trim();
    const currTitle = (describedWishes[i].name || describedWishes[i].title || '').trim();
    if (currTitle.localeCompare(prevTitle, 'fr', { sensitivity: 'base' }) < 0) {
      return false;
    }
  }

  return true;
};
