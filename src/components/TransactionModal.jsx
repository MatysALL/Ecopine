import React, { useState, useEffect, useMemo } from 'react';
import { X, Layers } from 'lucide-react';
import { useDb } from '../db';
import { auth } from '../firebase';

export default function TransactionModal({ isOpen, onClose, onSave, transaction, accountId }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('expense'); // 'expense' or 'income'
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [executionType, setExecutionType] = useState('spontaneous'); // 'spontaneous', 'already_executed', 'forecast'
  const [pocketId, setPocketId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { pockets: allPockets, accountsData: accounts, user } = useDb();

  // Filter pockets for this account
  const pocketsList = useMemo(() => {
    if (!accountId || !allPockets) return [];
    return allPockets.filter(p => p.accountId === accountId);
  }, [allPockets, accountId]);

  useEffect(() => {
    if (transaction) {
      setName(transaction.name || transaction.label || transaction.description || '');
      const isIncome = transaction.type === 'income' || transaction.type === 'credit';
      setType(isIncome ? 'income' : 'expense');
      setAmount(Math.abs(transaction.amount).toString() || '');
      setDate(transaction.date || '');
      setPocketId(transaction.pocketId ? transaction.pocketId.toString() : '');
      const initialExec = transaction.executionType || (transaction.isPlanned ? 'forecast' : (transaction.isPast ? 'already_executed' : 'spontaneous'));
      setExecutionType(initialExec === 'planned' ? 'forecast' : (initialExec === 'past' ? 'already_executed' : initialExec));
    } else {
      setName('');
      setType('expense');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setExecutionType('spontaneous');
      setPocketId('');
    }
    setIsSubmitting(false);
  }, [transaction, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !amount || !date || isSubmitting) {
      alert('Veuillez remplir les champs obligatoires (Nom, Montant, Date).');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Veuillez entrer un montant valide supérieur à 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetAccount = (accounts || []).find(a => a.id === accountId);
      const currentUid = user?.uid || auth.currentUser?.uid;
      const allowedUsers = targetAccount?.allowedUsers && targetAccount.allowedUsers.length > 0 
        ? targetAccount.allowedUsers 
        : (currentUid ? [currentUid] : []);

      const transactionData = {
        accountId: accountId,
        name: name.trim(),
        description: name.trim(),
        amount: numAmount,
        type: type === 'income' ? 'credit' : 'debit',
        date,
        createdAt: transaction?.createdAt || new Date().toISOString(),
        executionType: executionType || 'spontaneous',
        importBatchId: transaction?.importBatchId || null,
        importFileName: transaction?.importFileName || null,
        pocketId: pocketId || null,
        projectId: targetAccount?.projectId || null,
        userId: transaction?.userId || currentUid,
        allowedUsers: allowedUsers
      };

      await onSave(transactionData);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in">
      <div className="bg-white border-t-4 border-x-4 md:border-4 border-ac-brown rounded-t-3xl md:rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-slide-up md:animate-bounce-in text-ac-brown select-none pb-safe-bottom">
        {/* Grab handle */}
        <div className="w-12 h-1.5 bg-ac-brown/20 rounded-full mx-auto mb-4 md:hidden shrink-0"></div>
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-colors z-10"
        >
          <X className="w-5 h-5 text-ac-brown" />
        </button>

        <h3 className="text-xl font-black text-ac-brown mb-6 flex items-center gap-2">
          {transaction ? 'Modifier la transaction' : 'Ajouter une transaction'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Type Toggle (Dépense / Revenu) */}
          <div className="flex border-2 border-ac-brown rounded-2xl overflow-hidden p-1 bg-ac-cream">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 h-12 flex items-center justify-center font-black text-sm rounded-xl transition-all ${
                type === 'expense'
                  ? 'bg-ac-red text-white border-2 border-ac-brown shadow-ac-sm'
                  : 'text-ac-brown hover:bg-white/40'
              }`}
            >
              Dépense (-)
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 h-12 flex items-center justify-center font-black text-sm rounded-xl transition-all ${
                type === 'income'
                  ? 'bg-ac-green text-white border-2 border-ac-brown shadow-ac-sm'
                  : 'text-ac-brown hover:bg-white/40'
              }`}
            >
              Revenu (+)
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom de la transaction *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Baguette Magique, Vente de navets"
              className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold focus:outline-none focus:bg-white"
              required
            />
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant (en euros) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 text-sm font-bold focus:outline-none focus:bg-white"
                  required
                />
                <span className="absolute left-3 top-3.5 text-xs font-black">€</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 text-xs font-bold focus:outline-none focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Execution Type Selector */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1.5 flex items-center justify-between">
              <span>Statut d'exécution *</span>
              {executionType === 'spontaneous' && <span className="text-[10px] text-ac-green font-bold">🟢 Modifie immédiatement le solde</span>}
              {executionType === 'already_executed' && <span className="text-[10px] text-slate-500 font-bold">⚪ N'impacte pas le solde (Historique)</span>}
              {executionType === 'forecast' && <span className="text-[10px] text-sky-600 font-bold">⏳ S'active dès que la date est atteinte</span>}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setExecutionType('spontaneous')}
                className={`p-2.5 rounded-2xl border-2 text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  executionType === 'spontaneous'
                    ? 'bg-ac-green text-white border-ac-brown shadow-ac-xs scale-[1.02]'
                    : 'bg-ac-cream hover:bg-white text-ac-brown border-ac-brown/30'
                }`}
              >
                <span className="text-base">🟢</span>
                <span className="text-[11px] leading-tight text-center">Spontanée</span>
                <span className={`text-[8px] font-bold ${executionType === 'spontaneous' ? 'text-white/80' : 'text-ac-brown-light'}`}>
                  Défaut
                </span>
              </button>

              <button
                type="button"
                onClick={() => setExecutionType('already_executed')}
                className={`p-2.5 rounded-2xl border-2 text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  executionType === 'already_executed'
                    ? 'bg-slate-600 text-white border-ac-brown shadow-ac-xs scale-[1.02]'
                    : 'bg-ac-cream hover:bg-white text-ac-brown border-ac-brown/30'
                }`}
              >
                <span className="text-base">⚪</span>
                <span className="text-[11px] leading-tight text-center">Déjà exécutée</span>
                <span className={`text-[8px] font-bold ${executionType === 'already_executed' ? 'text-white/80' : 'text-ac-brown-light'}`}>
                  Neutre
                </span>
              </button>

              <button
                type="button"
                onClick={() => setExecutionType('forecast')}
                className={`p-2.5 rounded-2xl border-2 text-xs font-black flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  executionType === 'forecast'
                    ? 'bg-sky-600 text-white border-ac-brown shadow-ac-xs scale-[1.02]'
                    : 'bg-ac-cream hover:bg-white text-ac-brown border-ac-brown/30'
                }`}
              >
                <span className="text-base">⏳</span>
                <span className="text-[11px] leading-tight text-center">Prévision</span>
                <span className={`text-[8px] font-bold ${executionType === 'forecast' ? 'text-white/80' : 'text-ac-brown-light'}`}>
                  Planifiée
                </span>
              </button>
            </div>
          </div>

          {/* Pocket selection */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Associer à une Poche</label>
            <div className="relative">
              <select
                value={pocketId}
                onChange={(e) => setPocketId(e.target.value)}
                className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 text-sm font-bold focus:outline-none focus:bg-white appearance-none cursor-pointer"
              >
                <option value="">-- Aucune Poche liée --</option>
                {pocketsList.map(p => {
                  const pAmt = p.currentAmount !== undefined ? Number(p.currentAmount) : Number(p.allocatedAmount);
                  return (
                    <option key={p.id} value={p.id}>
                      🍃 {p.name} ({(!isNaN(pAmt) ? pAmt : 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € dispo)
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-4 top-3.5 pointer-events-none">
                <Layers className="w-4 h-4 text-ac-brown-light" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-white hover:bg-ac-cream text-ac-brown rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 h-12 bg-ac-green text-white rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-all flex items-center justify-center ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:translate-y-1'
              }`}
              style={isSubmitting ? { cursor: 'not-allowed' } : {}}
            >
              {isSubmitting ? 'Enregistrement...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
