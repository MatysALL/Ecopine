import React, { useState, useEffect, useMemo } from 'react';
import { X, Layers } from 'lucide-react';
import { useDb } from '../db';

export default function TransactionModal({ isOpen, onClose, onSave, transaction, accountId }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('debit'); // 'debit' or 'credit'
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [pocketId, setPocketId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { pockets: allPockets } = useDb();

  // Filter pockets for this account
  const pocketsList = useMemo(() => {
    if (!accountId || !allPockets) return [];
    return allPockets.filter(p => p.accountId === accountId);
  }, [allPockets, accountId]);

  useEffect(() => {
    if (transaction) {
      setName(transaction.name || transaction.description || '');
      setType(transaction.type || (transaction.amount < 0 ? 'debit' : 'credit'));
      setAmount(Math.abs(transaction.amount).toString() || '');
      setDate(transaction.date || '');
      setPocketId(transaction.pocketId ? transaction.pocketId.toString() : '');
    } else {
      setName('');
      setType('debit');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
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
      const transactionData = {
        accountId: accountId,
        name: name.trim(),
        description: name.trim(), // keeping for compatibility
        amount: numAmount,
        type,
        date,
        pocketId: pocketId || null
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
          {/* Type Toggle (Débit / Crédit) */}
          <div className="flex border-2 border-ac-brown rounded-2xl overflow-hidden p-1 bg-ac-cream">
            <button
              type="button"
              onClick={() => setType('debit')}
              className={`flex-1 h-12 flex items-center justify-center font-black text-sm rounded-xl transition-all ${
                type === 'debit'
                  ? 'bg-ac-red text-white border-2 border-ac-brown shadow-ac-sm'
                  : 'text-ac-brown hover:bg-white/40'
              }`}
            >
              Dépense (-)
            </button>
            <button
              type="button"
              onClick={() => setType('credit')}
              className={`flex-1 h-12 flex items-center justify-center font-black text-sm rounded-xl transition-all ${
                type === 'credit'
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
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant (Clochettes) *</label>
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
                <span className="absolute left-3 top-3.5 text-xs font-black">🔔</span>
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
                      🍃 {p.name} ({(!isNaN(pAmt) ? pAmt : 0).toLocaleString('fr-FR')} 🔔 dispo)
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
