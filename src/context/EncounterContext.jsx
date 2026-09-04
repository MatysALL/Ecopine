import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useDb } from '../db';
import { ANIMALS_MAP, ANIMAL_THEME_MAP, registerEncounterTrigger, triggerAnimalEncounter } from '../utils/encounter';

export { ANIMALS_MAP, ANIMAL_THEME_MAP, triggerAnimalEncounter };

const EncounterContext = createContext(null);

export const EncounterProvider = ({ children }) => {
  const [activeEncounter, setActiveEncounter] = useState(null);
  const { userMeta, unlockedAvatars, unlockedThemes } = useDb();

  const handleTriggerAnimalEncounter = useCallback((animalId) => {
    // 1. Vérifier si l'animal n'est pas déjà possédé par l'utilisateur
    const unlockedAv = Array.isArray(unlockedAvatars)
      ? unlockedAvatars
      : (Array.isArray(userMeta?.unlockedAvatars)
        ? userMeta.unlockedAvatars
        : (userMeta?.find?.(m => m.key === 'unlocked_avatars')?.value || []));

    const unlockedTh = Array.isArray(unlockedThemes)
      ? unlockedThemes
      : (Array.isArray(userMeta?.unlockedThemes)
        ? userMeta.unlockedThemes
        : (userMeta?.find?.(m => m.key === 'unlocked_themes')?.value || []));

    const alreadyUnlocked =
      unlockedAv.includes(animalId) ||
      unlockedAv.includes(`/${animalId}.png`) ||
      unlockedTh.includes(animalId) ||
      (ANIMAL_THEME_MAP[animalId] && unlockedTh.includes(ANIMAL_THEME_MAP[animalId]));

    if (alreadyUnlocked) {
      return;
    }

    if (ANIMALS_MAP[animalId]) {
      setActiveEncounter(ANIMALS_MAP[animalId]);
    }
  }, [userMeta, unlockedAvatars, unlockedThemes]);

  useEffect(() => {
    const unregister = registerEncounterTrigger(handleTriggerAnimalEncounter);
    return unregister;
  }, [handleTriggerAnimalEncounter]);

  return (
    <EncounterContext.Provider value={{ activeEncounter, setActiveEncounter, triggerAnimalEncounter: handleTriggerAnimalEncounter }}>
      {children}
    </EncounterContext.Provider>
  );
};

export const useEncounter = () => {
  const ctx = useContext(EncounterContext);
  if (!ctx) {
    return {
      activeEncounter: null,
      setActiveEncounter: () => {},
      triggerAnimalEncounter
    };
  }
  return ctx;
};
