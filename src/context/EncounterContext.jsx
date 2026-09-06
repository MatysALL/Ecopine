import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useDb } from '../db';
import { ANIMALS_MAP, ANIMAL_THEME_MAP, registerEncounterTrigger, triggerAnimalEncounter } from '../utils/encounter';
import { DEFAULT_TOTEMS, TOTEM_CONFIG, checkAlphabeticalWishes } from '../utils/totems';

export { ANIMALS_MAP, ANIMAL_THEME_MAP, triggerAnimalEncounter };

const EncounterContext = createContext(null);

export const EncounterProvider = ({ children }) => {
  const [activeEncounter, setActiveEncounter] = useState(null);
  const [activeTotemDialogue, setActiveTotemDialogue] = useState(null);
  const [totemToast, setTotemToast] = useState(null);

  const {
    user,
    username,
    userMeta,
    usersMetaDoc,
    unlockedAvatars,
    unlockedThemes,
    totems,
    updateTotem,
    unlockTotemReward,
    wishlist,
    projects
  } = useDb();

  const showTotemToast = useCallback((message, type = 'info') => {
    setTotemToast({ message, type });
    setTimeout(() => {
      setTotemToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  const handleTriggerAnimalEncounter = useCallback((animalId) => {
    // Si l'utilisateur ou ses métadonnées ne sont pas encore chargés, on arrête pour éviter toute race condition
    const meta = usersMetaDoc || (userMeta && Array.isArray(userMeta) ? null : userMeta);
    if (!meta && !totems) return;

    const unlockedAv = Array.isArray(usersMetaDoc?.unlockedAvatars)
      ? usersMetaDoc.unlockedAvatars
      : (Array.isArray(unlockedAvatars)
        ? unlockedAvatars
        : (Array.isArray(userMeta)
          ? (userMeta.find(m => m.key === 'unlocked_avatars')?.value || [])
          : []));

    const isAvatarUnlocked = unlockedAv.includes(animalId) || unlockedAv.includes(`/${animalId}.png`);
    const isBadgeUnlocked = (totems?.[animalId]?.badgeUnlocked === true) || (usersMetaDoc?.totems?.[animalId]?.badgeUnlocked === true);
    const isCompleted = (totems?.[animalId]?.completed === true) || (usersMetaDoc?.totems?.[animalId]?.completed === true);

    // Si le badge est déjà débloqué ou la quête finie, ne JAMAIS réafficher la pop-up
    if (isAvatarUnlocked || isBadgeUnlocked || isCompleted) {
      return;
    }

    if (ANIMALS_MAP[animalId]) {
      setActiveEncounter(ANIMALS_MAP[animalId]);
    }
  }, [usersMetaDoc, userMeta, unlockedAvatars, totems]);

  useEffect(() => {
    const unregister = registerEncounterTrigger(handleTriggerAnimalEncounter);
    return unregister;
  }, [handleTriggerAnimalEncounter]);

  const confirmDiscovery = useCallback(async (animalId) => {
    if (!animalId) return;
    try {
      await updateTotem(animalId, { badgeUnlocked: true });
    } catch (err) {
      console.error("Erreur lors du déblocage du badge totem :", err);
    }
    setActiveEncounter(null);
  }, [updateTotem]);

  // Handle badge click on the UI
  const handleBadgeClick = useCallback(async (totemId) => {
    const currentHour = new Date().getHours();
    const totemState = totems?.[totemId] || DEFAULT_TOTEMS[totemId];

    // Corbeau time constraints: inactive between 23h00 and 6h00
    if (totemId === 'corbeau') {
      if (currentHour >= 23 || currentHour < 6) {
        showTotemToast("Le Corbeau dort profondément...", "info");
        return;
      }

      // Daytime 5 consecutive clicks check to wake up Chouette (if Chouette is unlocked and not completed)
      const chouetteState = totems?.chouette || DEFAULT_TOTEMS.chouette;
      if (chouetteState?.badgeUnlocked && !chouetteState?.completed) {
        const nextCount = (chouetteState.clickCount || 0) + 1;
        if (nextCount >= 5) {
          await updateTotem('chouette', { clickCount: 0 });
          setActiveTotemDialogue({
            totemId: 'chouette',
            phase: 'chouette_awakening'
          });
          return;
        } else {
          await updateTotem('chouette', { clickCount: nextCount });
        }
      }
    }

    // Chouette time constraints: inactive between 6h00 and 23h00
    if (totemId === 'chouette') {
      if (currentHour >= 6 && currentHour < 23) {
        showTotemToast("La Chouette ne sort que la nuit...", "info");
        return;
      }
    }

    // When a totem is completed: true, its click does not reopen the modal
    if (totemState.completed) {
      return;
    }

    // STEP 2: First click on badge (if step === 0)
    if (totemState.step === 0) {
      setActiveTotemDialogue({
        totemId,
        phase: 'greeting'
      });
      return;
    }

    // STEP 3: Riddle in progress / resolution check
    if (totemId === 'corbeau') {
      setActiveTotemDialogue({
        totemId: 'corbeau',
        phase: 'riddle'
      });
    } else if (totemId === 'chouette') {
      setActiveTotemDialogue({
        totemId: 'chouette',
        phase: 'riddle'
      });
    } else if (totemId === 'renard') {
      if (!totemState.projectWishesDone) {
        // Detection 1: Check personal wishes
        const personalWishes = (wishlist || []).filter(w => !w.projectId && !w.isCompleted);
        const isAlphabetical = checkAlphabeticalWishes(personalWishes);
        if (isAlphabetical) {
          setActiveTotemDialogue({
            totemId: 'renard',
            phase: 'renard_step1_done'
          });
        } else {
          setActiveTotemDialogue({
            totemId: 'renard',
            phase: 'riddle_step1'
          });
        }
      } else {
        // Detection 2: Check project wishes
        let hasProjectAlpha = false;
        if (projects && projects.length > 0) {
          for (const p of projects) {
            const projWishes = (wishlist || []).filter(w => w.projectId === p.id && !w.isCompleted);
            if (checkAlphabeticalWishes(projWishes)) {
              hasProjectAlpha = true;
              break;
            }
          }
        }
        if (hasProjectAlpha) {
          setActiveTotemDialogue({
            totemId: 'renard',
            phase: 'renard_step2_done'
          });
        } else {
          setActiveTotemDialogue({
            totemId: 'renard',
            phase: 'riddle_step2'
          });
        }
      }
    } else if (totemId === 'loup') {
      if (!totemState.requestedOnce) {
        setActiveTotemDialogue({
          totemId: 'loup',
          phase: 'riddle'
        });
      } else if (totemState.requestedOnce && !totemState.redlisted) {
        setActiveTotemDialogue({
          totemId: 'loup',
          phase: 'loup_step1_done'
        });
      } else if (totemState.redlisted) {
        setActiveTotemDialogue({
          totemId: 'loup',
          phase: 'loup_step2_done'
        });
      }
    } else if (totemId === 'chat') {
      if (!totemState.debtDeleted) {
        setActiveTotemDialogue({
          totemId: 'chat',
          phase: 'riddle'
        });
      } else {
        setActiveTotemDialogue({
          totemId: 'chat',
          phase: 'chat_step1_done'
        });
      }
    } else if (totemId === 'panda') {
      if (!totemState.avatarToggled) {
        setActiveTotemDialogue({
          totemId: 'panda',
          phase: 'riddle_step1'
        });
      } else {
        const cleanName = (username || '').trim().toLowerCase();
        if (cleanName === 'ce champs') {
          setActiveTotemDialogue({
            totemId: 'panda',
            phase: 'panda_step2_done'
          });
        } else {
          setActiveTotemDialogue({
            totemId: 'panda',
            phase: 'panda_step1_done'
          });
        }
      }
    }
  }, [totems, showTotemToast, updateTotem, wishlist, projects, username]);

  // Corbeau Calendar Click handler on 10 June 2026
  const handleCorbeauCalendarClick = useCallback(() => {
    setActiveTotemDialogue({
      totemId: 'corbeau',
      phase: 'corbeau_resolution'
    });
  }, []);

  const closeTotemDialogue = useCallback(() => {
    setActiveTotemDialogue(null);
  }, []);

  // Accept riddle in step 2 -> step = 1
  const acceptRiddle = useCallback(async (totemId) => {
    try {
      await updateTotem(totemId, { step: 1 });
      // Re-trigger badge click or keep dialogue open to view riddle
      setActiveTotemDialogue(prev => {
        if (!prev) return null;
        if (totemId === 'renard') return { ...prev, phase: 'riddle_step1' };
        if (totemId === 'panda') return { ...prev, phase: 'riddle_step1' };
        return { ...prev, phase: 'riddle' };
      });
    } catch (err) {
      console.error("Erreur lors de l'acceptation de l'énigme :", err);
    }
  }, [updateTotem]);

  // Resolve Totem: unlocks avatar and theme, sets completed = true
  const finalizeResolution = useCallback(async (totemId) => {
    try {
      const config = TOTEM_CONFIG[totemId];
      await unlockTotemReward(totemId, config?.theme);
      showTotemToast("Nouveau thème et avatar débloqués ! 🎉", "celebration");
      setActiveTotemDialogue(null);
    } catch (err) {
      console.error("Erreur lors de la résolution du totem :", err);
    }
  }, [unlockTotemReward, showTotemToast]);

  const value = {
    activeEncounter,
    setActiveEncounter,
    confirmDiscovery,
    activeTotemDialogue,
    setActiveTotemDialogue,
    closeTotemDialogue,
    totemToast,
    showTotemToast,
    totems: totems || DEFAULT_TOTEMS,
    updateTotem,
    handleBadgeClick,
    handleCorbeauCalendarClick,
    acceptRiddle,
    finalizeResolution
  };

  return (
    <EncounterContext.Provider value={value}>
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
      confirmDiscovery: () => {},
      activeTotemDialogue: null,
      setActiveTotemDialogue: () => {},
      closeTotemDialogue: () => {},
      totemToast: null,
      showTotemToast: () => {},
      totems: DEFAULT_TOTEMS,
      updateTotem: () => {},
      handleBadgeClick: () => {},
      handleCorbeauCalendarClick: () => {},
      acceptRiddle: () => {},
      finalizeResolution: () => {}
    };
  }
  return ctx;
};
