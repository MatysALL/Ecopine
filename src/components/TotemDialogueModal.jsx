import React, { useState, useEffect } from 'react';
import { useEncounter } from '../context/EncounterContext';
import { useDb } from '../db';
import { TOTEM_CONFIG } from '../utils/totems';
import { X, Sparkles, MessageCircle, HeartHandshake, HelpCircle } from 'lucide-react';

export default function TotemDialogueModal() {
  const {
    activeTotemDialogue,
    closeTotemDialogue,
    acceptRiddle,
    finalizeResolution,
    updateTotem
  } = useEncounter();

  const { username, user } = useDb();
  const displayName = username || user?.displayName || 'Habitant';

  // Sub-step states for multi-turn dialogues inside the modal
  const [dialogueStep, setDialogueStep] = useState(0); 
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformedImg, setTransformedImg] = useState(null);
  const [finalFriendship, setFinalFriendship] = useState(false);

  useEffect(() => {
    setDialogueStep(0);
    setIsTransforming(false);
    setTransformedImg(null);
    setFinalFriendship(false);
  }, [activeTotemDialogue]);

  if (!activeTotemDialogue) return null;

  const { totemId, phase } = activeTotemDialogue;
  const config = TOTEM_CONFIG[totemId] || {
    id: totemId,
    name: totemId,
    totemName: totemId,
    img: `/${totemId}.png`
  };

  const handleAllonsY = async () => {
    await acceptRiddle(totemId);
  };

  const handleFinalize = async () => {
    await finalizeResolution(totemId);
  };

  // Render header info
  const renderHeader = (customTitle, customTotemName) => (
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
      <div className="flex items-center gap-2">
        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
          Totem
        </span>
        <h3 className="text-lg font-black text-white">
          {customTitle || config.name} <span className="text-emerald-400 font-extrabold">({customTotemName || config.totemName})</span>
        </h3>
      </div>
      <button
        onClick={closeTotemDialogue}
        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
        title="Fermer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  // Render Final Friendship screen
  if (finalFriendship) {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-emerald-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 bg-emerald-400/30 rounded-full blur-3xl pointer-events-none"></div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-black tracking-wide uppercase mb-6 shadow-xs">
            <HeartHandshake className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>Amitié Totémique Scellée</span>
          </div>

          <div className="relative mx-auto w-32 h-32 mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-400/25 blur-xl animate-pulse"></div>
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-emerald-500/40 via-white/10 to-teal-400/30 border-2 border-emerald-300/60 shadow-inner flex items-center justify-center overflow-hidden">
              <img 
                src={transformedImg || config.img} 
                alt={config.name} 
                className="w-24 h-24 object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] animate-bounce"
              />
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-3">
            « Soyons amis, <span className="text-emerald-400 underline decoration-emerald-500/40">{displayName}</span> »
          </h2>

          <p className="text-xs sm:text-sm text-emerald-100/80 mb-6 font-medium leading-relaxed">
            Un nouveau lien indéfectible vient de s'établir. Tu as débloqué l'avatar et le thème associé !
          </p>

          <button
            type="button"
            onClick={handleFinalize}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-200/40"
          >
            Merveilleux ! ✨
          </button>
        </div>
      </div>
    );
  }

  // STEP 2 : Greeting dialogue (when step === 0)
  if (phase === 'greeting') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-emerald-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          {/* Mascot portrait */}
          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-emerald-500/20 via-white/10 to-teal-400/20 border-2 border-emerald-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img 
                src={config.img} 
                alt={config.name} 
                className="w-20 h-20 object-contain filter drop-shadow-md"
              />
            </div>
          </div>

          {/* Dialogue bubble */}
          {dialogueStep === 0 ? (
            <div className="space-y-6">
              <div className="bg-white/10 border border-white/15 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
                <p className="text-sm sm:text-base font-semibold text-emerald-100 leading-relaxed italic">
                  « {config.greeting} »
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDialogueStep(1)}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-200/40"
              >
                Suivant
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white/10 border border-white/15 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
                <p className="text-sm sm:text-base font-semibold text-emerald-100 leading-relaxed italic">
                  « J'ai une énigme pour toi, si tu la réussis nous deviendrons amis. »
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeTotemDialogue}
                  className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer"
                >
                  Plus tard
                </button>
                <button
                  type="button"
                  onClick={handleAllonsY}
                  className="flex-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-200/40"
                >
                  Allons-y !
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 3: Chouette Awakening from Corbeau click (5 clicks daytime)
  if (phase === 'chouette_awakening') {
    const isChouetteTransformed = isTransforming || dialogueStep >= 1;

    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-amber-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader(isChouetteTransformed ? "Chouette" : "Corbeau", "Wayfs")}

          {/* Mascot portrait with transition effect */}
          <div className="relative mx-auto w-32 h-32 mb-6">
            <div className={`absolute inset-0 rounded-full ${isChouetteTransformed ? 'bg-indigo-500/30' : 'bg-amber-500/30'} blur-xl animate-pulse`}></div>
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-white/10 via-white/5 to-white/10 border-2 border-white/30 flex items-center justify-center overflow-hidden shadow-lg">
              <img 
                src={isChouetteTransformed ? "/chouette.png" : "/corbeau.png"} 
                alt="Wayfs" 
                className={`w-24 h-24 object-contain transition-all duration-700 ${isChouetteTransformed ? 'scale-100 rotate-0 filter drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]' : 'scale-105 rotate-3 filter drop-shadow-md'}`}
              />
            </div>
          </div>

          {dialogueStep === 0 ? (
            <div className="space-y-6">
              <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
                <p className="text-sm sm:text-base font-semibold text-amber-200 leading-relaxed italic">
                  « Mais qui ose me secouer en plein jour ?! Pour quelle raison me réveilles-tu ? »
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsTransforming(true);
                  setDialogueStep(1);
                  setTransformedImg('/chouette.png');
                }}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-amber-200/40"
              >
                C'est la chouette qui m'a demandé... je crois
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
                <p className="text-xs sm:text-sm font-semibold text-indigo-200 leading-relaxed italic">
                  « Ce n'est rien... En réalité, le Corbeau et la Chouette ne font qu'un. Le possesseur des totems alterne simplement ses formes pour exploiter au mieux ses capacités intellectuelles selon le jour et la nuit. »
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFinalFriendship(true)}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-400 to-teal-400 hover:from-indigo-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-indigo-200/40"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 3: Corbeau resolution (10 Juin 2026 Calendar click)
  if (phase === 'corbeau_resolution') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-emerald-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-emerald-500/20 via-white/10 to-teal-400/20 border-2 border-emerald-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img 
                src="/corbeau.png" 
                alt="Corbeau" 
                className="w-20 h-20 object-contain filter drop-shadow-md"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/10 border border-white/15 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
              <p className="text-sm sm:text-base font-semibold text-emerald-100 leading-relaxed italic">
                « Le 10 Juin 2026... C'est le jour précis où Ecopine a déployé ses premières ailes dans le cloud ! »
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFinalFriendship(true)}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-200/40"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Renard Step 1 Completed (6 wishes A-Z in Wishlist)
  if (phase === 'renard_step1_done') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-amber-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-amber-500/20 via-white/10 to-orange-400/20 border-2 border-amber-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img src="/renard.png" alt="Renard" className="w-20 h-20 object-contain filter drop-shadow-md" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
              <p className="text-sm sm:text-base font-semibold text-amber-200 leading-relaxed italic">
                « Pas mal ! Mais ce que je voulais vraiment, c'est 6 souhaits impeccablement structurés et alphabétiques au sein d'un Projet ! »
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                await updateTotem('renard', { projectWishesDone: true });
                closeTotemDialogue();
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-amber-200/40"
            >
              Compris ! Au travail !
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Renard Step 2 Completed (6 wishes A-Z in Project)
  if (phase === 'renard_step2_done') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-amber-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-amber-500/20 via-white/10 to-orange-400/20 border-2 border-amber-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img src="/renard.png" alt="Renard" className="w-20 h-20 object-contain filter drop-shadow-md animate-bounce" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
              <p className="text-sm sm:text-base font-semibold text-amber-200 leading-relaxed italic">
                « Ahahah ! Tu t'es vraiment donné tout ce mal ? Pour être franc, entasser des dizaines de souhaits est absurde : seul un souhait sur quatre mérite qu'on s'y attarde ! »
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFinalFriendship(true)}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-amber-200/40"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Loup Step 1 Done (Requested once)
  if (phase === 'loup_step1_done') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-sky-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-sky-500/20 via-white/10 to-blue-400/20 border-2 border-sky-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img src="/loup.png" alt="Loup" className="w-20 h-20 object-contain filter drop-shadow-md" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-sky-950/40 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
              <p className="text-sm sm:text-base font-semibold text-sky-200 leading-relaxed italic">
                « Tu as mordu à l'hameçon ! C'est moi qui t'ai placé sur ma liste rouge. Essaie encore pour voir ? »
              </p>
            </div>

            <button
              type="button"
              onClick={closeTotemDialogue}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-400 hover:from-sky-300 hover:to-blue-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-sky-200/40"
            >
              Je retente !
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Loup Step 2 Done (Redlisted)
  if (phase === 'loup_step2_done') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-sky-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-sky-500/20 via-white/10 to-blue-400/20 border-2 border-sky-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img src="/loup.png" alt="Loup" className="w-20 h-20 object-contain filter drop-shadow-md" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-sky-950/40 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
              <p className="text-sm sm:text-base font-semibold text-sky-200 leading-relaxed italic">
                « Te voilà bien marri de ne pas pouvoir m'approcher ! Malgré mon penchant pour la solitude, je parcours les horizons glacés en quête d'alliés fidèles. »
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFinalFriendship(true)}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-400 hover:from-sky-300 hover:to-blue-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-sky-200/40"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Chat Resolution (Debt deleted/settled)
  if (phase === 'chat_step1_done') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-rose-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-rose-500/20 via-white/10 to-pink-400/20 border-2 border-rose-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img src="/chat.png" alt="Chat" className="w-20 h-20 object-contain filter drop-shadow-md" />
            </div>
          </div>

          {dialogueStep === 0 ? (
            <div className="space-y-6">
              <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
                <p className="text-sm sm:text-base font-semibold text-rose-200 leading-relaxed italic">
                  « Ahahah, tu vois ! Pas si compliqué d'effacer une ardoise ! »
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDialogueStep(1)}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-400 hover:from-rose-300 hover:to-pink-300 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-rose-200/40"
              >
                Mais la dette existe toujours même si on ne la voit plus
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
                <p className="text-sm sm:text-base font-semibold text-rose-200 leading-relaxed italic">
                  « QUOIIII ?!! Mais... Maissssss... Miaou ! Bon, d'accord, je m'en fiche complètement ! Mahahahha ! »
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFinalFriendship(true)}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-400 hover:from-rose-300 hover:to-pink-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-rose-200/40"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 3: Panda Step 1 Done (Avatar toggled back to utilisateur)
  if (phase === 'panda_step1_done') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-emerald-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-emerald-500/20 via-white/10 to-teal-400/20 border-2 border-emerald-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img src="/panda.png" alt="Panda" className="w-20 h-20 object-contain filter drop-shadow-md" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
              <p className="text-sm sm:text-base font-semibold text-emerald-200 leading-relaxed italic">
                « Tu as compris : la simplicité est la clé de toute sérénité. Mais voici mon ultime épreuve : définis ton identité par ce que le système exige sans oser le nommer. »
              </p>
            </div>

            <button
              type="button"
              onClick={closeTotemDialogue}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-200/40"
            >
              Je relève le défi !
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Panda Step 2 Done (Name set to "ce champs")
  if (phase === 'panda_step2_done') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
        <div 
          className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-emerald-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader()}

          <div className="relative mx-auto w-28 h-28 mb-5">
            <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-emerald-500/20 via-white/10 to-teal-400/20 border-2 border-emerald-400/40 flex items-center justify-center overflow-hidden shadow-md">
              <img src="/panda.png" alt="Panda" className="w-20 h-20 object-contain filter drop-shadow-md animate-bounce" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
              <p className="text-sm sm:text-base font-semibold text-emerald-200 leading-relaxed italic">
                « Tu as confondu simplicité et absurdité ! Pour tout te dire, quand j'ai dû choisir mon propre nom, j'ai tapé un émoji qui pleure... le système l'a transcrit en texte brut : ToT. »
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFinalFriendship(true)}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-200/40"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Default Riddle Reminder (Re-clicking during step 3)
  const getRiddleText = () => {
    if (totemId === 'corbeau') return config.riddle;
    if (totemId === 'chouette') return config.riddle;
    if (totemId === 'renard') {
      return phase === 'riddle_step2' ? config.riddleStep2 : config.riddleStep1;
    }
    if (totemId === 'loup') return config.riddle;
    if (totemId === 'chat') return config.riddle;
    if (totemId === 'panda') {
      return phase === 'riddle_step2' ? config.riddleStep2 : config.riddleStep1;
    }
    return config.riddle || "Résous mon énigme pour que nous devenions amis.";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
      <div 
        className="relative max-w-md w-full bg-gradient-to-b from-[#182620] via-[#0f1d17] to-[#07130e] border-3 border-emerald-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden animate-bounce-in text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {renderHeader()}

        <div className="relative mx-auto w-28 h-28 mb-5">
          <div className="relative w-full h-full rounded-full p-2 bg-gradient-to-tr from-emerald-500/20 via-white/10 to-teal-400/20 border-2 border-emerald-400/40 flex items-center justify-center overflow-hidden shadow-md">
            <img 
              src={config.img} 
              alt={config.name} 
              className="w-20 h-20 object-contain filter drop-shadow-md"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white/10 border border-white/15 rounded-2xl p-4 sm:p-5 shadow-inner text-left">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300 uppercase tracking-wide mb-2">
              <HelpCircle className="w-4 h-4 text-emerald-300" />
              <span>Énigme en cours</span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-emerald-100 leading-relaxed italic">
              « {getRiddleText()} »
            </p>
          </div>

          <button
            type="button"
            onClick={closeTotemDialogue}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-200/40"
          >
            J'y travaille !
          </button>
        </div>
      </div>
    </div>
  );
}
