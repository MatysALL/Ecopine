import React, { useState, useEffect } from 'react';
import { db, useDb } from '../db';
import { 
  Download, Upload, Trash2, ShieldAlert, CheckCircle, AlertCircle, 
  User, Tag, Plus, FileSpreadsheet 
} from 'lucide-react';

export default function Settings() {
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState('');

  // Profile states
  const [username, setUsername] = useState('');
  const [favAccountId, setFavAccountId] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Custom Category states
  const [newCatName, setNewCatName] = useState('');

  const { 
    userMeta, 
    accountsData: accountsList, 
    categories: categoriesList,
    transactions: allTransactions,
    budgets: budgetsList,
    logOutUser
  } = useDb();

  // Initial load of metadata
  useEffect(() => {
    if (userMeta) {
      const nameMeta = userMeta.find(m => m.key === 'username');
      const favMeta = userMeta.find(m => m.key === 'favorite_account_id');
      setUsername(nameMeta?.value || '');
      setFavAccountId(favMeta?.value || '');
    }
  }, [userMeta]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      await db.user_meta.put({ key: 'username', value: username.trim() });
      await db.user_meta.put({ key: 'favorite_account_id', value: favAccountId });
      
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
        isDefault: 0
      });
      setNewCatName('');
    } catch (err) {
      console.error(err);
      alert("Impossible de créer la catégorie.");
    }
  };

  const handleDeleteCategory = async (catId) => {
    const cat = categoriesList?.find(c => c.id === catId);
    if (!cat || cat.isDefault) return;

    if (window.confirm(`Supprimer la catégorie "${cat.name}" ? Les transactions associées perdront leur étiquette de catégorie.`)) {
      await db.transaction('rw', db.categories, db.transactions, async () => {
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
        budgets: budgetsList,
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
        await db.transaction('rw', db.accounts, db.transactions, db.budgets, db.categories, db.user_meta, async () => {
          await db.accounts.clear();
          await db.transactions.clear();
          await db.budgets.clear();
          await db.categories.clear();
          await db.user_meta.clear();

          if (data.user_meta && data.user_meta.length > 0) await db.user_meta.bulkAdd(data.user_meta);
          if (data.accounts.length > 0) await db.accounts.bulkAdd(data.accounts);
          if (data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions);
          if (data.budgets && data.budgets.length > 0) await db.budgets.bulkAdd(data.budgets);
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

    await db.transaction('rw', db.accounts, db.transactions, db.budgets, db.categories, db.user_meta, async () => {
      await db.accounts.clear();
      await db.transactions.clear();
      await db.budgets.clear();
      await db.categories.clear();
      await db.user_meta.clear();
      
      // Re-populate default categories
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
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                  required
                />
              </div>

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
                  onClick={handleLogout}
                  className="bg-ac-red text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl border-2 border-ac-brown shadow-ac-sm hover:translate-y-[1px] cursor-pointer"
                >
                  Se déconnecter
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

        {/* Categories Editor Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-ac-brown flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-ac-gold" /> Gestion des Catégories
            </h3>
            
            {/* Form to add custom category */}
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4 bg-ac-cream p-2.5 rounded-2xl border-2 border-ac-brown">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nouvelle catégorie..."
                className="w-full bg-white border-2 border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
                required
              />
              <button 
                type="submit" 
                className="bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Créer
              </button>
            </form>

            {/* List of categories */}
            <div className="max-h-36 overflow-y-auto border border-ac-brown/10 rounded-xl divide-y divide-ac-brown/10 bg-white p-2">
              {categoriesList?.map(cat => (
                <div key={cat.id} className="py-2.5 flex justify-between items-center text-xs px-2">
                  <span className="font-extrabold">{cat.name}</span>
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
