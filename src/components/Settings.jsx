import React, { useState, useEffect } from 'react';
import { db, useDb } from '../db';
import { 
  Trash2, ShieldAlert, CheckCircle, AlertCircle, 
  User, Palette, RotateCcw, AlertTriangle, X, Lock
} from 'lucide-react';
import { APP_THEMES, AVAILABLE_AVATARS } from '../config/themes';
import { triggerAnimalEncounter } from '../context/EncounterContext';
import TotemBadge from './TotemBadge';

export { AVAILABLE_AVATARS, APP_THEMES };

export default function Settings() {
  // Profile states
  const [username, setUsername] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [themePreference, setThemePreference] = useState('default');

  const { 
    userMeta, 
    user,
    logOutUser,
    unlockedThemes,
    unlockedAvatars,
    resetMyAccount,
    deleteMyAccount,
    totems,
    updateTotem
  } = useDb();

  // Danger zone state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isProcessingDanger, setIsProcessingDanger] = useState(false);
  const [dangerToast, setDangerToast] = useState(null); // { type: 'success' | 'error', message: string }

  const showDangerToast = (message, type = 'success') => {
    setDangerToast({ message, type });
    setTimeout(() => setDangerToast(null), 4000);
  };

  // Initial load of metadata
  useEffect(() => {
    if (userMeta) {
      const nameMeta = userMeta.find(m => m.key === 'username');
      const photoMeta = userMeta.find(m => m.key === 'photoURL');
      const themeMeta = userMeta.find(m => m.key === 'theme_preference');
      setUsername(nameMeta?.value || '');
      setPhotoURL(photoMeta?.value || '/utilisateur.png');
      setThemePreference(themeMeta?.value || 'default');
    }
  }, [userMeta, user]);

  const handleSelectAvatar = async (avatar) => {
    const isUnlocked = unlockedAvatars?.includes(avatar.id) || unlockedAvatars?.includes(avatar.src) || avatar.id === 'utilisateur';
    if (!isUnlocked) return;
    if (!user?.uid || photoURL === avatar.src) return;

    const previousAvatar = photoURL;
    // Mise à jour optimiste du state local
    setPhotoURL(avatar.src);

    // Détection 1 Panda : Changer d'avatar de profil, puis rééquiper immédiatement l'avatar par défaut utilisateur.png
    const isReturningToDefault = (avatar.id === 'utilisateur' || avatar.src === '/utilisateur.png');
    const wasOtherAvatar = (previousAvatar && previousAvatar !== '/utilisateur.png');
    if (isReturningToDefault && wasOtherAvatar) {
      if (totems?.panda?.step >= 1 && !totems?.panda?.avatarToggled && typeof updateTotem === 'function') {
        updateTotem('panda', { avatarToggled: true }).catch(err => console.error(err));
      }
    }

    try {
      await db.user_meta.put({ key: 'photoURL', value: avatar.src });
    } catch (error) {
      console.error("Erreur lors du changement d'avatar :", error);
    }
  };

  const handleThemeChange = async (themeId) => {
    const isUnlocked = unlockedThemes?.includes(themeId) || themeId === 'default' || themeId === 'default_dark';
    if (!isUnlocked) return;

    const previousTheme = themePreference;
    if (
      previousTheme !== 'default' &&
      previousTheme !== 'default_dark' &&
      (themeId === 'default' || themeId === 'default_dark')
    ) {
      triggerAnimalEncounter('panda');
    }

    setThemePreference(themeId);
    try {
      await db.user_meta.put({ key: 'theme_preference', value: themeId });
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du thème :", err);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      await db.user_meta.put({ key: 'username', value: username.trim() });
      await db.user_meta.put({ key: 'photoURL', value: (photoURL || '/utilisateur.png').trim() });
      await db.user_meta.put({ key: 'theme_preference', value: themePreference });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du profil.");
    }
  };

  const handleResetTutorial = async () => {
    if (!window.confirm("Veux-tu relancer le tutoriel d'installation ? Tes tampons seront réinitialisés mais tes euros et comptes restent intacts !")) return;

    try {
      await db.user_meta.put({
        key: 'tutorial_progress',
        value: {
          isCompleted: false,
          steps: {
            accounts: false,
            calendar: false,
            debts: false,
            wishlist: false,
            home: false,
            settings: false
          }
        }
      });
      alert("Tutoriel réinitialisé ! Navigue à travers les sections pour tamponner ton carnet. 🐾");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la réinitialisation du tutoriel.");
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Es-tu sûr de vouloir quitter ton île budgétaire ?")) {
      try {
        await logOutUser();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la déconnexion.");
      }
    }
  };

  const handleExecuteReset = async () => {
    setIsProcessingDanger(true);
    try {
      await resetMyAccount();
      setResetModalOpen(false);
      showDangerToast("Ton île a été réinitialisée avec succès ! Redirection vers l'installation...", 'success');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      console.error("Erreur lors de la réinitialisation :", err);
      showDangerToast("Erreur lors de la réinitialisation : " + (err.message || "Erreur inconnue"), 'error');
      setIsProcessingDanger(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (deleteInput.trim() !== 'SUPPRIMER') {
      showDangerToast("Veuillez saisir 'SUPPRIMER' exactement pour confirmer.", 'error');
      return;
    }

    setIsProcessingDanger(true);
    try {
      await deleteMyAccount();
      // deleteMyAccount handles storage clearing and window reload to login
    } catch (err) {
      console.error("Erreur lors de la suppression :", err);
      showDangerToast("Erreur lors de la suppression : " + (err.message || "Erreur inconnue"), 'error');
      setIsProcessingDanger(false);
    }
  };

  const themesList = Object.values(APP_THEMES);

  return (
    <div className="space-y-8 animate-fade-in text-ac-brown select-none">
      {/* Toast Notification */}
      {dangerToast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl border-3 border-ac-brown shadow-ac-md flex items-center gap-2.5 font-black text-xs text-white animate-bounce-in ${
          dangerToast.type === 'error' ? 'bg-ac-red' : 'bg-ac-green'
        }`}>
          {dangerToast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{dangerToast.message}</span>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            Paramètres &amp; Île
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Gère ton profil d'habitant, tes thèmes pastel et le cycle de vie de tes données.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end md:self-center">
          <TotemBadge totemId="panda" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Account Info Card + Dedicated Avatar Selector Widget */}
        <div className="space-y-6">
          {/* Widget 1: Account / Profile Management */}
          <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
            <div>
              <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-ac-green" /> Informations du compte
              </h3>
              
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Prénom de l'habitant</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: Matys"
                    className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                    required
                  />
                </div>

                {user?.email && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-ac-brown-light bg-ac-cream-dark/20 px-4 py-3 rounded-2xl border border-ac-brown/10">
                    <div>
                      <span className="block text-[9px] font-black uppercase text-ac-brown-light/65 mb-0.5">Adresse e-mail</span>
                      <span className="text-ac-brown break-all">{user.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="bg-ac-red hover:bg-ac-red/90 text-white font-extrabold text-xs px-4 py-2 rounded-xl border-2 border-ac-brown shadow-ac-sm active:translate-y-[1px] cursor-pointer whitespace-nowrap self-start sm:self-center"
                    >
                      Se déconnecter
                    </button>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-3 flex-wrap">
                  <button
                    type="submit"
                    className="bg-ac-green text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl border-2 border-ac-brown shadow-ac-sm hover:translate-y-[1px] cursor-pointer"
                  >
                    Enregistrer le prénom
                  </button>

                  <button
                    type="button"
                    onClick={handleResetTutorial}
                    className="bg-ac-gold text-ac-brown font-extrabold text-xs px-5 py-2.5 rounded-2xl border-2 border-ac-brown shadow-ac-sm hover:translate-y-[1px] cursor-pointer flex items-center gap-1"
                  >
                    🐾 Revoir le tutoriel
                  </button>

                  {saveSuccess && (
                    <span className="text-[10px] font-black text-ac-green flex items-center gap-1 animate-bounce-in">
                      <CheckCircle className="w-4 h-4" /> Sauvegardé !
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Widget 2: Dedicated Avatar Selector Widget */}
          <div className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm transition-all">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🎨</span>
              <div>
                <h2 className="text-lg font-black text-ac-brown">
                  Avatar du profil
                </h2>
                <p className="text-xs font-semibold text-ac-brown-light">
                  Choisis ton apparence parmi nos 7 mascottes.
                </p>
              </div>
            </div>

            {/* Grille des avatars disponibles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-lg mt-3">
              {AVAILABLE_AVATARS.map((avatar) => {
                const isSelected = photoURL === avatar.src || (!photoURL && avatar.src === '/utilisateur.png');
                const isUnlocked = unlockedAvatars?.includes(avatar.id) || unlockedAvatars?.includes(avatar.src) || avatar.id === 'utilisateur';
                const isLocked = !isUnlocked;

                return (
                  <button
                    key={avatar.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleSelectAvatar(avatar)}
                    title={isUnlocked ? avatar.name : `${avatar.name} (Verrouillé)`}
                    className={`relative group flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all duration-200 ${
                      isLocked 
                        ? 'opacity-40 grayscale cursor-not-allowed border-2 border-dashed border-ac-brown/30 bg-ac-cream-dark/20' 
                        : isSelected
                          ? 'bg-ac-green/15 ring-3 ring-ac-green shadow-md scale-105 border-2 border-ac-green cursor-pointer'
                          : 'hover:bg-ac-cream hover:scale-105 active:scale-95 border-2 border-transparent cursor-pointer'
                    }`}
                  >
                    {/* Image de l'avatar */}
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center p-2 overflow-hidden">
                      <img
                        src={avatar.src}
                        alt={avatar.name}
                        className="w-full h-full object-contain select-none pointer-events-none"
                        onError={(e) => { e.currentTarget.src = '/utilisateur.png'; }}
                      />
                      {isLocked && (
                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
                          <Lock className="w-4 h-4 text-slate-400 absolute top-1 right-1" />
                        </div>
                      )}
                    </div>

                    {/* Label de l'avatar */}
                    <span className="text-xs font-medium text-slate-700 mt-1 text-center">
                      {avatar.name}
                    </span>

                    {/* Badge de sélection active */}
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-5 h-5 bg-ac-green text-white rounded-full flex items-center justify-center text-[10px] font-black shadow">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Thème Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-ac-green" /> Thème de l'application
            </h3>
            <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-6">
              Choisis ton ambiance parmi les 7 thèmes exclusifs. Chaque thème applique ses 3 couleurs phares (principale, secondaire et texte).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {themesList.map(t => {
                const isUnlocked = unlockedThemes?.includes(t.id) || t.id === 'default' || t.id === 'default_dark';
                const isSelected = themePreference === t.id;

                if (isUnlocked) {
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleThemeChange(t.id)}
                      className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left w-full aspect-square hover:scale-102 hover:shadow-ac-xs relative overflow-hidden ${
                        isSelected ? 'ring-4 ring-ac-green scale-102 border-ac-green shadow-md' : 'opacity-90 border-ac-brown/20'
                      }`}
                      style={{ 
                        backgroundColor: t.colors.secondary, 
                        borderColor: isSelected ? undefined : t.colors.primary, 
                        color: t.colors.text 
                      }}
                    >
                      <div className="w-full flex items-start justify-between gap-1">
                        <div>
                          <span className="block text-xs font-black">{t.name}</span>
                          <span className="block text-[9px] font-bold opacity-75 mt-0.5">Mascotte</span>
                        </div>
                        {/* Mascotte miniature */}
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-current shrink-0 bg-white/40">
                          <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                        </div>
                      </div>

                      {/* 3 Pastilles de couleur : Principal, Secondaire, Texte */}
                      <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-current/15">
                        <span className="text-[9px] font-extrabold uppercase opacity-75">3 Couleurs</span>
                        <div className="flex gap-1.5 items-center">
                          <div 
                            className="w-4 h-4 rounded-full border border-black/20 shadow-xs" 
                            style={{ backgroundColor: t.colors.primary }} 
                            title={`Principal: ${t.colors.primary}`}
                          />
                          <div 
                            className="w-4 h-4 rounded-full border border-black/20 shadow-xs" 
                            style={{ backgroundColor: t.colors.secondary }} 
                            title={`Secondaire: ${t.colors.secondary}`}
                          />
                          <div 
                            className="w-4 h-4 rounded-full border border-black/20 shadow-xs" 
                            style={{ backgroundColor: t.colors.text }} 
                            title={`Texte: ${t.colors.text}`}
                          />
                        </div>
                      </div>

                      {isSelected && (
                        <span className="absolute bottom-1 right-1 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-ac-green text-white shadow-xs">
                          Actif
                        </span>
                      )}
                    </button>
                  );
                } else {
                  return (
                    <div
                      key={t.id}
                      className="flex flex-col justify-between p-3.5 rounded-2xl border-2 border-dashed border-ac-brown/30 bg-ac-cream-dark/30 opacity-60 select-none w-full aspect-square relative overflow-hidden"
                    >
                      <div className="w-full flex items-start justify-between gap-1">
                        <div>
                          <div className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-ac-brown-light" />
                            <span className="block text-xs font-black text-ac-brown-light/90">{t.name}</span>
                          </div>
                          <span className="block text-[8px] font-extrabold text-ac-brown-light/65 leading-tight mt-0.5">
                            Thème verrouillé
                          </span>
                        </div>
                        {/* Mascotte floutée / grisée */}
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-ac-brown/20 shrink-0 opacity-40 grayscale">
                          <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                        </div>
                      </div>

                      {/* 3 Pastilles de couleur même si verrouillé */}
                      <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-ac-brown/10">
                        <span className="text-[9px] font-bold text-ac-brown-light/70">Aperçu</span>
                        <div className="flex gap-1.5 items-center opacity-60">
                          <div className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: t.colors.primary }} />
                          <div className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: t.colors.secondary }} />
                          <div className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: t.colors.text }} />
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className="bg-[#FFFDF9] border-3 border-ac-red/60 rounded-3xl p-6 shadow-ac-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-ac-red/10 rounded-bl-3xl border-l-2 border-b-2 border-ac-red/20 pointer-events-none"></div>

        <div className="flex items-center gap-2.5 mb-2 text-ac-red">
          <div className="w-9 h-9 rounded-2xl bg-ac-red/10 border-2 border-ac-red/30 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-ac-red" />
          </div>
          <div>
            <h3 className="text-base font-black text-ac-red">Zone de Danger</h3>
            <span className="text-[10px] font-bold text-ac-brown-light">Actions destructives et irréversibles</span>
          </div>
        </div>

        <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-6">
          Gère le cycle de vie de tes données. Tu peux soit réinitialiser l'ensemble de ton île (pour repartir de zéro tout en restant connecté), soit supprimer définitivement ton compte et toutes les données associées.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Action 1 : Reset */}
          <div className="bg-amber-50/60 border-2 border-amber-300/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-black text-xs text-amber-900 mb-1">
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <span>Réinitialiser mes données</span>
              </div>
              <p className="text-[11px] font-semibold text-amber-800/80 leading-relaxed">
                Purge tous tes comptes, transactions, poches, dettes, souhaits et amitiés. Tu resteras connecté et pourras recommencer la configuration de ton île.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-900 border-2 border-amber-900/30 font-black text-xs px-4 py-2.5 rounded-xl shadow-ac-xs active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser mon île</span>
            </button>
          </div>

          {/* Action 2 : Delete Account */}
          <div className="bg-ac-red/5 border-2 border-ac-red/40 rounded-2xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-black text-xs text-ac-red mb-1">
                <Trash2 className="w-4 h-4 text-ac-red" />
                <span>Supprimer mon compte</span>
              </div>
              <p className="text-[11px] font-semibold text-ac-brown-light leading-relaxed">
                Supprime définitivement ton profil, tes accès et l'ensemble de tes données Firestore. Tu seras déconnecté et renvoyé sur l'écran d'identification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeleteInput('');
                setDeleteModalOpen(true);
              }}
              className="bg-ac-red hover:bg-ac-red/90 active:bg-ac-red text-white border-2 border-ac-brown font-black text-xs px-4 py-2.5 rounded-xl shadow-ac-xs active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer transition-transform"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer définitivement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1 : Confirmation Réinitialisation */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown select-none">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              onClick={() => !isProcessingDanger && setResetModalOpen(false)}
              disabled={isProcessingDanger}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-transform hover:scale-110 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 text-amber-700 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center border-2 border-amber-400">
                <RotateCcw className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-black text-ac-brown">Réinitialiser mon île</h3>
                <span className="text-[10px] font-bold text-ac-brown-light">Remise à zéro des données</span>
              </div>
            </div>

            <p className="text-xs font-bold text-ac-brown-light leading-relaxed mb-6">
              Êtes-vous sûr de vouloir réinitialiser toutes vos données ? Vos comptes, transactions, dettes, souhaits et amitiés seront effacés. <strong>Vous resterez connecté et pourrez repartir de zéro.</strong>
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                disabled={isProcessingDanger}
                className="bg-white border-2 border-ac-brown text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-xl hover:bg-ac-cream cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isProcessingDanger}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingDanger ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>Confirmer la réinitialisation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2 : Confirmation Suppression Définitive */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown select-none">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              onClick={() => !isProcessingDanger && setDeleteModalOpen(false)}
              disabled={isProcessingDanger}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-transform hover:scale-110 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 text-ac-red mb-3">
              <div className="w-10 h-10 bg-ac-red/10 rounded-full flex items-center justify-center border-2 border-ac-red/30">
                <AlertTriangle className="w-5 h-5 text-ac-red" />
              </div>
              <div>
                <h3 className="text-base font-black text-ac-red">Suppression Définitive</h3>
                <span className="text-[10px] font-bold text-ac-brown-light">Action irréversible</span>
              </div>
            </div>

            <p className="text-xs font-bold text-ac-brown-light leading-relaxed mb-4">
              Attention : Tu t'apprêtes à <strong>supprimer définitivement ton compte et l'ensemble de tes données</strong>. Tu seras immédiatement déconnecté. Cette action est irréversible.
            </p>

            <div className="bg-ac-cream-dark/30 border-2 border-ac-brown/30 rounded-2xl p-3.5 mb-5">
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1.5">
                Pour confirmer, saisis le mot <strong className="text-ac-red">SUPPRIMER</strong> :
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="SUPPRIMER"
                disabled={isProcessingDanger}
                className="w-full bg-white border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-black text-ac-brown focus:outline-none focus:ring-2 focus:ring-ac-red uppercase"
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isProcessingDanger}
                className="bg-white border-2 border-ac-brown text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-xl hover:bg-ac-cream cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={deleteInput.trim() !== 'SUPPRIMER' || isProcessingDanger}
                className="bg-ac-red hover:bg-ac-red/90 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isProcessingDanger ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Supprimer mon compte</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
