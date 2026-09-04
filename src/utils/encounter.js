export const ANIMALS_MAP = {
  corbeau: { id: "corbeau", name: "Corbeau", img: "/corbeau.png" },
  chouette: { id: "chouette", name: "Chouette", img: "/chouette.png" },
  renard: { id: "renard", name: "Renard", img: "/renard.png" },
  loup: { id: "loup", name: "Loup", img: "/loup.png" },
  panda: { id: "panda", name: "Panda", img: "/panda.png" },
  chat: { id: "chat", name: "Chat", img: "/chat.png" },
};

export const ANIMAL_THEME_MAP = {
  corbeau: 'jour',
  chouette: 'nuit',
  renard: 'feu',
  loup: 'neige',
  panda: 'panda',
  chat: 'chat',
};

// Global handler hook for imperative/standalone calls
let activeEncounterTrigger = null;

export const registerEncounterTrigger = (fn) => {
  activeEncounterTrigger = fn;
  return () => {
    if (activeEncounterTrigger === fn) {
      activeEncounterTrigger = null;
    }
  };
};

export const triggerAnimalEncounter = (animalId) => {
  if (typeof activeEncounterTrigger === 'function') {
    activeEncounterTrigger(animalId);
  } else {
    console.warn(`[triggerAnimalEncounter] No encounter handler registered to process '${animalId}'`);
  }
};
