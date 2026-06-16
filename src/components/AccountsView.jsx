import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAccountBalance, getAccountVisibleBalance, calculateLivretInterests } from '../db';
import { 
  Plus, Edit, Trash2, ArrowLeft, Upload, FileText, CheckCircle, 
  Coins, PiggyBank, Briefcase, HelpCircle, Save, Info, AlertTriangle, 
  Landmark, CreditCard, Sparkles, FileSpreadsheet, X, ArrowRightLeft
} from 'lucide-react';
import TransactionModal from './TransactionModal';
import BudgetManager from './BudgetManager';

export default function AccountsView({ selectedAccountId, setSelectedAccountId }) {
  // Account Form states
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('Courant');
  const [accBankName, setAccBankName] = useState('');
  const [accDescription, setAccDescription] = useState('');
  const [accRib, setAccRib] = useState('');
  const [accInitial, setAccInitial] = useState('');
  const [accRate, setAccRate] = useState('');

  // Transaction Modal state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [preselectedBudgetId, setPreselectedBudgetId] = useState(null);

  // Transfer Modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState('');
  const [transferDestId, setTransferDestId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');

  // CSV Dropzone state
  const [isDragActive, setIsDragActive] = useState(false);
  const [csvPreviewTxs, setCsvPreviewTxs] = useState(null);
  const [csvError, setCsvError] = useState('');

  // Fetch accounts with both real and visible balances
  const accounts = useLiveQuery(async () => {
    const list = await db.accounts.toArray();
    return Promise.all(
      list.map(async (acc) => {
        const bal = await getAccountBalance(acc.id);
        const visBal = await getAccountVisibleBalance(acc.id);
        return { ...acc, balance: bal, visibleBalance: visBal };
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

  // Fetch live interest simulation for booklet accounts
  const activeAccountInterests = useLiveQuery(async () => {
    if (!activeAccount) return null;
    const isLivret = activeAccount.type && activeAccount.type.toLowerCase() !== 'courant';
    if (!isLivret || Number(activeAccount.rate) <= 0) return null;

    const txs = await db.transactions
      .where('accountId')
      .equals(activeAccount.id)
      .toArray();

    const todayStr = new Date().toISOString().split('T')[0];
    return calculateLivretInterests(activeAccount, txs, todayStr);
  }, [activeAccount]);

  // Handle Account Form Submit
  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!accName || !accInitial) return;

    const initial = parseFloat(accInitial);
    const rate = accRate ? parseFloat(accRate) : 0;

    const data = {
      name: accName.trim(),
      type: accType,
      bankName: accBankName.trim(),
      description: accDescription.trim(),
      rib: accRib.trim(),
      initialBalance: isNaN(initial) ? 0 : initial,
      rate: isNaN(rate) ? 0 : rate
    };

    if (editingAccount) {
      await db.accounts.update(editingAccount.id, data);
      setEditingAccount(null);
    } else {
      const newId = await db.accounts.add({
        ...data,
        currentBalance: data.initialBalance
      });
      setSelectedAccountId(newId);
    }

    setAccountFormOpen(false);
    resetAccountForm();
  };

  const resetAccountForm = () => {
    setAccName('');
    setAccType('Courant');
    setAccBankName('');
    setAccDescription('');
    setAccRib('');
    setAccInitial('');
    setAccRate('');
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferSourceId || !transferDestId || !transferAmount) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (transferSourceId === transferDestId) {
      alert("Le compte source et le compte destination doivent être différents.");
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Veuillez entrer un montant valide supérieur à 0.");
      return;
    }

    const sourceAccount = accounts.find(a => a.id === Number(transferSourceId));
    const destAccount = accounts.find(a => a.id === Number(transferDestId));

    if (!sourceAccount || !destAccount) {
      alert("Comptes introuvables.");
      return;
    }

    const desc = transferDesc.trim() || 'Virement';
    const dateStr = new Date().toISOString().split('T')[0];

    const sourceTx = {
      accountId: Number(transferSourceId),
      name: `Virement vers ${destAccount.name} : ${desc}`,
      description: `Virement vers ${destAccount.name} : ${desc}`,
      amount: amount,
      type: 'debit',
      date: dateStr,
      categoryId: null,
      category: 'Virement',
      executionType: 'spontaneous',
      isRecurring: false,
      recurrencePeriod: 'none',
      recurrenceEnd: ''
    };

    const destTx = {
      accountId: Number(transferDestId),
      name: `Virement depuis ${sourceAccount.name} : ${desc}`,
      description: `Virement depuis ${sourceAccount.name} : ${desc}`,
      amount: amount,
      type: 'credit',
      date: dateStr,
      categoryId: null,
      category: 'Virement',
      executionType: 'spontaneous',
      isRecurring: false,
      recurrencePeriod: 'none',
      recurrenceEnd: ''
    };

    await db.transaction('rw', db.transactions, async () => {
      await db.transactions.add(sourceTx);
      await db.transactions.add(destTx);
    });

    setTransferModalOpen(false);
    resetTransferForm();
  };

  const resetTransferForm = () => {
    setTransferSourceId('');
    setTransferDestId('');
    setTransferAmount('');
    setTransferDesc('');
  };

  const handleEditAccount = (acc) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type || 'Courant');
    setAccBankName(acc.bankName || '');
    setAccDescription(acc.description || '');
    setAccRib(acc.rib || '');
    setAccInitial(acc.initialBalance.toString());
    setAccRate(acc.rate ? acc.rate.toString() : '');
    setAccountFormOpen(true);
  };

  const handleDeleteAccount = async (accId) => {
    const confirmDelete = window.confirm(
      "Es-tu sûr de vouloir supprimer ce compte ? Cela supprimera également toutes ses transactions et budgets liés."
    );
    if (!confirmDelete) return;

    await db.accounts.delete(accId);
    await db.transactions.where('accountId').equals(accId).delete();
    await db.budgets.where('accountId').equals(accId).delete();
    setSelectedAccountId(null);
  };

  const handleAddTransactionFromBudget = (budgetId) => {
    setPreselectedBudgetId(budgetId);
    setEditingTransaction(null);
    setTxModalOpen(true);
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

  const handleExportCSV = () => {
    if (!transactions || transactions.length === 0) {
      alert("Aucune transaction à exporter pour ce compte.");
      return;
    }

    const headers = ["Date", "Description", "Categorie", "Montant", "Type"];
    
    const rows = transactions.map(t => [
      t.date,
      `"${(t.name || t.description || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.type
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const safeAccountName = (activeAccount?.name || 'compte').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const todayStr = new Date().toISOString().split('T')[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `export_transactions_${safeAccountName}_${todayStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      let delimiter = ',';
      if (lines[0].includes(';')) delimiter = ';';
      else if (lines[0].includes('\t')) delimiter = '\t';

      const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));
      
      const headers = rows[0].map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      
      let dateCol = headers.findIndex(h => h.includes('date') || h.includes('valeur'));
      let descCol = headers.findIndex(h => h.includes('description') || h.includes('libelle') || h.includes('communication') || h.includes('motif') || h.includes('details') || h.includes('nom'));
      let amountCol = headers.findIndex(h => h.includes('montant') || h.includes('somme') || h.includes('valeur') || h.includes('amount'));

      if (dateCol === -1 || amountCol === -1) {
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

      const parsedTransactions = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= Math.max(dateCol, amountCol, descCol)) continue;

        const rawDate = row[dateCol];
        const rawDesc = descCol !== -1 ? row[descCol] : 'Transaction Importée';
        const rawAmount = row[amountCol];

        const date = parseCSVDate(rawDate);
        const amount = parseCSVAmount(rawAmount);

        if (date && amount !== 0) {
          const isIncome = amount > 0;
          parsedTransactions.push({
            date,
            name: rawDesc || 'Transaction sans nom',
            description: rawDesc || 'Transaction sans nom',
            amount: Math.abs(amount),
            type: isIncome ? 'credit' : 'debit',
            category: 'Import CSV',
            categoryId: null,
            budgetId: null,
            executionType: 'spontaneous',
            isRecurring: false,
            recurrencePeriod: 'none',
            recurrenceEnd: ''
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
    <div className="space-y-8 select-none">
      {/* 1. Detail View of Account */}
      {selectedAccountId && activeAccount ? (
        <div className="space-y-8 animate-fade-in">
          {/* Header & Account info banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedAccountId(null)}
                className="bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-ac-brown" />
              </button>
              <div>
                <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
                  {activeAccount.name}
                  {activeAccount.bankName && (
                    <span className="text-xs font-black text-ac-brown-light bg-ac-cream px-2 py-0.5 rounded-md border border-ac-brown/15">
                      {activeAccount.bankName}
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-2 items-center text-xs font-bold text-ac-brown-light mt-1">
                  <span className="bg-ac-gold-light border border-ac-gold/30 text-ac-gold-dark px-2.5 py-0.5 rounded-full">
                    {activeAccount.type}
                  </span>
                  {activeAccount.rate > 0 && (
                    <span className="bg-ac-green-light border border-ac-green/20 text-ac-green px-2.5 py-0.5 rounded-full">
                      Taux: {activeAccount.rate}%
                    </span>
                  )}
                  {activeAccount.rib && (
                    <span className="bg-ac-cream-dark/40 px-2.5 py-0.5 rounded-full border border-ac-brown/10 font-mono text-[10px]">
                      RIB: {activeAccount.rib}
                    </span>
                  )}
                </div>
                {activeAccount.description && (
                  <p className="text-[11px] font-semibold text-ac-brown-light mt-2 italic">
                    "{activeAccount.description}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-left md:text-right bg-ac-cream-dark/20 border-2 border-ac-brown rounded-2xl px-6 py-2.5 min-w-[200px]">
                <span className="text-[9px] font-black text-ac-brown-light uppercase block">Solde Réel Principal</span>
                <span className="text-2xl font-black text-ac-brown">
                  {activeAccount.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                </span>
              </div>
              
              {activeAccount.balance !== activeAccount.visibleBalance && (
                <div className="text-left md:text-right bg-ac-gold-light/45 border-2 border-ac-gold rounded-2xl px-6 py-2.5 min-w-[200px] animate-bounce-in">
                  <span className="text-[9px] font-black text-ac-gold-dark uppercase block flex items-center justify-end gap-1">
                    Solde Disponible <Sparkles className="w-3 h-3 fill-ac-gold" />
                  </span>
                  <span className="text-2xl font-black text-ac-gold-dark">
                    {activeAccount.visibleBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Booklet interests calculation simulator */}
          {activeAccountInterests && (
            <div className="bg-ac-sky-light/40 border-3 border-ac-brown rounded-3xl p-5 shadow-ac-sm flex items-center justify-between gap-4 animate-bounce-in">
              <div className="space-y-1">
                <h4 className="font-black text-xs text-ac-brown flex items-center gap-1.5 uppercase">
                  <Landmark className="w-4 h-4 text-ac-sky" /> Simulation des Intérêts (Calcul par Quinzaine)
                </h4>
                <p className="text-[10px] font-semibold text-ac-brown-light">
                  Simulation selon les modalités annuelles standard françaises appliquées sur ce livret.
                </p>
              </div>

              <div className="flex gap-4">
                <div className="bg-white border-2 border-ac-brown rounded-xl px-4 py-2 text-center shadow-ac-sm">
                  <span className="text-[8px] font-black text-ac-brown-light uppercase block">Capitalisés (Années antérieures)</span>
                  <span className="text-sm font-black text-ac-brown">
                    +{activeAccountInterests.capitalized.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                  </span>
                </div>

                <div className="bg-white border-2 border-ac-brown rounded-xl px-4 py-2 text-center shadow-ac-sm">
                  <span className="text-[8px] font-black text-ac-sky uppercase block">Courus (Année en cours)</span>
                  <span className="text-sm font-black text-ac-sky">
                    +{activeAccountInterests.accrued.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Account Edit/Delete Controls */}
          <div className="flex gap-3">
            <button
              onClick={() => handleEditAccount(activeAccount)}
              className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer"
            >
              <Edit className="w-4 h-4" /> Modifier le Compte
            </button>
            <button
              onClick={() => handleDeleteAccount(activeAccount.id)}
              className="bg-ac-red-light hover:bg-ac-red/10 text-ac-red font-extrabold text-xs px-4 py-2.5 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 transition-transform active:translate-y-[1px] cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Supprimer le Compte
            </button>
          </div>

          {/* Nested Budget Section */}
          <BudgetManager accountId={activeAccount.id} onAddTransaction={handleAddTransactionFromBudget} />

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
              <div className="flex flex-wrap gap-3 self-start sm:self-auto">
                <button
                  onClick={handleExportCSV}
                  className="bg-white hover:bg-ac-cream text-ac-brown font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Exporter en CSV
                </button>
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setTxModalOpen(true);
                  }}
                  className="bg-ac-green text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Nouvelle Transaction
                </button>
              </div>
            </div>

            {/* CSV Synchro zone */}
            <div className="mb-6">
              <h4 className="text-xs font-black uppercase text-ac-brown-light mb-2 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Importation relevé bancaire (CSV)
              </h4>
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
                          <p className="font-extrabold text-ac-brown">{tx.name}</p>
                          <span className="text-[10px] font-bold text-ac-brown-light">{new Date(tx.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <span className={`font-black ${tx.type === 'credit' ? 'text-ac-green' : 'text-ac-brown'}`}>
                          {tx.type === 'credit' ? '+' : '-'}{tx.amount.toFixed(2)} 🔔
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
                      className="bg-white hover:bg-ac-cream border border-ac-brown text-ac-brown font-extrabold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleConfirmCSVImport}
                      className="bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown shadow-ac-sm flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
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
                Aucune clochette dépensée ou gagnée ici pour le moment ! Utilise le bouton ci-dessus pour ajouter ta première transaction. 🍃
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b-2 border-ac-brown text-ac-brown-light font-black text-xs uppercase">
                      <th className="pb-3 pt-2 pl-2">Date</th>
                      <th className="pb-3 pt-2">Nom</th>
                      <th className="pb-3 pt-2">Catégorie</th>
                      <th className="pb-3 pt-2">Exécution</th>
                      <th className="pb-3 pt-2 text-right">Montant</th>
                      <th className="pb-3 pt-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ac-cream-dark">
                    {transactions.map((tx) => {
                      const isIncome = tx.type === 'credit';
                      return (
                        <tr key={tx.id} className="hover:bg-ac-cream-light/35 transition-colors group">
                          <td className="py-3.5 pl-2 text-xs font-bold text-ac-brown-light">
                            {new Date(tx.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-3.5 font-extrabold text-sm text-ac-brown">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {tx.name || tx.description}
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
                          <td className="py-3.5">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
                              tx.executionType === 'planned' ? 'bg-ac-sky-light border-ac-sky/20 text-ac-sky' :
                              tx.executionType === 'past' ? 'bg-ac-cream-dark/55 border-ac-brown/15 text-ac-brown-light' :
                              'bg-ac-green-light border-ac-green/20 text-ac-green'
                            }`}>
                              {tx.executionType === 'planned' ? 'À prévoir' :
                               tx.executionType === 'past' ? 'Passée' : 'Spontanée'}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-black text-sm">
                            <span className={isIncome ? 'text-ac-green' : 'text-ac-brown'}>
                              {isIncome ? '+' : '-'}{tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                            </span>
                          </td>
                          <td className="py-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingTransaction(tx);
                                  setTxModalOpen(true);
                                }}
                                className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-transparent hover:border-ac-brown/25 cursor-pointer"
                                title="Modifier"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-1.5 hover:bg-ac-red-light rounded-lg text-ac-brown-light hover:text-ac-red border border-transparent hover:border-ac-brown/25 cursor-pointer"
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
              setPreselectedBudgetId(null);
            }}
            onSave={handleSaveTransaction}
            transaction={editingTransaction}
            accountId={selectedAccountId}
            preselectedBudgetId={preselectedBudgetId}
          />
        </div>
      ) : (
        // 2. Listing of all accounts
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div>
              <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
                <Coins className="w-6 h-6 text-ac-green" /> Gestion des comptes
              </h2>
              <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                Crée tes livrets d'épargne ou tes comptes courants pour visualiser tes finances.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTransferSourceId('');
                  setTransferDestId('');
                  setTransferAmount('');
                  setTransferDesc('');
                  setTransferModalOpen(true);
                }}
                className="bg-ac-gold text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto"
              >
                <ArrowRightLeft className="w-4 h-4" /> Faire un virement
              </button>
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setAccountFormOpen(true);
                }}
                className="bg-ac-green text-white font-extrabold text-sm px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Nouveau Compte
              </button>
            </div>
          </div>

          {/* Accounts Grid */}
          {!accounts ? (
            <div className="text-center py-6 text-ac-brown-light">Chargement...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light">
              <p className="font-extrabold mb-4">Tu n'as pas encore créé de compte ou de livret.</p>
              <p className="text-xs">Commence par créer ton compte courant principal en clicking sur "Nouveau Compte" ci-dessus !</p>
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

                    {acc.bankName && (
                      <span className="text-[9px] font-extrabold text-ac-brown-light block mt-2">
                        🏦 Banque : {acc.bankName}
                      </span>
                    )}

                    <div className="mt-4 flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-ac-brown-light uppercase block">Solde Réel</span>
                      <span className="text-xl font-black text-ac-brown">
                        {acc.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                      </span>
                      
                      {acc.balance !== acc.visibleBalance && (
                        <div className="mt-1 flex flex-col">
                          <span className="text-[8px] font-bold text-ac-gold-dark uppercase block flex items-center gap-1">
                            Solde Disponible <Sparkles className="w-2.5 h-2.5 fill-ac-gold text-ac-gold-dark" />
                          </span>
                          <span className="text-sm font-black text-ac-gold-dark">
                            {acc.visibleBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                          </span>
                        </div>
                      )}
                    </div>

                    {acc.rate > 0 && (
                      <div className="mt-3 text-[10px] font-bold text-ac-green bg-ac-green-light border border-ac-green/20 px-2 py-0.5 rounded-md inline-block">
                        Intérêts: {acc.rate}%
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-t-ac-brown/10 flex justify-between items-center text-[10px] font-black text-ac-brown-light group-hover:text-ac-brown transition-colors">
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

      {/* Account Creator Form (Modal Overlay) */}
      {accountFormOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-2xl w-full shadow-ac-lg relative animate-bounce-in">
            <button 
              type="button"
              onClick={() => {
                setAccountFormOpen(false);
                resetAccountForm();
              }}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-ac-brown" />
            </button>

            <h3 className="text-xl font-black text-ac-brown mb-6 flex items-center gap-1.5 border-b border-ac-brown/10 pb-4">
              {editingAccount ? 'Modifier le compte' : 'Créer un nouveau compte'}
            </h3>

            <form onSubmit={handleAccountSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du Compte *</label>
                  <input
                    type="text"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="Ex: Compte Courant Principal, Livret Clochettes"
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Type de Compte</label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value)}
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:bg-white animate-none"
                  >
                    <option value="Courant">Courant</option>
                    <option value="Livret A">Livret A</option>
                    <option value="LDDS">LDDS</option>
                    <option value="PEA">PEA</option>
                    <option value="Autre">Autre Épargne (Livret)</option>
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
                      className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-black">🔔</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom de la Banque</label>
                  <input
                    type="text"
                    value={accBankName}
                    onChange={(e) => setAccBankName(e.target.value)}
                    placeholder="Ex: Banque Nook"
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Description</label>
                  <input
                    type="text"
                    value={accDescription}
                    onChange={(e) => setAccDescription(e.target.value)}
                    placeholder="Ex: Compte pour les dépenses quotidiennes de l'île"
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Taux d'Intérêt % (Livrets)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={accRate}
                    onChange={(e) => setAccRate(e.target.value)}
                    placeholder="Ex: 3.0"
                    disabled={accType === 'Courant'}
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white disabled:opacity-55"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Numéro RIB / Compte</label>
                <input
                  type="text"
                  value={accRib}
                  onChange={(e) => setAccRib(e.target.value)}
                  placeholder="Ex: FR76 1234 5678 9012 3456 7890 123"
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white font-mono"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => {
                    setAccountFormOpen(false);
                    resetAccountForm();
                  }}
                  className="flex-1 bg-white hover:bg-ac-cream text-ac-brown py-3 rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm active:translate-y-1 active:shadow-none cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ac-green text-white py-3 rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm active:translate-y-1 active:shadow-none cursor-pointer"
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal Overlay */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button 
              type="button"
              onClick={() => {
                setTransferModalOpen(false);
                resetTransferForm();
              }}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-ac-brown" />
            </button>

            <h3 className="text-xl font-black text-ac-brown mb-6 flex items-center gap-1.5 border-b border-ac-brown/10 pb-4">
              <ArrowRightLeft className="w-5 h-5 text-ac-gold" /> Faire un virement
            </h3>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              {/* Source Account */}
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Compte Source *</label>
                <select
                  value={transferSourceId}
                  onChange={(e) => setTransferSourceId(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                  required
                >
                  <option value="">-- Choisir le compte source --</option>
                  {accounts?.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.visibleBalance.toLocaleString('fr-FR')} 🔔 dispo)
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Account */}
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Compte Destination *</label>
                <select
                  value={transferDestId}
                  onChange={(e) => setTransferDestId(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                  required
                >
                  <option value="">-- Choisir le compte destination --</option>
                  {accounts?.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.visibleBalance.toLocaleString('fr-FR')} 🔔 dispo)
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount and Description */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant (Clochettes) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                      required
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-black">🔔</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Description / Motif</label>
                  <input
                    type="text"
                    value={transferDesc}
                    onChange={(e) => setTransferDesc(e.target.value)}
                    placeholder="Ex: Épargne mensuelle, remboursement..."
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    resetTransferForm();
                  }}
                  className="flex-1 bg-white hover:bg-ac-cream text-ac-brown py-3 rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm active:translate-y-1 active:shadow-none cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ac-green text-white py-3 rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm active:translate-y-1 active:shadow-none cursor-pointer"
                >
                  Transférer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
