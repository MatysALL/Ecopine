import React, { useState, useEffect, useMemo } from 'react';
import { X, Tag, RefreshCw, Layers } from 'lucide-react';
import { useDb } from '../db';

export default function TransactionModal({ isOpen, onClose, onSave, transaction, accountId, preselectedBudgetId }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('debit'); // 'debit' or 'credit'
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [executionType, setExecutionType] = useState('spontaneous'); // 'spontaneous', 'past', 'planned'
  const [budgetId, setBudgetId] = useState('');
  
  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePeriod, setRecurrencePeriod] = useState('monthly');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');

  const { categories: categoriesList, budgets: allBudgets } = useDb();

  // Filter budgets for this account
  const budgetsList = useMemo(() => {
    if (!accountId || !allBudgets) return [];
    return allBudgets.filter(b => b.accountId === accountId);
  }, [allBudgets, accountId]);

  useEffect(() => {
    if (transaction) {
      setName(transaction.name || transaction.description || '');
      setType(transaction.type || (transaction.amount < 0 ? 'debit' : 'credit'));
      setAmount(Math.abs(transaction.amount).toString() || '');
      setDate(transaction.date || '');
      setCategoryId(transaction.categoryId ? transaction.categoryId.toString() : '');
      setExecutionType(transaction.executionType || 'spontaneous');
      setBudgetId(transaction.budgetId ? transaction.budgetId.toString() : '');
      
      setIsRecurring(transaction.isRecurring || false);
      setRecurrencePeriod(transaction.recurrencePeriod || 'monthly');
      setRecurrenceEnd(transaction.recurrenceEnd || '');
    } else {
      setName('');
      setType('debit');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategoryId('');
      setExecutionType('spontaneous');
      setBudgetId(preselectedBudgetId ? preselectedBudgetId.toString() : '');
      
      setIsRecurring(false);
      setRecurrencePeriod('monthly');
      setRecurrenceEnd('');
    }
  }, [transaction, isOpen, preselectedBudgetId]);

  if (!isOpen) return null;

  // Build the indented budget select options list
  const getBudgetOptions = () => {
    if (!budgetsList || budgetsList.length === 0) return [];
    
    const map = {};
    budgetsList.forEach(b => {
      map[b.id] = { ...b, children: [] };
    });
    
    const roots = [];
    budgetsList.forEach(b => {
      if (b.parentBudgetId && map[b.parentBudgetId]) {
        map[b.parentBudgetId].children.push(map[b.id]);
      } else {
        roots.push(map[b.id]);
      }
    });

    const options = [];
    const traverse = (node, depth) => {
      options.push({
        id: node.id,
        name: node.name,
        type: node.type,
        depth: depth
      });
      node.children.forEach(child => traverse(child, depth + 1));
    };
    roots.forEach(root => traverse(root, 0));
    return options;
  };

  const budgetOptions = getBudgetOptions();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !amount || !date) {
      alert('Veuillez remplir les champs obligatoires (Nom, Montant, Date).');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Veuillez entrer un montant valide supérieur à 0.');
      return;
    }

    // Resolve category name for backward-compatibility
    const selectedCategory = categoriesList?.find(c => c.id === categoryId);

    const transactionData = {
      accountId: accountId,
      name: name.trim(),
      description: name.trim(), // keeping for compatibility
      amount: numAmount,
      type,
      date,
      categoryId: categoryId || null,
      category: selectedCategory ? selectedCategory.name : '', // keeping for compatibility
      executionType,
      budgetId: budgetId || null,
      
      isRecurring,
      recurrencePeriod: isRecurring ? recurrencePeriod : 'none',
      recurrenceEnd: isRecurring ? recurrenceEnd : ''
    };

    onSave(transactionData);
  };

  return (
    <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in text-ac-brown select-none">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-colors"
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
              className={`flex-1 py-2 font-black text-sm rounded-xl transition-all ${
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
              className={`flex-1 py-2 font-black text-sm rounded-xl transition-all ${
                type === 'credit'
                  ? 'bg-ac-green text-white border-2 border-ac-brown shadow-ac-sm'
                  : 'text-ac-brown hover:bg-white/40'
              }`}
            >
              Revenu (+)
            </button>
          </div>

          {/* Execution Type Selection */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Type d'Exécution</label>
            <select
              value={executionType}
              onChange={(e) => setExecutionType(e.target.value)}
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
            >
              <option value="spontaneous">Spontanée (Immédiate)</option>
              <option value="planned">À prévoir (Planifiée)</option>
              <option value="past">Passée (Historique uniquement)</option>
            </select>
            <p className="text-[10px] text-ac-brown-light font-semibold mt-1">
              {executionType === 'spontaneous' && "💡 Modifie le solde de ton compte immédiatement."}
              {executionType === 'planned' && "💡 Modifie le solde uniquement le jour J. Figure sur le Calendrier."}
              {executionType === 'past' && "💡 Note historique. N'impacte pas le solde principal."}
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom de la transaction *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Baguette Magique, Vente de navets"
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
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
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold focus:outline-none focus:bg-white"
                  required
                />
                <span className="absolute left-3 top-2.5 text-xs font-black">🔔</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold focus:outline-none focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Catégorie</label>
            <div className="relative">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white appearance-none cursor-pointer"
              >
                <option value="">-- Sélectionner une catégorie --</option>
                {categoriesList?.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} {cat.isDefault ? '(Défaut)' : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-3 pointer-events-none">
                <Tag className="w-4 h-4 text-ac-brown-light" />
              </div>
            </div>
          </div>

          {/* Budget envelope selection */}
          <div>
            <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Associer à une Enveloppe/Budget</label>
            <div className="relative">
              <select
                value={budgetId}
                onChange={(e) => setBudgetId(e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2 text-sm font-bold focus:outline-none focus:bg-white appearance-none cursor-pointer"
              >
                <option value="">-- Aucun Budget lié --</option>
                {budgetOptions.map(b => (
                  <option key={b.id} value={b.id}>
                    {"\u00A0\u00A0".repeat(b.depth)}
                    {b.type === 'objective' ? '🎯' : b.type === 'leisure' ? '✨' : '📅'} {b.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-3 pointer-events-none">
                <Layers className="w-4 h-4 text-ac-brown-light" />
              </div>
            </div>
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
                    className="w-full bg-white border border-ac-brown rounded-xl px-2 py-1 text-xs font-bold focus:outline-none"
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
              className="flex-1 bg-white hover:bg-ac-cream text-ac-brown py-3 rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-ac-green text-white py-3 rounded-2xl border-3 border-ac-brown font-extrabold text-sm shadow-ac-sm transition-transform active:translate-y-1 active:shadow-none cursor-pointer"
            >
              Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
