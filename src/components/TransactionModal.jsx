import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Tag, RefreshCw } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function TransactionModal({ isOpen, onClose, onSave, transaction, accountId }) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState('expense'); // 'expense' or 'income'
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePeriod, setRecurrencePeriod] = useState('monthly');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');

  // Fetch envelopes for this account to suggest as categories
  const envelopes = useLiveQuery(() => 
    accountId ? db.envelopes.where('accountId').equals(accountId).toArray() : []
  , [accountId]);

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description || '');
      setType(transaction.amount < 0 ? 'expense' : 'income');
      setAmount(Math.abs(transaction.amount).toString() || '');
      setDate(transaction.date || '');
      setCategory(transaction.category || '');
      setIsRecurring(transaction.isRecurring || false);
      setRecurrencePeriod(transaction.recurrencePeriod || 'monthly');
      setRecurrenceEnd(transaction.recurrenceEnd || '');
    } else {
      // Set defaults for new transaction
      setDescription('');
      setType('expense');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategory('');
      setIsRecurring(false);
      setRecurrencePeriod('monthly');
      setRecurrenceEnd('');
    }
  }, [transaction, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description || !amount || !date) {
      alert('Veuillez remplir les champs obligatoires (Description, Montant, Date).');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Veuillez entrer un montant valide supérieur à 0.');
      return;
    }

    const signedAmount = type === 'expense' ? -numAmount : numAmount;

    const transactionData = {
      accountId: Number(accountId),
      description,
      amount: signedAmount,
      date,
      category,
      isRecurring,
      recurrencePeriod: isRecurring ? recurrencePeriod : 'none',
      recurrenceEnd: isRecurring ? recurrenceEnd : ''
    };

    onSave(transactionData);
  };

  // Standard category suggestions
  const defaultCategories = [
    'Alimentation',
    'Loisirs',
    'Logement',
    'Transports',
    'Abonnements',
    'Cadeaux',
    'Santé',
    'Salaire',
    'Autre'
  ];

  // Combine standard categories and envelope names (ensuring uniqueness)
  const envelopeNames = envelopes ? envelopes.map(e => e.name) : [];
  const allCategories = Array.from(new Set([...envelopeNames, ...defaultCategories]));

  return (
    <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-colors"
        >
          <X className="w-5 h-5 text-ac-brown" />
        </button>

        <h3 className="text-xl font-black text-ac-brown mb-6 flex items-center gap-2">
          {transaction ? 'Modifier la transaction' : 'Ajouter une transaction'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Toggle (Dépense / Revenu) */}
          <div className="flex border-2 border-ac-brown rounded-2xl overflow-hidden p-1 bg-ac-cream">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-2 font-black text-sm rounded-xl transition-all ${
                type === 'expense'
                  ? 'bg-ac-red text-white border-2 border-ac-brown'
                  : 'text-ac-brown hover:bg-white/40'
              }`}
            >
              Dépense (-)
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-2 font-black text-sm rounded-xl transition-all ${
                type === 'income'
                  ? 'bg-ac-green text-white border-2 border-ac-brown'
                  : 'text-ac-brown hover:bg-white/40'
              }`}
            >
              Revenu (+)
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Baguette Magique"
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
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
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                  required
                />
                <span className="absolute left-3 top-2.5 text-xs font-black">🔔</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Date *</label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Catégorie / Enveloppe</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white appearance-none"
              >
                <option value="">-- Sélectionner une catégorie --</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {envelopeNames.includes(cat) ? `✉️ Enveloppe : ${cat}` : cat}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-3 pointer-events-none">
                <Tag className="w-4 h-4 text-ac-brown-light" />
              </div>
            </div>
            <p className="text-[10px] font-semibold text-ac-brown-light mt-1">
              💡 Classer dans une catégorie portant le nom d'une enveloppe déduira automatiquement le montant de celle-ci.
            </p>
          </div>

          {/* Recurrence Toggle */}
          <div className="bg-ac-cream/40 rounded-2xl border border-ac-brown/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-ac-brown flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-ac-gold" /> Planification récurrente ?
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-ac-cream-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ac-brown after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-ac-green border border-ac-brown"></div>
              </label>
            </div>

            {isRecurring && (
              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-ac-brown/10 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Période</label>
                  <select
                    value={recurrencePeriod}
                    onChange={(e) => setRecurrencePeriod(e.target.value)}
                    className="w-full bg-white border border-ac-brown rounded-xl px-2 py-1 text-xs font-bold text-ac-brown focus:outline-none"
                  >
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Date de Fin (Opt.)</label>
                  <input
                    type="date"
                    value={recurrenceEnd}
                    onChange={(e) => setRecurrenceEnd(e.target.value)}
                    className="w-full bg-white border border-ac-brown rounded-xl px-2 py-1 text-xs font-bold text-ac-brown focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white hover:bg-ac-cream text-ac-brown py-3 rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-ac-green text-white py-3 rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none"
            >
              Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
