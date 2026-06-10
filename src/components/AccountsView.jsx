import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAccountBalance } from '../db';
import { 
  Plus, Edit, Trash2, ArrowLeft, Upload, FileText, CheckCircle, 
  Coins, PiggyBank, Briefcase, HelpCircle, Save, Info, AlertTriangle 
} from 'lucide-react';
import TransactionModal from './TransactionModal';
import EnvelopeManager from './EnvelopeManager';

export default function AccountsView({ selectedAccountId, setSelectedAccountId }) {
  // Account Form states
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('Courant');
  const [accInitial, setAccInitial] = useState('');
  const [accRate, setAccRate] = useState('');

  // Transaction Modal state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // CSV Dropzone state
  const [isDragActive, setIsDragActive] = useState(false);
  const [csvPreviewTxs, setCsvPreviewTxs] = useState(null);
  const [csvError, setCsvError] = useState('');

  // Fetch accounts with their live balance
  const accounts = useLiveQuery(async () => {
    const list = await db.accounts.toArray();
    return Promise.all(
      list.map(async (acc) => {
        const bal = await getAccountBalance(acc.id);
        return { ...acc, balance: bal };
      })
    );
  });

  // Fetch transactions for the active account
  const activeAccount = accounts?.find(a => a.id === selectedAccountId);
  const transactions = useLiveQuery(() => {
    if (!selectedAccountId) return [];
    return db.transactions
      .where('accountId')
      .equals(Number(selectedAccountId))
      .reverse()
      .sortBy('date');
  }, [selectedAccountId]);

  // Handle Account Form Submit
  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!accName || !accInitial) return;

    const initial = parseFloat(accInitial);
    const rate = accRate ? parseFloat(accRate) : 0;

    const data = {
      name: accName,
      type: accType,
      initialBalance: isNaN(initial) ? 0 : initial,
      rate: isNaN(rate) ? 0 : rate
    };

    if (editingAccount) {
      await db.accounts.update(editingAccount.id, data);
      setEditingAccount(null);
    } else {
      const newId = await db.accounts.add(data);
      setSelectedAccountId(newId);
    }

    setAccountFormOpen(false);
    resetAccountForm();
  };

  const resetAccountForm = () => {
    setAccName('');
    setAccType('Courant');
    setAccInitial('');
    setAccRate('');
  };

  const handleEditAccount = (acc) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccInitial(acc.initialBalance.toString());
    setAccRate(acc.rate ? acc.rate.toString() : '');
    setAccountFormOpen(true);
  };

  const handleDeleteAccount = async (accId) => {
    const confirmDelete = window.confirm(
      "Es-tu sûr de vouloir supprimer ce compte ? Cela supprimera également toutes ses transactions et enveloppes liées."
    );
    if (!confirmDelete) return;

    await db.accounts.delete(accId);
    await db.transactions.where('accountId').equals(accId).delete();
    await db.envelopes.where('accountId').equals(accId).delete();
    setSelectedAccountId(null);
  };

  // Transaction CRUD handlers
  const handleSaveTransaction = async (txData) => {
    if (editingTransaction) {
      await db.transactions.update(editingTransaction.id, txData);
    } else {
      await db.transactions.add(txData);
    }
    setTxModalOpen(false);
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = async (txId) => {
    if (window.confirm("Supprimer cette transaction ?")) {
      await db.transactions.delete(txId);
    }
  };

  // CSV Drag and Drop Parser
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  const parseCSVDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.trim().split(/[./-]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) { // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) { // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch (e) {}
    return dateStr;
  };

  const parseCSVAmount = (amountStr) => {
    if (!amountStr) return 0;
    // Replace French space separator, convert comma decimal to dot, remove Euro sign
    let clean = amountStr.replace(/\s/g, '').replace(',', '.').replace('€', '').trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const processCSVFile = (file) => {
    setCsvError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length < 2) {
        setCsvError("Le fichier CSV est vide ou ne contient pas assez de données.");
        return;
      }

      // Delimiter detection
      let delimiter = ',';
      if (lines[0].includes(';')) delimiter = ';';
      else if (lines[0].includes('\t')) delimiter = '\t';

      const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));
      
      // Heuristic mapping
      const headers = rows[0].map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      
      let dateCol = headers.findIndex(h => h.includes('date') || h.includes('valeur'));
      let descCol = headers.findIndex(h => h.includes('description') || h.includes('libelle') || h.includes('communication') || h.includes('motif') || h.includes('details'));
      let amountCol = headers.findIndex(h => h.includes('montant') || h.includes('somme') || h.includes('valeur') || h.includes('amount'));

      // If headers not found, fall back to checking first data row types
      if (dateCol === -1 || descCol === -1 || amountCol === -1) {
        const testRow = rows[1];
        if (testRow) {
          testRow.forEach((cell, idx) => {
            if (dateCol === -1 && (cell.includes('/') || cell.includes('-')) && cell.length >= 8) {
              dateCol = idx;
            } else if (amountCol === -1 && !isNaN(parseFloat(cell.replace(',', '.')))) {
              amountCol = idx;
            } else if (descCol === -1 && cell.length > 3 && isNaN(parseFloat(cell))) {
              descCol = idx;
            }
          });
        }
      }

      if (dateCol === -1 || amountCol === -1) {
        setCsvError("Impossible de détecter automatiquement les colonnes de Date ou de Montant.");
        return;
      }

      // Parse data rows
      const parsedTransactions = [];
      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= Math.max(dateCol, amountCol, descCol)) continue;

        const rawDate = row[dateCol];
        const rawDesc = descCol !== -1 ? row[descCol] : 'Transaction Importée';
        const rawAmount = row[amountCol];

        const date = parseCSVDate(rawDate);
        const amount = parseCSVAmount(rawAmount);

        if (date && amount !== 0) {
          parsedTransactions.push({
            date,
            description: rawDesc || 'Transaction sans nom',
            amount,
            category: 'Import CSV',
            isRecurring: false,
            recurrencePeriod: 'none'
          });
        }
      }

      if (parsedTransactions.length === 0) {
        setCsvError("Aucune transaction valide n'a pu être lue dans le fichier.");
      } else {
        setCsvPreviewTxs(parsedTransactions);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmCSVImport = async () => {
    if (!csvPreviewTxs || !selectedAccountId) return;
    
    const preparedTxs = csvPreviewTxs.map(tx => ({
      ...tx,
      accountId: Number(selectedAccountId)
    }));

    await db.transactions.bulkAdd(preparedTxs);
    setCsvPreviewTxs(null);
    alert(`${preparedTxs.length} transactions importées avec succès !`);
  };

  return (
    <div className="space-y-8">
      {/* 1. Detail View of Account */}
      {selectedAccountId && activeAccount ? (
        <div className="space-y-8">
          {/* Header & Account info banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedAccountId(null)}
                className="bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-ac-brown" />
              </button>
              <div>
                <h2 className="text-2xl font-black text-ac-brown">{activeAccount.name}</h2>
                <div className="flex gap-2 items-center text-xs font-bold text-ac-brown-light mt-1">
                  <span className="bg-ac-gold-light border border-ac-gold/30 text-ac-gold-dark px-2.5 py-0.5 rounded-full">
                    {activeAccount.type}
                  </span>
                  {activeAccount.rate > 0 && (
                    <span className="bg-ac-green-light border border-ac-green/20 text-ac-green px-2.5 py-0.5 rounded-full">
                      Taux: {activeAccount.rate}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-left md:text-right bg-ac-cream-dark/20 border-2 border-ac-brown rounded-2xl px-6 py-3 min-w-[200px]">
              <span className="text-[10px] font-bold text-ac-brown-light uppercase block">Solde Actuel Réel</span>
              <span className="text-3xl font-black text-ac-brown">
                {activeAccount.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
              </span>
            </div>
          </div>

          {/* Account Edit/Delete Controls */}
          <div className="flex gap-3">
            <button
              onClick={() => handleEditAccount(activeAccount)}
              className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px]"
            >
              <Edit className="w-4 h-4" /> Modifier le Compte
            </button>
            <button
              onClick={() => handleDeleteAccount(activeAccount.id)}
              className="bg-ac-red-light hover:bg-ac-red/10 text-ac-red font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px]"
            >
              <Trash2 className="w-4 h-4" /> Supprimer le Compte
            </button>
          </div>

          {/* Envelope Section Component */}
          {activeAccount.type === 'Courant' && (
            <EnvelopeManager accountId={activeAccount.id} />
          )}

          {/* Transactions CRUD Card */}
          <div className="ac-card p-6 bg-white border-ac-brown">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-ac-brown/10 pb-4">
              <div>
                <h3 className="text-lg font-black text-ac-brown">
                  Transactions de ce compte
                </h3>
                <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                  Visualise, ajoute ou modifie tes écritures comptables.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setTxModalOpen(true);
                }}
                className="bg-ac-green text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Nouvelle Transaction
              </button>
            </div>

            {/* CSV Synchro zone */}
            <div className="mb-6">
              <h4 className="text-xs font-black uppercase text-ac-brown-light mb-2">Importation relevé bancaire (CSV)</h4>
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-3 border-dashed rounded-2xl p-6 text-center transition-colors flex flex-col items-center justify-center cursor-pointer select-none ${
                  isDragActive 
                    ? 'border-ac-green bg-ac-green-light/40' 
                    : 'border-ac-brown/20 bg-ac-cream/20 hover:bg-ac-cream/40'
                }`}
              >
                <Upload className="w-8 h-8 text-ac-brown-light mb-2" />
                <p className="text-xs font-bold text-ac-brown">
                  Dépose ton fichier CSV bancaire ici ou <label className="text-ac-green underline cursor-pointer">recherche un fichier<input type="file" accept=".csv" className="hidden" onChange={handleFileInput} /></label>
                </p>
                <p className="text-[10px] text-ac-brown-light mt-1">
                  Les colonnes Date, Description et Montant seront détectées automatiquement.
                </p>
              </div>

              {csvError && (
                <div className="mt-2 text-xs font-bold text-ac-red bg-ac-red-light px-3 py-2 rounded-xl border border-ac-red/25 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {csvError}
                </div>
              )}

              {/* CSV Preview panel */}
              {csvPreviewTxs && (
                <div className="mt-4 bg-ac-cream-light/60 border-2 border-ac-brown rounded-2xl p-4 animate-bounce-in space-y-4">
                  <h5 className="font-extrabold text-xs text-ac-brown flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-ac-gold" /> Aperçu de l'importation ({csvPreviewTxs.length} transactions détectées)
                  </h5>
                  <div className="max-h-60 overflow-y-auto border border-ac-brown/10 rounded-xl divide-y divide-ac-brown/10 bg-white">
                    {csvPreviewTxs.slice(0, 10).map((tx, idx) => (
                      <div key={idx} className="p-3 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-extrabold text-ac-brown">{tx.description}</p>
                          <span className="text-[10px] font-bold text-ac-brown-light">{new Date(tx.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <span className={`font-black ${tx.amount > 0 ? 'text-ac-green' : 'text-ac-brown'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} 🔔
                        </span>
                      </div>
                    ))}
                    {csvPreviewTxs.length > 10 && (
                      <div className="p-2 text-center text-[10px] font-bold text-ac-brown-light italic">
                        Et {csvPreviewTxs.length - 10} autres transactions...
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button 
                      onClick={() => setCsvPreviewTxs(null)}
                      className="bg-white hover:bg-ac-cream border border-ac-brown text-ac-brown font-extrabold text-xs px-3 py-1.5 rounded-xl"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleConfirmCSVImport}
                      className="bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown shadow-ac-sm flex items-center gap-1.5 hover:translate-y-[1px]"
                    >
                      <CheckCircle className="w-4 h-4" /> Importer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Transactions List */}
            {transactions === undefined ? (
              <div className="text-center py-6 text-ac-brown-light">Recalcul des transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 bg-ac-cream rounded-3xl border border-dashed border-ac-brown/20 text-ac-brown-light text-sm font-semibold">
                Aucune transaction sur ce compte. Ajoute une transaction manuellement ou via CSV !
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b-2 border-ac-brown text-ac-brown-light font-black text-xs uppercase">
                      <th className="pb-3 pt-2 pl-2">Date</th>
                      <th className="pb-3 pt-2">Description</th>
                      <th className="pb-3 pt-2">Catégorie</th>
                      <th className="pb-3 pt-2 text-right">Montant</th>
                      <th className="pb-3 pt-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ac-cream-dark">
                    {transactions.map((tx) => {
                      const isIncome = tx.amount > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-ac-cream-light/35 transition-colors group">
                          <td className="py-3.5 pl-2 text-xs font-bold text-ac-brown-light">
                            {new Date(tx.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-3.5 font-extrabold text-sm text-ac-brown">
                            <div className="flex items-center gap-1.5">
                              {tx.description}
                              {tx.isRecurring && (
                                <span className="text-[9px] font-black bg-ac-gold-light border border-ac-gold/20 text-ac-gold-dark px-1.5 py-0.2 rounded" title="Transaction récurrente">
                                  ♻️ {tx.recurrencePeriod === 'weekly' ? 'Hebdo' : 'Mensuel'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5">
                            {tx.category ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-ac-green-light text-ac-green border border-ac-green/10">
                                {tx.category}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-ac-cream-dark/50 text-ac-brown-light">
                                Aucun
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-right font-black text-sm">
                            <span className={isIncome ? 'text-ac-green' : 'text-ac-brown'}>
                              {isIncome ? '+' : ''}{tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                            </span>
                          </td>
                          <td className="py-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingTransaction(tx);
                                  setTxModalOpen(true);
                                }}
                                className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-transparent hover:border-ac-brown/25"
                                title="Modifier"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-1.5 hover:bg-ac-red-light rounded-lg text-ac-brown-light hover:text-ac-red border border-transparent hover:border-ac-brown/25"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal to add/edit transaction */}
          <TransactionModal
            isOpen={txModalOpen}
            onClose={() => {
              setTxModalOpen(false);
              setEditingTransaction(null);
            }}
            onSave={handleSaveTransaction}
            transaction={editingTransaction}
            accountId={selectedAccountId}
          />
        </div>
      ) : (
        // 2. Listing of all accounts
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div>
              <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
                <Coins className="w-6 h-6 text-ac-green" /> Gestion des Comptes & Livrets
              </h2>
              <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                Crée tes livrets d'épargne ou tes comptes courants pour visualiser tes finances.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingAccount(null);
                setAccountFormOpen(!accountFormOpen);
              }}
              className="bg-ac-green text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Nouveau Compte
            </button>
          </div>

          {/* Account Creator Form */}
          {accountFormOpen && (
            <form onSubmit={handleAccountSubmit} className="bg-white border-3 border-ac-brown rounded-3xl p-6 space-y-4 shadow-ac-sm animate-bounce-in">
              <h3 className="text-lg font-black text-ac-brown border-b border-ac-brown/10 pb-2 flex items-center gap-1.5">
                {editingAccount ? 'Modifier le compte' : 'Créer un nouveau compte'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du Compte *</label>
                  <input
                    type="text"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="Ex: Compte Courant Principal, Livret Clochettes"
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Type de Compte</label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value)}
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                  >
                    <option value="Courant">Courant</option>
                    <option value="Livret A">Livret A</option>
                    <option value="LDDS">LDDS</option>
                    <option value="PEA">PEA</option>
                    <option value="Autre">Autre Épargne</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Solde Initial *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={accInitial}
                      onChange={(e) => setAccInitial(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-black">🔔</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Taux d'Intérêt % (Opt.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={accRate}
                    onChange={(e) => setAccRate(e.target.value)}
                    placeholder="Ex: 3.0"
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccountFormOpen(false);
                    resetAccountForm();
                  }}
                  className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-sm px-4 py-2 rounded-2xl border border-ac-brown shadow-ac-sm transition-transform active:translate-y-[1px]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-ac-green text-white font-extrabold text-sm px-4 py-2 rounded-2xl border-2 border-ac-brown shadow-ac-sm transition-transform active:translate-y-[1px]"
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          )}

          {/* Accounts Grid */}
          {!accounts ? (
            <div className="text-center py-6 text-ac-brown-light">Chargement...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light">
              <p className="font-extrabold mb-4">Tu n'as pas encore créé de compte ou de livret.</p>
              <p className="text-xs">Commence par créer ton compte courant principal en cliquant sur "Nouveau Compte" ci-dessus !</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map((acc) => {
                const isCurrent = acc.type === 'Courant';
                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`ac-card p-6 cursor-pointer border-ac-brown select-none relative group overflow-hidden ${
                      isCurrent ? 'bg-ac-gold-light' : 'bg-white'
                    }`}
                  >
                    {/* Corner badge for Type */}
                    <div className="absolute top-0 right-0 bg-ac-brown border-l-2 border-b-2 border-ac-brown rounded-bl-xl px-2.5 py-0.5 text-[10px] font-black text-white">
                      {acc.type}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-ac-brown shadow-ac-sm ${
                        isCurrent ? 'bg-ac-gold text-white' : 'bg-ac-sky text-white'
                      }`}>
                        {isCurrent ? <Coins className="w-5 h-5" /> : <PiggyBank className="w-5 h-5" />}
                      </div>
                      <h3 className="font-black text-base text-ac-brown">{acc.name}</h3>
                    </div>

                    <div className="mt-6">
                      <span className="text-[10px] font-bold text-ac-brown-light uppercase block">Solde Actuel</span>
                      <span className="text-2xl font-black text-ac-brown">
                        {acc.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                      </span>
                    </div>

                    {acc.rate > 0 && (
                      <div className="mt-3 text-[10px] font-bold text-ac-green bg-ac-green-light border border-ac-green/20 px-2 py-0.5 rounded-md inline-block">
                        Intérêts: {acc.rate}%
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-ac-brown/10 flex justify-between items-center text-[10px] font-black text-ac-brown-light group-hover:text-ac-brown transition-colors">
                      <span>Détail et transactions</span>
                      <ArrowLeft className="w-3.5 h-3.5 transform rotate-180 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
