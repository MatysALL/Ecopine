import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  FolderPlus, Plus, Trash2, Edit2, ChevronDown, ChevronRight, 
  Target, Calendar, Smile, Sparkles, Coins, ArrowRightLeft, ShieldAlert
} from 'lucide-react';

export default function BudgetManager({ accountId }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [parentBudgetId, setParentBudgetId] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState('regular'); // 'objective', 'regular', 'leisure'
  const [limitAmount, setLimitAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');

  // Objective transaction state
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [fundTargetBudget, setFundTargetBudget] = useState(null);
  const [fundAction, setFundAction] = useState('add'); // 'add' or 'remove'
  const [fundAmount, setFundAmount] = useState('');

  // Expand states for nodes
  const [expandedNodes, setExpandedNodes] = useState({});

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // 1. Fetch budgets for this account
  const budgets = useLiveQuery(() => 
    db.budgets.where('accountId').equals(Number(accountId)).toArray()
  , [accountId]);

  // 2. Fetch all transactions for this account to calculate spent/carryover
  const transactions = useLiveQuery(() => 
    db.transactions.where('accountId').equals(Number(accountId)).toArray()
  , [accountId]);

  if (!budgets || !transactions) {
    return <div className="text-xs font-bold text-ac-brown-light text-center py-6">Chargement des enveloppes...</div>;
  }

  // Helper to toggle node expansion
  const toggleNode = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to get all descendant budget IDs
  const getDescendantIds = (budgetId, list = budgets) => {
    const ids = [budgetId];
    const children = list.filter(b => b.parentBudgetId === budgetId);
    children.forEach(child => {
      ids.push(...getDescendantIds(child.id, list));
    });
    return ids;
  };

  // Helper to calculate total spent in current month for a budget and its descendants
  const calculateSpentCurrentMonth = (budgetId) => {
    const ids = getDescendantIds(budgetId);
    const monthTxs = transactions.filter(t => 
      t.date.startsWith(currentMonthStr) && 
      t.budgetId && 
      ids.includes(Number(t.budgetId))
    );

    // Sum debits (expenses) and subtract credits (refunds)
    return monthTxs.reduce((sum, t) => {
      const amt = Number(t.amount) || 0;
      return sum + (t.type === 'debit' ? amt : -amt);
    }, 0);
  };

  // Helper to calculate Leisure carryover
  const calculateLeisureCarryOver = (budget) => {
    if (budget.type !== 'leisure') return 0;

    const startYearMonth = budget.createdAt || currentMonthStr;
    const [startYear, startMonth] = startYearMonth.split('-').map(Number);
    const ids = getDescendantIds(budget.id);

    let carryOver = 0;
    let y = startYear;
    let m = startMonth;

    while (y < currentYear || (y === currentYear && m < currentMonth)) {
      const monthStr = `${y}-${String(m).padStart(2, '0')}`;
      
      const monthTxs = transactions.filter(t => 
        t.date.startsWith(monthStr) && 
        t.budgetId && 
        ids.includes(Number(t.budgetId))
      );

      const spentInMonth = monthTxs.reduce((sum, t) => {
        const amt = Number(t.amount) || 0;
        return sum + (t.type === 'debit' ? amt : -amt);
      }, 0);

      // Remaining budget for that month
      const remaining = budget.limitAmount - spentInMonth;
      carryOver += remaining;

      // Increment month
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    return carryOver;
  };

  // Build the tree structure
  const buildTree = (items, parentId = null) => {
    return items
      .filter(item => item.parentBudgetId === parentId)
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }));
  };

  const budgetTree = buildTree(budgets, null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !limitAmount) return;

    const limit = parseFloat(limitAmount);
    if (isNaN(limit) || limit <= 0) return;

    const budgetData = {
      accountId: Number(accountId),
      parentBudgetId: parentBudgetId ? Number(parentBudgetId) : null,
      name,
      type,
      limitAmount: limit,
      currentAmount: editingBudget ? editingBudget.currentAmount : 0,
      carryOverAmount: 0,
      frequency,
      createdAt: editingBudget ? (editingBudget.createdAt || currentMonthStr) : currentMonthStr
    };

    if (editingBudget) {
      await db.budgets.update(editingBudget.id, budgetData);
    } else {
      await db.budgets.add(budgetData);
    }

    resetForm();
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setParentBudgetId(budget.parentBudgetId);
    setName(budget.name);
    setType(budget.type);
    setLimitAmount(budget.limitAmount.toString());
    setFrequency(budget.frequency || 'monthly');
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    const idsToDelete = getDescendantIds(id);
    const confirmMsg = idsToDelete.length > 1 
      ? `Es-tu sûr de vouloir supprimer ce budget et ses ${idsToDelete.length - 1} sous-budgets ? Les transactions liées seront dissociées.`
      : "Es-tu sûr de vouloir supprimer ce budget ? Les transactions liées seront dissociées.";
      
    if (window.confirm(confirmMsg)) {
      await db.transaction('rw', db.budgets, db.transactions, async () => {
        // Delete all descendant budgets from database
        await db.budgets.bulkDelete(idsToDelete);

        // Update transactions pointing to these budgets to have budgetId = null
        await db.transactions
          .filter(t => t.budgetId && idsToDelete.includes(Number(t.budgetId)))
          .modify({ budgetId: null });
      });
    }
  };

  const resetForm = () => {
    setFormOpen(false);
    setEditingBudget(null);
    setParentBudgetId(null);
    setName('');
    setType('regular');
    setLimitAmount('');
    setFrequency('monthly');
  };

  // Feed/Withdraw from Objective budget
  const handleFundSubmit = async (e) => {
    e.preventDefault();
    if (!fundTargetBudget || !fundAmount) return;

    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) return;

    const current = Number(fundTargetBudget.currentAmount) || 0;
    let newAmount = current;

    if (fundAction === 'add') {
      newAmount += amount;
    } else {
      newAmount = Math.max(0, current - amount);
    }

    await db.budgets.update(fundTargetBudget.id, { currentAmount: newAmount });

    // Also register an internal transaction or simple note so they see it
    // Wait, the prompt says "Soustrait l'argent du solde affiché du compte dès qu'on y transfère une somme (bloque l'argent)."
    // Since we dynamically calculate the visible balance by subtracting the currentAmount, we don't strictly need a transaction to affect the balance.
    // However, creating a transaction note (executionType = past) helps the user track their deposits/withdrawals!
    // "past (Passée) : Une simple note historique. Elle s'affiche dans les listes mais n'impacte pas le solde actuel car elle est déjà comptabilisée (Non)."
    // Perfect! We can record a transaction with executionType = 'past' to let them see it in the transaction flow!
    await db.transactions.add({
      accountId: Number(accountId),
      budgetId: fundTargetBudget.id,
      name: fundAction === 'add' ? `Dépôt objectif : ${fundTargetBudget.name}` : `Retrait objectif : ${fundTargetBudget.name}`,
      amount: amount,
      type: fundAction === 'add' ? 'debit' : 'credit', // debit because it leaves the visible wallet, credit because it comes back
      date: today.toISOString().split('T')[0],
      categoryId: null,
      executionType: 'past' // Historical note, does not affect the real balance (it's already handled by visible balance deduction)
    });

    setFundModalOpen(false);
    setFundTargetBudget(null);
    setFundAmount('');
  };

  // Render a recursive budget tree node
  const renderNode = (node, depth = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;

    // Calculations based on budget type
    let barColor = 'bg-ac-green';
    let progressPct = 0;
    let labelText = '';

    if (node.type === 'objective') {
      const current = node.currentAmount || 0;
      progressPct = node.limitAmount > 0 ? Math.min(100, (current / node.limitAmount) * 100) : 0;
      
      if (current >= node.limitAmount) barColor = 'bg-ac-green';
      else if (current > node.limitAmount * 0.5) barColor = 'bg-ac-gold';
      else barColor = 'bg-ac-red';

      labelText = `${current.toLocaleString('fr-FR')} 🔔 mis de côté sur ${node.limitAmount.toLocaleString('fr-FR')} 🔔`;
    } else if (node.type === 'regular') {
      const spent = calculateSpentCurrentMonth(node.id);
      progressPct = node.limitAmount > 0 ? Math.min(100, (spent / node.limitAmount) * 100) : 0;
      
      if (spent <= node.limitAmount * 0.5) barColor = 'bg-ac-green';
      else if (spent <= node.limitAmount) barColor = 'bg-ac-gold';
      else barColor = 'bg-ac-red';

      labelText = `Dépensé : ${spent.toLocaleString('fr-FR')} 🔔 / ${node.limitAmount.toLocaleString('fr-FR')} 🔔 ce mois (Reste : ${(node.limitAmount - spent).toLocaleString('fr-FR')} 🔔)`;
    } else if (node.type === 'leisure') {
      const carryOver = calculateLeisureCarryOver(node);
      const limitTotal = node.limitAmount + carryOver;
      const spent = calculateSpentCurrentMonth(node.id);
      progressPct = limitTotal > 0 ? Math.min(100, (spent / limitTotal) * 100) : 0;

      if (spent <= limitTotal * 0.5) barColor = 'bg-ac-green';
      else if (spent <= limitTotal) barColor = 'bg-ac-gold';
      else barColor = 'bg-ac-red';

      labelText = `Dépensé : ${spent.toLocaleString('fr-FR')} 🔔 / ${limitTotal.toLocaleString('fr-FR')} 🔔 (Reste : ${(limitTotal - spent).toLocaleString('fr-FR')} 🔔, inclut ${carryOver >= 0 ? '+' : ''}${carryOver.toLocaleString('fr-FR')} 🔔 de report)`;
    }

    return (
      <div key={node.id} className="space-y-2 select-none">
        {/* Node Card */}
        <div 
          className="bg-white border-2 border-ac-brown rounded-2xl p-4 shadow-ac-sm transition-all hover:bg-ac-cream-light/10"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left side: Expand button & Name & Type badge */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleNode(node.id)}
                className={`p-1 hover:bg-ac-cream rounded-lg transition-transform text-ac-brown-light ${
                  hasChildren ? 'visible' : 'invisible'
                }`}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <div>
                <h4 className="font-extrabold text-sm text-ac-brown flex items-center gap-1.5 flex-wrap">
                  {node.name}
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-ac-brown/15 flex items-center gap-1 ${
                    node.type === 'objective' ? 'bg-ac-gold-light text-ac-gold-dark' :
                    node.type === 'leisure' ? 'bg-ac-sky-light text-ac-sky' : 'bg-ac-green-light text-ac-green'
                  }`}>
                    {node.type === 'objective' ? <Target className="w-2.5 h-2.5" /> :
                     node.type === 'leisure' ? <Sparkles className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                    {node.type === 'objective' ? 'Objectif' :
                     node.type === 'leisure' ? 'Loisir' : 'Régulier'}
                  </span>
                </h4>
                <p className="text-[10px] font-semibold text-ac-brown-light mt-0.5">
                  {labelText}
                </p>
              </div>
            </div>

            {/* Right side: Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {node.type === 'objective' && (
                <button
                  onClick={() => {
                    setFundTargetBudget(node);
                    setFundAction('add');
                    setFundModalOpen(true);
                  }}
                  className="bg-ac-green-light text-ac-green hover:bg-ac-green/15 font-black text-[10px] px-2.5 py-1.5 rounded-xl border border-ac-green/20 flex items-center gap-1 cursor-pointer"
                  title="Alimenter ou récupérer des fonds"
                >
                  <ArrowRightLeft className="w-3 h-3" /> Transférer
                </button>
              )}
              <button
                onClick={() => {
                  setParentBudgetId(node.id);
                  setEditingBudget(null);
                  setName('');
                  setType('regular');
                  setLimitAmount('');
                  setFrequency('monthly');
                  setFormOpen(true);
                }}
                className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-ac-brown/20"
                title="Créer un sous-budget"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleEdit(node)}
                className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-ac-brown/20"
                title="Modifier"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(node.id)}
                className="p-1.5 hover:bg-ac-red-light rounded-lg text-ac-brown-light hover:text-ac-red border border-ac-brown/20"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="w-full bg-ac-cream border border-ac-brown h-3 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${progressPct}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Children Render */}
        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-ac-cream-light border-3 border-ac-brown rounded-3xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-ac-brown flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-ac-green" /> Gestion des Enveloppes Budgétaires
          </h3>
          <p className="text-xs font-semibold text-ac-brown-light mt-1">
            Crée des budgets mensuels ou des objectifs financiers. Un sous-budget peut être imbriqué dans un autre budget.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingBudget(null);
            setParentBudgetId(null);
            setName('');
            setType('regular');
            setLimitAmount('');
            setFrequency('monthly');
            setFormOpen(!formOpen);
          }}
          className="bg-ac-green text-white font-extrabold text-xs px-4 py-3 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Nouveau Budget Racine
        </button>
      </div>

      {/* Form to Add/Edit Budget */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="bg-white border-2 border-ac-brown rounded-2xl p-4 space-y-4 animate-bounce-in">
          <h4 className="font-extrabold text-sm text-ac-brown border-b border-ac-brown/15 pb-2">
            {editingBudget ? 'Modifier le budget' : 'Créer un nouveau budget'}
            {parentBudgetId && !editingBudget && (
              <span className="text-xs font-bold text-ac-green ml-1">
                (Sous-budget de : {budgets.find(b => b.id === parentBudgetId)?.name})
              </span>
            )}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Nom du Budget *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Supermarché, Essence, Switch"
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold text-ac-brown focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Type de Budget</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none"
              >
                <option value="regular">Régulier (Fixe par mois)</option>
                <option value="leisure">Loisir (Cumule les reports)</option>
                <option value="objective">Objectif (Bloque des clochettes)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">
                {type === 'objective' ? 'Cible Financière (Clochettes) *' : 'Limite Mensuelle (Clochettes) *'}
              </label>
              <input
                type="number"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="Ex: 150"
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold text-ac-brown focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="bg-white text-ac-brown font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown hover:bg-ac-cream"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown shadow-ac-sm active:translate-y-[1px]"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Budgets Tree List */}
      {budgetTree.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-ac-brown/15 text-xs font-semibold text-ac-brown-light">
          Aucun budget créé pour ce compte. Crée-en un pour isoler tes clochettes !
        </div>
      ) : (
        <div className="space-y-4">
          {budgetTree.map(rootNode => renderNode(rootNode, 0))}
        </div>
      )}

      {/* Objective Money Transfer Modal */}
      {fundModalOpen && fundTargetBudget && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-sm w-full shadow-ac-lg relative animate-bounce-in text-ac-brown">
            <h3 className="text-lg font-black mb-4 flex items-center gap-1.5 border-b border-ac-brown/10 pb-2">
              <Coins className="w-5 h-5 text-ac-gold" /> Transférer vers l'objectif
            </h3>
            
            <div className="bg-ac-cream-light border-2 border-ac-brown/50 rounded-xl p-3 mb-4 text-xs font-semibold">
              <p>Objectif : <strong>{fundTargetBudget.name}</strong></p>
              <p>Actuellement de côté : <strong>{fundTargetBudget.currentAmount || 0} / {fundTargetBudget.limitAmount} 🔔</strong></p>
            </div>

            <form onSubmit={handleFundSubmit} className="space-y-4">
              <div className="flex border-2 border-ac-brown rounded-2xl overflow-hidden p-1 bg-ac-cream">
                <button
                  type="button"
                  onClick={() => setFundAction('add')}
                  className={`flex-1 py-1.5 font-black text-xs rounded-xl transition-all ${
                    fundAction === 'add'
                      ? 'bg-ac-green text-white border-2 border-ac-brown'
                      : 'text-ac-brown hover:bg-white/40'
                  }`}
                >
                  Alimenter (+)
                </button>
                <button
                  type="button"
                  onClick={() => setFundAction('remove')}
                  className={`flex-1 py-1.5 font-black text-xs rounded-xl transition-all ${
                    fundAction === 'remove'
                      ? 'bg-ac-red text-white border-2 border-ac-brown'
                      : 'text-ac-brown hover:bg-white/40'
                  }`}
                >
                  Retirer (-)
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Montant (Clochettes)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl pl-8 pr-4 py-2 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                    required
                    autoFocus
                  />
                  <span className="absolute left-3 top-2.5 text-xs font-black">🔔</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFundModalOpen(false);
                    setFundTargetBudget(null);
                    setFundAmount('');
                  }}
                  className="flex-1 bg-white hover:bg-ac-cream border border-ac-brown text-ac-brown font-extrabold text-xs py-2 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ac-green text-white font-extrabold text-xs py-2 rounded-xl border border-ac-brown shadow-ac-sm"
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
