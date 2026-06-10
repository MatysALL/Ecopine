import React, { useState } from 'react';
import { db, seedDatabase } from '../db';
import { Download, Upload, Trash2, ShieldAlert, CheckCircle, AlertCircle } from 'lucide-react';

export default function Settings() {
  const [importStatus, setImportStatus] = useState(null); // 'success' or 'error'
  const [importMessage, setImportMessage] = useState('');

  const handleExport = async () => {
    try {
      const data = {
        accounts: await db.accounts.toArray(),
        transactions: await db.transactions.toArray(),
        envelopes: await db.envelopes.toArray(),
        budgets: await db.budgets.toArray()
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

        // Simple schema validation
        if (!data || typeof data !== 'object') {
          throw new Error("Format JSON invalide.");
        }

        const requiredTables = ['accounts', 'transactions', 'envelopes'];
        for (const table of requiredTables) {
          if (!data[table] || !Array.isArray(data[table])) {
            throw new Error(`Données manquantes ou invalides pour la table '${table}'.`);
          }
        }

        const confirmOverwrite = window.confirm(
          "Attention : Importer ce fichier écrasera toutes tes données actuelles de l'application Ecopine. Continuer ?"
        );
        if (!confirmOverwrite) return;

        // Perform import by clearing tables and bulk-adding
        await db.transaction('rw', db.accounts, db.transactions, db.envelopes, db.budgets, async () => {
          await db.accounts.clear();
          await db.transactions.clear();
          await db.envelopes.clear();
          await db.budgets.clear();

          if (data.accounts.length > 0) await db.accounts.bulkAdd(data.accounts);
          if (data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions);
          if (data.envelopes.length > 0) await db.envelopes.bulkAdd(data.envelopes);
          if (data.budgets && data.budgets.length > 0) {
            await db.budgets.bulkAdd(data.budgets);
          }
        });

        setImportStatus('success');
        setImportMessage("Base de données restaurée avec succès !");
      } catch (err) {
        console.error(err);
        setImportStatus('error');
        setImportMessage(`Échec de la restauration : ${err.message}`);
      }
    };
    reader.readAsText(file);
    // Reset file input value so import can be re-run on same file if needed
    e.target.value = '';
  };

  const handleReset = async () => {
    const confirmWipe = window.confirm(
      "ATTENTION : Es-tu absolument sûr de vouloir réinitialiser l'application ? Tout ton historique de clochettes sera effacé définitivement."
    );
    if (!confirmWipe) return;

    await db.transaction('rw', db.accounts, db.transactions, db.envelopes, db.budgets, async () => {
      await db.accounts.clear();
      await db.transactions.clear();
      await db.envelopes.clear();
      await db.budgets.clear();
    });

    // Re-seed demo data so the app is not empty
    await seedDatabase();
    alert("Application réinitialisée avec les données de démonstration !");
    window.location.reload();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            Paramètres & Confidentialité
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Ecopine est 100% locale : aucune donnée ne quitte ton navigateur. Sauvegarde tes clochettes ici.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Backup Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-ac-brown flex items-center gap-2 mb-2">
              <Download className="w-5 h-5 text-ac-green" /> Sauvegarder & Exporter
            </h3>
            <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-6">
              Télécharge une copie complète de tes comptes, enveloppes et transactions sous la forme d'un fichier JSON confidentiel. Tu pourras ensuite le restaurer sur n'importe quel ordinateur.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="w-full bg-ac-green text-white font-extrabold text-sm py-3 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
          >
            Exporter mes données (.json)
          </button>
        </div>

        {/* Restore Card */}
        <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-ac-brown flex items-center gap-2 mb-2">
              <Upload className="w-5 h-5 text-ac-gold" /> Restaurer une sauvegarde
            </h3>
            <p className="text-xs font-semibold text-ac-brown-light leading-relaxed mb-6">
              Sélectionne un fichier de sauvegarde JSON précédemment exporté depuis Ecopine pour restaurer ton île financière. <strong>Attention : tes données actuelles seront remplacées.</strong>
            </p>
          </div>

          <div className="space-y-4">
            <label className="w-full bg-white text-ac-brown hover:bg-ac-cream font-extrabold text-sm py-3 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-ac-brown-light" />
              Choisir un fichier de sauvegarde
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>

            {importStatus && (
              <div className={`text-xs font-bold px-3 py-2.5 rounded-xl border flex items-center gap-2 animate-bounce-in ${
                importStatus === 'success'
                  ? 'bg-ac-green-light text-ac-green border-ac-green/20'
                  : 'bg-ac-red-light text-ac-red border-ac-red/20'
              }`}>
                {importStatus === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
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
          Si tu rencontres des soucis ou si tu souhaites effacer tout ton historique pour repartir de zéro. Cette opération remettra les données de démonstration par défaut et effacera ton carnet actuel.
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
