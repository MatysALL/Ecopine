import React, { useState, useEffect } from 'react';
import { db, useDb } from '../db';
import { 
  Download, Upload, Trash2, ShieldAlert, CheckCircle, AlertCircle, 
  User, Users, Tag, Plus, FileSpreadsheet, Palette 
} from 'lucide-react';

export default function Settings() {
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState('');

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
    logOutUser
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
  const acceptedFriends = friendships.filter(f => f.status === 'accepted');

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

  const handleExport = async () => {
    try {
      const data = {
        user_meta: userMeta,
        accounts: accountsList,
        transactions: allTransactions,
        pockets: pocketsList,
        categories: categoriesList
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `ecopine_backup_${todayStr}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'export de la base de données.");
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    setImportMessage('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const data = JSON.parse(text);

        if (!data || typeof data !== 'object') {
          throw new Error("Format JSON invalide.");
        }

        const requiredTables = ['accounts', 'transactions'];
        for (const table of requiredTables) {
          if (!data[table] || !Array.isArray(data[table])) {
            throw new Error(`Données manquantes ou invalides pour la table '${table}'.`);
          }
        }

        const confirmOverwrite = window.confirm(
          "Attention : Importer ce fichier écrasera toutes les données actuelles de ton application Ecopine. Continuer ?"
        );
        if (!confirmOverwrite) return;

        // Perform import by clearing tables and bulk-adding
        await db.transaction('rw', db.accounts, db.transactions, db.pockets, db.categories, db.user_meta, async () => {
          await db.accounts.clear();
          await db.transactions.clear();
          await db.pockets.clear();
          await db.categories.clear();
          await db.user_meta.clear();

          if (data.user_meta && data.user_meta.length > 0) await db.user_meta.bulkAdd(data.user_meta);
          if (data.accounts.length > 0) await db.accounts.bulkAdd(data.accounts);
          if (data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions);
          if (data.pockets && data.pockets.length > 0) await db.pockets.bulkAdd(data.pockets);
          if (data.categories && data.categories.length > 0) {
            await db.categories.bulkAdd(data.categories);
          } else {
            // Populate defaults if none present in backup
            await db.categories.bulkAdd([
              { name: 'Loisirs', isDefault: 1 },
              { name: 'Nourriture', isDefault: 1 },
              { name: 'Logement', isDefault: 1 },
              { name: 'Transports', isDefault: 1 },
              { name: 'Abonnements', isDefault: 1 },
              { name: 'Cadeaux', isDefault: 1 },
              { name: 'Santé', isDefault: 1 },
              { name: 'Salaire', isDefault: 1 },
              { name: 'Autre', isDefault: 1 }
            ]);
          }
        });

        setImportStatus('success');
        setImportMessage("Base de données restaurée avec succès !");
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        console.error(err);
        setImportStatus('error');
        setImportMessage(`Échec de la restauration : ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  const handleCSVExport = async () => {
    try {
      const txs = allTransactions;
      const accs = accountsList;
      const categories = categoriesList;

      const csvRows = [
        ['Date', 'Compte', 'Transaction', 'Montant', 'Type', 'Categorie', 'Execution'].join(',')
      ];

      for (const tx of txs) {
        const acc = accs.find(a => a.id === tx.accountId);
        const cat = categories.find(c => c.id === tx.categoryId);
        const catName = cat ? cat.name : (tx.category || 'Autre');
        
        const row = [
          tx.date,
          `"${(acc ? acc.name : 'Inconnu').replace(/"/g, '""')}"`,
          `"${(tx.name || tx.description || 'Sans nom').replace(/"/g, '""')}"`,
          tx.amount.toFixed(2),
          tx.type === 'credit' ? 'Revenu' : 'Dépense',
          `"${catName.replace(/"/g, '""')}"`,
          tx.executionType || 'spontaneous'
        ];
        csvRows.push(row.join(','));
      }

      // Prepend UTF-8 BOM for correct accents display in Excel
      const csvString = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ecopine_export_transactions_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'export CSV : " + err.message);
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

            <div className="grid grid-cols-2 gap-4">
              {/* Option 1: Default */}
              <button
                type="button"
                onClick={() => handleThemeChange('default')}
                className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 border-ac-brown transition-all cursor-pointer text-left w-full aspect-square bg-[#F4F1EA] hover:scale-102 hover:shadow-ac-xs ${
                  themePreference === 'default' ? 'ring-4 ring-ac-green scale-102' : 'opacity-85'
                }`}
              >
                <div className="w-full">
                  <span className="block text-xs font-black text-[#4A3E3D]">Standard</span>
                  <span className="block text-[9px] font-bold text-[#7D6C6A] leading-tight">Crème & Boisé</span>
                </div>
                {/* Previews */}
                <div className="flex gap-1.5 mt-3 self-end">
                  <div className="w-4 h-4 rounded-full border border-[#4A3E3D] bg-[#F4F1EA]" title="Fond"></div>
                  <div className="w-4 h-4 rounded-full border border-[#4A3E3D] bg-[#78B159]" title="Bouton"></div>
                  <div className="w-4 h-4 rounded-full border border-[#4A3E3D] bg-[#4A3E3D]" title="Texte"></div>
                </div>
              </button>

              {/* Option 2: Red */}
              <button
                type="button"
                onClick={() => handleThemeChange('red')}
                className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 border-[#8A4F58] transition-all cursor-pointer text-left w-full aspect-square bg-[#FFF0F2] hover:scale-102 hover:shadow-ac-xs ${
                  themePreference === 'red' ? 'ring-4 ring-[#FF8B94] scale-102' : 'opacity-85'
                }`}
              >
                <div className="w-full">
                  <span className="block text-xs font-black text-[#5C2E35]">Rouge Pastel</span>
                  <span className="block text-[9px] font-bold text-[#8A4F58] leading-tight">Fraise & Blush</span>
                </div>
                {/* Previews */}
                <div className="flex gap-1.5 mt-3 self-end">
                  <div className="w-4 h-4 rounded-full border border-[#8A4F58] bg-[#FFF0F2]" title="Fond"></div>
                  <div className="w-4 h-4 rounded-full border border-[#8A4F58] bg-[#FF8B94]" title="Bouton"></div>
                  <div className="w-4 h-4 rounded-full border border-[#8A4F58] bg-[#5C2E35]" title="Texte"></div>
                </div>
              </button>

              {/* Option 3: Blue */}
              <button
                type="button"
                onClick={() => handleThemeChange('blue')}
                className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 border-[#4B5E70] transition-all cursor-pointer text-left w-full aspect-square bg-[#EDF6FA] hover:scale-102 hover:shadow-ac-xs ${
                  themePreference === 'blue' ? 'ring-4 ring-[#92C7E8] scale-102' : 'opacity-85'
                }`}
              >
                <div className="w-full">
                  <span className="block text-xs font-black text-[#1E2D3B]">Bleu Pastel</span>
                  <span className="block text-[9px] font-bold text-[#4B5E70] leading-tight">Ciel & Glace</span>
                </div>
                {/* Previews */}
                <div className="flex gap-1.5 mt-3 self-end">
                  <div className="w-4 h-4 rounded-full border border-[#4B5E70] bg-[#EDF6FA]" title="Fond"></div>
                  <div className="w-4 h-4 rounded-full border border-[#4B5E70] bg-[#92C7E8]" title="Bouton"></div>
                  <div className="w-4 h-4 rounded-full border border-[#4B5E70] bg-[#1E2D3B]" title="Texte"></div>
                </div>
              </button>

              {/* Option 4: Yellow */}
              <button
                type="button"
                onClick={() => handleThemeChange('yellow')}
                className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 border-[#785D4A] transition-all cursor-pointer text-left w-full aspect-square bg-[#FFF9E6] hover:scale-102 hover:shadow-ac-xs ${
                  themePreference === 'yellow' ? 'ring-4 ring-[#F7DB99] scale-102' : 'opacity-85'
                }`}
              >
                <div className="w-full">
                  <span className="block text-xs font-black text-[#4A3525]">Jaune Pastel</span>
                  <span className="block text-[9px] font-bold text-[#785D4A] leading-tight">Beurre & Miel</span>
                </div>
                {/* Previews */}
                <div className="flex gap-1.5 mt-3 self-end">
                  <div className="w-4 h-4 rounded-full border border-[#785D4A] bg-[#FFF9E6]" title="Fond"></div>
                  <div className="w-4 h-4 rounded-full border border-[#785D4A] bg-[#F7DB99]" title="Bouton"></div>
                  <div className="w-4 h-4 rounded-full border border-[#785D4A] bg-[#4A3525]" title="Texte"></div>
                </div>
              </button>
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
                  const isSender = friend.senderId === user.uid;
                  const friendName = isSender ? friend.receiverName : friend.senderName;
                  const friendEmail = isSender ? friend.receiverEmail : friend.senderEmail;
                  
                  return (
                    <div key={friend.id} className="p-3 bg-white border-2 border-ac-brown rounded-2xl flex items-center justify-between shadow-ac-xs">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-ac-brown">🍃 {friendName}</span>
                        <span className="text-[9px] text-ac-brown-light">{friendEmail}</span>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Tableur Excel/CSV Export Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col h-[220px] justify-between">
          <div>
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-ac-green" /> Export Tableur
            </h3>
            <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-4">
              Télécharge l'historique complet de tes écritures sous la forme d'un fichier CSV optimisé pour Excel.
            </p>
          </div>
          <button
            onClick={handleCSVExport}
            className="w-full bg-ac-green text-white font-extrabold text-xs py-3 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer mt-auto"
          >
            Télécharger le fichier CSV (.csv)
          </button>
        </div>

        {/* Database backup Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col h-[220px] justify-between">
          <div>
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-2">
              <Download className="w-5 h-5 text-ac-gold" /> Sauvegarder la base
            </h3>
            <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-4">
              Exporte toutes tes tables Cloud dans un fichier JSON confidentiel pour sauvegarder ton île.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="w-full bg-white hover:bg-ac-cream border-3 border-ac-brown text-ac-brown font-extrabold text-xs py-3 rounded-2xl shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer mt-auto"
          >
            Exporter mes données (.json)
          </button>
        </div>

        {/* Restore backup Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col h-[220px] justify-between">
          <div>
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-2">
              <Upload className="w-5 h-5 text-ac-sky animate-pulse" /> Restaurer sauvegarde
            </h3>
            <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-2">
              Sélectionne un fichier de sauvegarde JSON pour restaurer ton île. <strong>Données écrasées !</strong>
            </p>
          </div>

          <div className="space-y-2 mt-auto">
            <label className="w-full bg-ac-sky-light text-ac-sky hover:bg-ac-sky/10 font-extrabold text-xs py-3 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Choisir une sauvegarde (.json)
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>

            {importStatus && (
              <div className={`text-[10px] font-bold px-2 py-1 rounded-xl border flex items-center gap-1.5 animate-bounce-in ${
                importStatus === 'success'
                  ? 'bg-ac-green-light text-ac-green border-ac-green/20'
                  : 'bg-ac-red-light text-ac-red border-ac-red/20'
              }`}>
                <span>{importMessage}</span>
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
