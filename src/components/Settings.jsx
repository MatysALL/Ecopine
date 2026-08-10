import React, { useState, useEffect } from 'react';
import { db, useDb } from '../db';
import { db as firestoreDb } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Trash2, ShieldAlert, CheckCircle, AlertCircle, 
  User, Users, Tag, Plus, FileSpreadsheet, Palette 
} from 'lucide-react';

export default function Settings() {

  // Profile states
  const [username, setUsername] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [favAccountId, setFavAccountId] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [themePreference, setThemePreference] = useState('default');

  // Custom Category states
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('🍎');
  const [newCatColor, setNewCatColor] = useState('#FFB3B3');

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
    friendships = [],
    logOutUser,
    unlockedThemes,
    activeTheme,
    acceptedFriends
  } = useDb();

  // Friendship states
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    setIsInviting(true);
    try {
      await db.friendships.sendRequest(inviteEmail.trim());
      setInviteEmail('');
      alert("Demande d'ami envoyée avec succès !");
    } catch (err) {
      console.error(err);
      alert(err.message || "Erreur lors de l'envoi de la demande d'ami.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleAcceptInvite = async (friendshipId) => {
    try {
      await db.friendships.acceptRequest(friendshipId);
    } catch (err) {
      console.error(err);
      alert("Impossible d'accepter l'invitation.");
    }
  };

  const handleRejectOrDeleteFriendship = async (friendshipId, isFriend) => {
    const msg = isFriend 
      ? "Es-tu sûr de vouloir retirer cet habitant de tes amis ? Tous ses partages seront révoqués."
      : "Es-tu sûr de vouloir annuler ou rejeter cette demande d'amitié ?";
    if (window.confirm(msg)) {
      try {
        await db.friendships.delete(friendshipId);
      } catch (err) {
        console.error(err);
        alert("Une erreur s'est produite.");
      }
    }
  };

  // Filter requests
  const receivedRequests = friendships.filter(f => f.status === 'pending' && f.receiverId === user?.uid);
  const sentRequests = friendships.filter(f => f.status === 'pending' && f.senderId === user?.uid);

  // Initial load of metadata
  useEffect(() => {
    if (userMeta) {
      const nameMeta = userMeta.find(m => m.key === 'username');
      const favMeta = userMeta.find(m => m.key === 'favorite_account_id');
      const photoMeta = userMeta.find(m => m.key === 'photoURL');
      const themeMeta = userMeta.find(m => m.key === 'theme_preference');
      setUsername(nameMeta?.value || '');
      setFavAccountId(favMeta?.value || '');
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
      await db.user_meta.put({ key: 'favorite_account_id', value: favAccountId });
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

      // Reset tomNookSold in Firestore & clean scoped/global localStorage
      if (user?.uid) {
        try {
          const userRef = doc(firestoreDb, 'users_meta', user.uid);
          await updateDoc(userRef, { tomNookSold: false });
          localStorage.removeItem(`tomNookSold_${user.uid}`);
        } catch (err) {
          console.error("Error resetting tomNookSold in Firestore:", err);
        }
      }
      localStorage.removeItem('tomNookSold');
      localStorage.removeItem('ecopine_tom_nook_sold');

      alert("Tutoriel réinitialisé ! Navigue à travers les sections pour tamponner ton carnet. 🐾");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la réinitialisation du tutoriel.");
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    // Check duplicate
    const normalizedNew = newCatName.trim().toLowerCase();
    const duplicate = categoriesList?.some(c => c.name.toLowerCase() === normalizedNew);
    if (duplicate) {
      alert("Cette catégorie existe déjà !");
      return;
    }

    try {
      await db.categories.add({
        name: newCatName.trim(),
        emoji: newCatEmoji,
        color: newCatColor
      });
      setNewCatName('');
      setNewCatEmoji('🍎');
      setNewCatColor('#FFB3B3');
    } catch (err) {
      console.error(err);
      alert("Impossible de créer la catégorie.");
    }
  };

  const handleDeleteCategory = async (catId) => {
    const cat = categoriesList?.find(c => c.id === catId);
    if (!cat) return;

    if (window.confirm(`Supprimer la catégorie "${cat.name}" ? Les transactions associées perdront leur étiquette de catégorie.`)) {
      await db.transaction('rw', [db.categories, db.transactions], async () => {
        await db.categories.delete(catId);
        // Dissociate from transactions sequentially
        const txsToModify = allTransactions.filter(t => t.categoryId === catId);
        for (const t of txsToModify) {
          await db.transactions.update(t.id, { categoryId: null, category: '' });
        }
      });
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

              <div>
                <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Compte Favori (Mise en avant)</label>
                <select
                  value={favAccountId}
                  onChange={(e) => setFavAccountId(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white cursor-pointer"
                >
                  <option value="">-- Sélectionner un compte favori --</option>
                  {accountsList?.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>

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

      {/* Categories Editor Card (Moved outside top grid to be full-width) */}
      <div className="ac-card p-6 bg-white border-ac-brown">
          <div>
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-ac-gold" /> Gestion des Catégories
            </h3>
            
            {/* Form to add custom category */}
            <form onSubmit={handleAddCategory} className="space-y-3 mb-4 bg-ac-cream p-3.5 rounded-2xl border-2 border-ac-brown">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatEmoji}
                  onChange={(e) => setNewCatEmoji(e.target.value)}
                  placeholder="🍎"
                  className="w-12 bg-white border-2 border-ac-brown rounded-xl px-2 py-1.5 text-center text-xs font-bold focus:outline-none"
                  maxLength={2}
                  required
                />
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nom de la catégorie..."
                  className="w-full bg-white border-2 border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
                  required
                />
              </div>

              {/* Color tiles picker */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black uppercase text-ac-brown-light">Couleur pastel</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '#FFB3B3', '#B3D9FF', '#B3FFB3', '#FFE0B3', '#E0B3FF',
                    '#FFEAA7', '#FAB1A0', '#55EFC4', '#81ECEC', '#DFE6E9'
                  ].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCatColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        newCatColor === color ? 'border-ac-brown scale-110 shadow-ac-xs' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-ac-green text-white font-extrabold text-xs py-2 rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Créer la catégorie
              </button>
            </form>

            {/* List of categories */}
            <div className="max-h-36 overflow-y-auto border border-ac-brown/10 rounded-xl divide-y divide-ac-brown/10 bg-white p-2">
              {categoriesList?.map(cat => (
                <div key={cat.id} className="py-2.5 flex justify-between items-center text-xs px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs border border-ac-brown/15 shadow-ac-xs" style={{ backgroundColor: cat.color }}>
                      {cat.emoji || '🍃'}
                    </span>
                    <span className="font-extrabold">{cat.name}</span>
                  </div>
                  {cat.isDefault ? (
                    <span className="text-[7px] font-black uppercase tracking-wider bg-ac-cream-dark/50 border border-ac-brown/10 text-ac-brown-light px-1.5 py-0.5 rounded">
                      Défaut
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1 hover:bg-ac-red-light rounded text-ac-brown-light hover:text-ac-red transition-colors cursor-pointer border border-transparent hover:border-ac-red/20"
                      title="Supprimer la catégorie"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Registre des Habitants (Amitiés) */}
      <div className="ac-card p-6 bg-white border-ac-brown space-y-6">
        <h3 className="text-lg font-black text-ac-brown flex items-center gap-2 border-b border-ac-brown/10 pb-2">
          <Users className="w-5 h-5 text-ac-green" /> Registre des Habitants (Amitiés)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form to invite */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-sm text-ac-brown flex items-center gap-1"> Nouvel Habitant</h4>
            <p className="text-[11px] font-semibold text-ac-brown-light leading-relaxed">
              Saisis l'e-mail d'un autre habitant d'Ecopine pour lui envoyer une demande d'ami. Une fois acceptée, vous pourrez partager vos comptes, souhaits et dettes !
            </p>
            <form onSubmit={handleSendInvite} className="space-y-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Ex: villageois@ecopine.fr"
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
                required
              />
              <button
                type="submit"
                disabled={isInviting}
                className="w-full bg-ac-green text-white font-extrabold text-xs py-2.5 rounded-2xl border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5 text-white" /> {isInviting ? "Envoi..." : "Envoyer la demande"}
              </button>
            </form>
          </div>

          {/* Pending invites */}
          <div className="space-y-4 md:border-l md:border-ac-brown/10 md:pl-6">
            <h4 className="font-extrabold text-sm text-ac-brown">Demandes d'ami</h4>
            
            {/* Demandes reçues */}
            <div className="space-y-3">
              <span className="block text-[10px] font-black uppercase text-ac-brown-light tracking-wide">Demandes Reçues</span>
              {receivedRequests.length === 0 ? (
                <p className="text-xs text-ac-brown-light/60 italic">Aucune demande reçue...</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {receivedRequests.map(req => (
                    <div key={req.id} className="p-3 bg-ac-cream border-2 border-ac-brown/15 rounded-2xl flex flex-col gap-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-extrabold text-ac-brown">🍃 {req.senderName}</span>
                        <span className="text-[9px] text-ac-brown-light">{req.senderEmail}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptInvite(req.id)}
                          className="flex-1 bg-ac-green text-white font-extrabold text-[10px] py-1.5 rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1 cursor-pointer hover:translate-y-[0.5px]"
                        >
                          Accepter
                        </button>
                        <button
                          onClick={() => handleRejectOrDeleteFriendship(req.id, false)}
                          className="px-2 bg-white text-ac-red font-extrabold text-[10px] py-1.5 rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center justify-center cursor-pointer hover:bg-ac-red-light"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Demandes envoyées */}
            <div className="space-y-3 pt-2">
              <span className="block text-[10px] font-black uppercase text-ac-brown-light tracking-wide">Demandes Envoyées</span>
              {sentRequests.length === 0 ? (
                <p className="text-xs text-ac-brown-light/60 italic">Aucune demande envoyée...</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                  {sentRequests.map(req => (
                    <div key={req.id} className="p-2.5 bg-white border border-ac-brown/10 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-extrabold text-ac-brown truncate">🍃 {req.receiverName}</span>
                        <span className="text-[9px] text-ac-brown-light truncate">{req.receiverEmail}</span>
                      </div>
                      <button
                        onClick={() => handleRejectOrDeleteFriendship(req.id, false)}
                        className="bg-white hover:bg-ac-red-light text-ac-brown-light hover:text-ac-red p-1 rounded border border-ac-brown/10 cursor-pointer"
                        title="Annuler la demande"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Accepted friends list */}
          <div className="space-y-4 md:border-l md:border-ac-brown/10 md:pl-6">
            <h4 className="font-extrabold text-sm text-ac-brown">Amis de l'île ({acceptedFriends.length})</h4>
            {acceptedFriends.length === 0 ? (
              <div className="text-center py-6 bg-ac-cream/55 border border-dashed border-ac-brown/15 rounded-2xl">
                <p className="text-xs font-bold text-ac-brown-light">Tu n'as pas encore d'amis.</p>
                <p className="text-[10px] text-ac-brown-light/80 mt-0.5">Envoie une demande ci-dessus ! ✈️</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {acceptedFriends.map(friend => {
                  return (
                    <div key={friend.id} className="p-3 bg-white border-2 border-ac-brown rounded-2xl flex items-center justify-between shadow-ac-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border border-ac-brown/15 shrink-0 bg-ac-cream-dark">
                          {friend.photoURL ? (
                            <img src={friend.photoURL} alt={friend.name} className="w-full h-full object-cover object-center block" />
                          ) : (
                            <span className="text-xs font-black text-ac-brown">🍃</span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-ac-brown">🍃 {friend.name}</span>
                          <span className="text-[9px] text-ac-brown-light">{friend.email}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRejectOrDeleteFriendship(friend.id, true)}
                        className="bg-white hover:bg-ac-red-light border border-ac-brown/20 hover:border-ac-red/20 text-ac-brown-light hover:text-ac-red p-1.5 rounded-lg cursor-pointer transition-colors"
                        title="Retirer des amis"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
