import React, { useState, useEffect } from 'react';
import { db, useDb } from '../db';
import { 
  Trash2, ShieldAlert, CheckCircle, AlertCircle, 
  User, Tag, FileSpreadsheet, Palette 
} from 'lucide-react';

export default function Settings() {

  // Profile states
  const [username, setUsername] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [themePreference, setThemePreference] = useState('default');

  const predefinedAvatars = [
    '/pfp-ac.jpg',
    '/pfp-ankha.jpg',
    '/pfp-clochette.jpg',
    '/pfp-marie.jpg',
    '/pfp-thibou.jpg',
    '/pfp-tom-nook.jpg'
  ];

  const { 
    userMeta, 
    accountsData: accountsList, 
    categories: categoriesList,
    transactions: allTransactions,
    pockets: pocketsList,
    user,
    logOutUser,
    unlockedThemes,
    activeTheme
  } = useDb();

  // Initial load of metadata
  useEffect(() => {
    if (userMeta) {
      const nameMeta = userMeta.find(m => m.key === 'username');
      const photoMeta = userMeta.find(m => m.key === 'photoURL');
      const themeMeta = userMeta.find(m => m.key === 'theme_preference');
      setUsername(nameMeta?.value || '');
      setPhotoURL(photoMeta?.value || user?.photoURL || '/pfp-ac.jpg');
      setThemePreference(themeMeta?.value || 'default');
    }
  }, [userMeta, user]);

  const handleThemeChange = async (theme) => {
    setThemePreference(theme);
    try {
      await db.user_meta.put({ key: 'theme_preference', value: theme });
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du thème :", err);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      await db.user_meta.put({ key: 'username', value: username.trim() });
      await db.user_meta.put({ key: 'photoURL', value: (photoURL || '/pfp-ac.jpg').trim() });
      await db.user_meta.put({ key: 'theme_preference', value: themePreference });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du profil.");
    }
  };

  const handleResetTutorial = async () => {
    if (!window.confirm("Veux-tu relancer le tutoriel d'installation Nook ? Tes tampons seront réinitialisés mais tes clochettes et comptes restent intacts !")) return;

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





  const handleReset = async () => {
    const confirmWipe = window.confirm(
      "ATTENTION : Es-tu absolument sûr de vouloir réinitialiser l'application ? Tout ton historique de clochettes sera effacé définitivement."
    );
    if (!confirmWipe) return;

    await db.transaction('rw', db.accounts, db.transactions, db.pockets, db.wishlist, db.debts, db.categories, db.user_meta, async () => {
      await db.accounts.clear();
      await db.transactions.clear();
      await db.pockets.clear();
      await db.wishlist.clear();
      await db.debts.clear();
      await db.categories.clear();
      await db.user_meta.clear();
    });

    alert("Application réinitialisée avec succès !");
    window.location.reload();
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

  const themesList = [
    { id: 'default', name: 'Standard', desc: 'Crème & Boisé', bg: '#F4F1EA', btn: '#78B159', text: '#4A3E3D', border: '#4A3E3D' },
    { id: 'red', name: 'Rouge Pastel', desc: 'Fraise & Blush', bg: '#FFF0F2', btn: '#FF8B94', text: '#5C2E35', border: '#8A4F58' },
    { id: 'blue', name: 'Bleu Pastel', desc: 'Ciel & Glace', bg: '#EDF6FA', btn: '#92C7E8', text: '#1E2D3B', border: '#4B5E70' },
    { id: 'yellow', name: 'Jaune Pastel', desc: 'Beurre & Miel', bg: '#FFF9E6', btn: '#F7DB99', text: '#4A3525', border: '#785D4A' },
    { id: 'lea', name: 'Thème Léa', desc: 'Sakura Rose & Violet', bg: '#F5F3FF', btn: '#EC4899', text: '#4C1D95', border: '#8B5CF6' },
    { id: 'wayfs', name: 'Thème Wayfs', desc: 'Abyssal Bleu & Violet', bg: '#0F172A', btn: '#8B5CF6', text: '#F8FAFC', border: '#8B5CF6' },
    { id: 'neon', name: 'Thème Néon', desc: 'Cyberpunk Néon', bg: '#09090B', btn: '#00FFFF', text: '#F4F4F5', border: '#FF00FF' }
  ];

  return (
    <div className="space-y-8 animate-fade-in text-ac-brown select-none">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            Paramètres & Île
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Gère ton profil d'habitant, tes catégories, tes sauvegardes et tes exports.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-ac-green" /> Profil d'habitant
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

              <div>
                <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-2">Choisis ton Avatar d'Habitant</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {predefinedAvatars.map(pfp => {
                    const isSelected = photoURL === pfp || (!photoURL && pfp === '/pfp-ac.jpg');
                    return (
                      <button
                        key={pfp}
                        type="button"
                        onClick={() => setPhotoURL(pfp)}
                        className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center border-2 border-[#5C3A41] shrink-0 bg-white transition-all cursor-pointer ${
                          isSelected ? 'ring-4 ring-[#7C9E59] scale-105' : 'hover:scale-105 opacity-85 hover:opacity-100'
                        }`}
                      >
                        <img 
                          src={pfp} 
                          alt="Avatar Option" 
                          className="w-full h-full object-cover object-center block" 
                        />
                      </button>
                    );
                  })}
                </div>
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
                  Enregistrer les modifications
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

        {/* Thème de l'île Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-ac-green" /> Thème de l'île
            </h3>
            <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-6">
              Choisis ton ambiance pastel favorite. Le thème s'applique instantanément et est synchronisé sur ton profil.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {themesList.map(t => {
                const isUnlocked = unlockedThemes?.includes(t.id);
                if (isUnlocked) {
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleThemeChange(t.id)}
                      className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left w-full aspect-square hover:scale-102 hover:shadow-ac-xs ${
                        themePreference === t.id ? 'ring-4 ring-ac-green scale-102' : 'opacity-85'
                      }`}
                      style={{ backgroundColor: t.bg, borderColor: t.border, color: t.text }}
                    >
                      <div className="w-full">
                        <span className="block text-xs font-black">{t.name}</span>
                        <span className="block text-[9px] font-bold opacity-85 leading-tight mt-0.5">{t.desc}</span>
                      </div>
                      {/* Previews */}
                      <div className="flex gap-1.5 mt-3 self-end">
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: t.bg, borderColor: t.border }} title="Fond"></div>
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: t.btn, borderColor: t.border }} title="Bouton"></div>
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: t.text, borderColor: t.border }} title="Texte"></div>
                      </div>
                    </button>
                  );
                } else {
                  return (
                    <div
                      key={t.id}
                      className="flex flex-col justify-between p-3.5 rounded-2xl border-2 border-dashed border-ac-brown/30 bg-ac-cream-dark/45 opacity-55 select-none w-full aspect-square relative overflow-hidden"
                    >
                      <div className="w-full">
                        <span className="block text-xs font-black text-ac-brown-light/80">🔒 Thème Mystère</span>
                        <span className="block text-[8px] font-extrabold text-ac-brown-light/65 leading-tight mt-1">Indice : un secret à découvrir...</span>
                      </div>
                      <div className="flex items-center justify-center absolute inset-0 text-xl opacity-10">
                        🍃
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
      <div className="ac-card p-6 bg-white border-ac-brown">
        <h3 className="text-lg font-black text-ac-red flex items-center gap-2 mb-2">
          <ShieldAlert className="w-5 h-5" /> Zone de Danger
        </h3>
        <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-6">
          Efface tout ton historique définitivement pour repartir à zéro. Tes données seront effacées et la base de données recréée.
        </p>
        <button
          onClick={handleReset}
          className="bg-ac-red-light hover:bg-ac-red/10 text-ac-red border-3 border-ac-brown font-extrabold text-xs px-5 py-3 rounded-2xl shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center gap-2 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" /> Réinitialiser toute l'application
        </button>
      </div>
    </div>
  );
}
