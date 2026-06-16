import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, calculateBudgetsState, getPeriodForDate, getPeriodsBetween, detectPeriodFrequency, convertPeriod } from '../db';
import { 
  FolderPlus, Plus, Trash2, Edit2, ChevronDown, ChevronRight, 
  Target, Calendar, Smile, Sparkles, Coins, ArrowRightLeft, ShieldAlert,
  ArrowRight, HeartCrack
} from 'lucide-react';

export default function BudgetManager({ accountId, onAddTransaction }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [parentBudgetId, setParentBudgetId] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState('regular'); // 'objective', 'regular', 'leisure'
  const [limitAmount, setLimitAmount] = useState('');
  const [renewalFrequency, setRenewalFrequency] = useState('monthly'); // 'weekly', 'biweekly', 'monthly', 'annual'
  const [redirectionBudgetId, setRedirectionBudgetId] = useState('');

  // Objective money modal state
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [fundTargetBudget, setFundTargetBudget] = useState(null);
  const [fundAction, setFundAction] = useState('add');
  const [fundAmount, setFundAmount] = useState('');

  // Expand states for nodes
  const [expandedNodes, setExpandedNodes] = useState({});

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 1. Fetch budgets for this account
  const budgets = useLiveQuery(() => 
    db.budgets.where('accountId').equals(Number(accountId)).toArray()
  , [accountId]);

  // 2. Fetch all transactions for this account
  const transactions = useLiveQuery(() => 
    db.transactions.where('accountId').equals(Number(accountId)).toArray()
  , [accountId]);

  if (!budgets || !transactions) {
    return <div className="text-xs font-bold text-ac-brown-light text-center py-6">Chargement des enveloppes...</div>;
  }

  // Calculate live dynamic states using our unified chronological simulation
  let budgetStates = {};
  let calculationError = null;
  try {
    const res = calculateBudgetsState(budgets, transactions, todayStr);
    budgetStates = res.states;
  } catch (err) {
    console.error("Erreur lors du calcul des enveloppes :", err);
    calculationError = err;
  }

  const toggleNode = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to build recursive tree
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

    const redirId = redirectionBudgetId ? Number(redirectionBudgetId) : null;

    // Strict constraint validation: destination CANNOT be a regular budget
    if (redirId) {
      const dest = budgets.find(b => b.id === redirId);
      if (dest && dest.type === 'regular') {
        alert("Contrainte de redirection : La destination du surplus ne peut pas être une enveloppe de type Régulier.");
        return;
      }
    }

    const freq = renewalFrequency;
    const currentPeriod = getPeriodForDate(todayStr, freq);

    const oldFreq = editingBudget ? (editingBudget.renewalFrequency || editingBudget.frequency || 'monthly') : freq;
    const freqChanged = editingBudget && oldFreq !== freq;

    let updatedHistory = editingBudget ? { ...(editingBudget.history || {}) } : {};
    let createdAt = editingBudget ? (editingBudget.createdAt || currentPeriod) : currentPeriod;

    if (freqChanged) {
      const detectedCreatedAtFreq = detectPeriodFrequency(createdAt);
      createdAt = convertPeriod(createdAt, detectedCreatedAtFreq, freq) || currentPeriod;

      const newHistory = {};
      Object.keys(updatedHistory).forEach(oldPeriod => {
        const detectedOldPeriodFreq = detectPeriodFrequency(oldPeriod);
        const newPeriod = convertPeriod(oldPeriod, detectedOldPeriodFreq, freq);
        if (newPeriod) {
          newHistory[newPeriod] = updatedHistory[oldPeriod];
        }
      });
      updatedHistory = newHistory;
    }

    // Freeze limit history for past periods if limit was changed
    if (editingBudget && limit !== editingBudget.limitAmount) {
      const oldLimit = editingBudget.limitAmount;
      const startPeriod = createdAt || currentPeriod;

      const allPeriods = getPeriodsBetween(startPeriod, todayStr, freq);
      allPeriods.forEach(p => {
        if (p < currentPeriod && updatedHistory[p] === undefined) {
          updatedHistory[p] = oldLimit;
        }
      });
    }

    const budgetData = {
      accountId: Number(accountId),
      parentBudgetId: parentBudgetId ? Number(parentBudgetId) : null,
      name: name.trim(),
      type,
      limitAmount: limit,
      renewalFrequency: freq,
      frequency: freq, // compatibility
      redirectionBudgetId: redirId,
      currentAmount: editingBudget ? editingBudget.currentAmount : 0,
      carryOverAmount: 0,
      history: updatedHistory,
      createdAt
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
    setRenewalFrequency(budget.renewalFrequency || budget.frequency || 'monthly');
    setRedirectionBudgetId(budget.redirectionBudgetId ? budget.redirectionBudgetId.toString() : '');
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    // Collect child IDs recursively
    const collectIds = (bid) => {
      const ids = [bid];
      budgets.filter(b => b.parentBudgetId === bid).forEach(child => {
        ids.push(...collectIds(child.id));
      });
      return ids;
    };

    const idsToDelete = collectIds(id);
    const confirmMsg = idsToDelete.length > 1
      ? `Supprimer ce budget et ses ${idsToDelete.length - 1} sous-budgets ? Les transactions liées seront détachées.`
      : "Supprimer ce budget ? Les transactions liées seront détachées.";

    if (window.confirm(confirmMsg)) {
      await db.transaction('rw', db.budgets, db.transactions, async () => {
        await db.budgets.bulkDelete(idsToDelete);
        
        // Dissociate transactions
        await db.transactions
          .filter(t => t.budgetId && idsToDelete.includes(Number(t.budgetId)))
          .modify({ budgetId: null });

        // Clean up redirection configurations pointing to deleted budgets
        await db.budgets
          .filter(b => b.redirectionBudgetId && idsToDelete.includes(Number(b.redirectionBudgetId)))
          .modify({ redirectionBudgetId: null });
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
    setRenewalFrequency('monthly');
    setRedirectionBudgetId('');
  };

  // Fund Objective handlers
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

    // Note historical transaction
    await db.transactions.add({
      accountId: Number(accountId),
      budgetId: fundTargetBudget.id,
      name: fundAction === 'add' ? `Dépôt objectif : ${fundTargetBudget.name}` : `Retrait objectif : ${fundTargetBudget.name}`,
      amount: amount,
      type: fundAction === 'add' ? 'debit' : 'credit',
      date: todayStr,
      categoryId: null,
      executionType: 'past' // Historical only
    });

    setFundModalOpen(false);
    setFundTargetBudget(null);
    setFundAmount('');
  };

  // Recursive tree nodes rendering
  const renderNode = (node, depth = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = budgets.some(b => b.parentBudgetId === node.id);

    // Get pre-calculated state from the simulation
    const state = budgetStates[node.id] || {
      limit: node.limitAmount,
      carryOver: 0,
      redirectedInflow: 0,
      available: node.limitAmount,
      spent: 0,
      remaining: node.limitAmount,
      calculatedCurrentAmount: node.currentAmount
    };

    let barColor = 'bg-ac-green';
    let progressPct = 0;
    let messageText = '';
    let statusText = '';

    if (node.type === 'objective') {
      const current = state.calculatedCurrentAmount;
      progressPct = node.limitAmount > 0 ? Math.min(100, (current / node.limitAmount) * 100) : 0;
      
      if (current >= node.limitAmount) {
        barColor = 'bg-ac-green';
        statusText = 'Accompli !';
      } else if (current > node.limitAmount * 0.5) {
        barColor = 'bg-ac-gold';
        statusText = 'En bonne voie';
      } else {
        barColor = 'bg-ac-red';
        statusText = 'À économiser';
      }
      messageText = `${current.toLocaleString('fr-FR')} 🔔 sur une cible de ${node.limitAmount.toLocaleString('fr-FR')} 🔔 (${statusText})`;
    } 
    else if (node.type === 'regular') {
      progressPct = node.limitAmount > 0 ? Math.min(100, (state.spent / node.limitAmount) * 100) : 0;
      
      // REGULAR RULES:
      // spent < limit: RED color + "Vous n'avez pas encore payé ce régulier"
      // spent >= limit: BLUE color + "Régulier respecté"
      if (state.spent < node.limitAmount) {
        barColor = 'bg-ac-red';
        statusText = "Vous n'avez pas encore payé ce régulier";
      } else {
        barColor = 'bg-ac-sky';
        statusText = "Régulier respecté";
      }
      messageText = `Payé : ${state.spent.toLocaleString('fr-FR')} 🔔 / ${node.limitAmount.toLocaleString('fr-FR')} 🔔 (${statusText})`;
    } 
    else if (node.type === 'leisure') {
      // LEISURE RULES:
      // Percent consumed of available budget (available = limit + carryOver + redirectedInflow)
      const av = state.available;
      let pctConsumed = 0;
      if (av > 0) {
        pctConsumed = (state.spent / av) * 100;
      } else if (state.spent > 0 || av < 0) {
        pctConsumed = 100; // Debt or overspent
      }

      progressPct = Math.min(100, Math.max(0, pctConsumed));

      // States:
      // <50%: GREEN + "Vous pouvez dépenser"
      // 50%-75%: YELLOW + "Attention, il va falloir se serrer le ventre"
      // >=95%: RED + "On touche plus, on achète plus !"
      // other (75%-95%): ORANGE + "Seuil d'alerte proche"
      if (pctConsumed < 50) {
        barColor = 'bg-ac-green';
        statusText = "Vous pouvez dépenser";
      } else if (pctConsumed >= 50 && pctConsumed <= 75) {
        barColor = 'bg-[#F1C40F]'; // Tailored Yellow
        statusText = "Attention, il va falloir se serrer le ventre";
      } else if (pctConsumed >= 95) {
        barColor = 'bg-ac-red';
        statusText = "On touche plus, on achète plus !";
      } else {
        barColor = 'bg-orange-500'; // Orange
        statusText = "Seuil d'alerte proche";
      }

      const carryLabel = state.carryOver !== 0 
        ? ` (Report : ${state.carryOver >= 0 ? '+' : ''}${state.carryOver.toLocaleString('fr-FR')} 🔔)` 
        : '';
      const redirLabel = state.redirectedInflow > 0 
        ? ` (Transferts reçus : +${state.redirectedInflow.toLocaleString('fr-FR')} 🔔)` 
        : '';

      messageText = `Dépensé : ${state.spent.toLocaleString('fr-FR')} 🔔 / ${av.toLocaleString('fr-FR')} 🔔 dispos${carryLabel}${redirLabel} (${statusText})`;
    }

    // Determine redirection target name
    const redirectionTarget = node.redirectionBudgetId 
      ? budgets.find(b => b.id === node.redirectionBudgetId)?.name 
      : null;

    return (
      <div key={node.id} className="space-y-2">
        {/* Card wrapper */}
        <div 
          className="bg-white border-2 border-ac-brown rounded-2xl p-4 shadow-ac-sm transition-all hover:bg-ac-cream-light/10"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left side info */}
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
                  
                  {/* Frequency badge */}
                  {node.type !== 'objective' && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-ac-cream border border-ac-brown/10 text-ac-brown-light rounded">
                      {node.renewalFrequency === 'weekly' ? 'Hebdo' :
                       node.renewalFrequency === 'biweekly' ? 'Bimensuel' :
                       node.renewalFrequency === 'annual' ? 'Annuel' : 'Mensuel'}
                    </span>
                  )}

                  {/* Redirection indicator */}
                  {redirectionTarget && (
                    <span className="text-[8px] font-black bg-ac-green-light border border-ac-green/10 text-ac-green px-1.5 py-0.2 rounded flex items-center gap-0.5">
                      <ArrowRight className="w-2.5 h-2.5" /> Redirige surplus vers : {redirectionTarget}
                    </span>
                  )}
                </h4>
                
                <p className="text-[10px] font-bold text-ac-brown-light mt-0.5">
                  {messageText}
                </p>
              </div>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {onAddTransaction && (
                <button
                  onClick={() => onAddTransaction(node.id)}
                  className="bg-ac-green text-white hover:bg-ac-green-dark font-extrabold text-[10px] px-2.5 py-1.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1 cursor-pointer transition-transform active:translate-y-[1px]"
                  title="Ajouter une dépense avec cette enveloppe"
                >
                  <Plus className="w-3 h-3" /> + Dépense
                </button>
              )}
              {node.type === 'objective' && (
                <button
                  onClick={() => {
                    setFundTargetBudget(node);
                    setFundAction('add');
                    setFundModalOpen(true);
                  }}
                  className="bg-ac-green-light text-ac-green hover:bg-ac-green/15 font-black text-[10px] px-2.5 py-1.5 rounded-xl border border-ac-green/20 flex items-center gap-1 cursor-pointer shadow-ac-xs"
                >
                  <ArrowRightLeft className="w-3 h-3" /> Alimenter
                </button>
              )}
              <button
                onClick={() => {
                  setParentBudgetId(node.id);
                  setEditingBudget(null);
                  setName('');
                  setType('regular');
                  setLimitAmount('');
                  setRenewalFrequency('monthly');
                  setRedirectionBudgetId('');
                  setFormOpen(true);
                }}
                className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-ac-brown/20 cursor-pointer"
                title="Créer un sous-budget"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleEdit(node)}
                className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-ac-brown/20 cursor-pointer"
                title="Modifier"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(node.id)}
                className="p-1.5 hover:bg-ac-red-light rounded-lg text-ac-brown-light hover:text-ac-red border border-ac-brown/20 cursor-pointer"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress Bar display */}
          <div className="mt-3">
            <div className="w-full bg-ac-cream border border-ac-brown h-3.5 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${progressPct}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Child nodes */}
        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Options for redirection destination (excl regular, self, and children)
  const getRedirectionOptions = () => {
    if (!budgets || budgets.length === 0) return [];
    
    // Filter destination candidates
    let candidates = budgets.filter(b => b.type !== 'regular');

    if (editingBudget) {
      // Exclude self and descendants to avoid cycles
      const excludeIds = [editingBudget.id];
      const getChildIds = (bid) => {
        budgets.filter(b => b.parentBudgetId === bid).forEach(child => {
          excludeIds.push(child.id);
          getChildIds(child.id);
        });
      };
      getChildIds(editingBudget.id);
      candidates = candidates.filter(b => !excludeIds.includes(b.id));
    }

    return candidates;
  };

  const redirectionOptions = getRedirectionOptions();

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
            setRenewalFrequency('monthly');
            setRedirectionBudgetId('');
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Nom du Budget *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Supermarché, Essence..."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold text-ac-brown focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Type de Budget</label>
              <select
                value={type}
                onChange={(e) => {
                  const val = e.target.value;
                  setType(val);
                  // Reset redirection if switching to objective
                  if (val === 'objective') {
                    setRedirectionBudgetId('');
                  }
                }}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none"
              >
                <option value="regular">Régulier (Factures fixes)</option>
                <option value="leisure">Loisir (Cumule reports & dettes)</option>
                <option value="objective">Objectif (Bloque des clochettes)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">
                {type === 'objective' ? 'Cible (Clochettes) *' : 'Limite (Clochettes) *'}
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

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Fréquence de renouvellement</label>
              <select
                value={renewalFrequency}
                onChange={(e) => setRenewalFrequency(e.target.value)}
                disabled={type === 'objective'}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none disabled:opacity-50"
              >
                <option value="weekly">Hebdomadaire</option>
                <option value="biweekly">Bimensuel</option>
                <option value="monthly">Mensuel</option>
                <option value="annual">Annuel</option>
              </select>
            </div>
          </div>

          {/* Redirection Options Section */}
          {type !== 'objective' && (
            <div className="bg-ac-cream/40 border border-ac-brown/10 p-3 rounded-xl animate-fade-in">
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">
                Redirection de fin de période (Optionnel)
              </label>
              <select
                value={redirectionBudgetId}
                onChange={(e) => setRedirectionBudgetId(e.target.value)}
                className="w-full bg-white border border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold text-ac-brown focus:outline-none"
              >
                <option value="">-- Pas de transfert automatique --</option>
                {redirectionOptions.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type === 'objective' ? 'Objectif' : 'Loisir'})
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-ac-brown-light font-semibold mt-1">
                💡 Transférera automatiquement tout le surplus non utilisé à la fin de la période vers le budget choisi.
                <br />
                <span className="text-ac-red font-black">* Contrainte : la destination ne peut pas être un budget de type Régulier.</span>
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="bg-white text-ac-brown font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown hover:bg-ac-cream cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown shadow-ac-sm active:translate-y-[1px] cursor-pointer"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {calculationError && (
        <div className="bg-ac-red-light/40 border-2 border-ac-red/35 rounded-2xl p-4 text-xs font-bold text-ac-red flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <div>
            Une erreur de calcul est survenue : {calculationError.message}. Les enveloppes s'affichent avec des valeurs de secours (sans reports ni reports cumulés).
          </div>
        </div>
      )}

      {/* Tree list */}
      {budgetTree.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-ac-brown/15 text-xs font-semibold text-ac-brown-light">
          Aucun budget créé pour ce compte. Crée-en un pour isoler tes clochettes !
        </div>
      ) : (
        <div className="space-y-4">
          {budgetTree.map(rootNode => renderNode(rootNode, 0))}
        </div>
      )}

      {/* Fund Objective dialog */}
      {fundModalOpen && fundTargetBudget && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-sm w-full shadow-ac-lg relative animate-bounce-in">
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
                      ? 'bg-ac-green text-white border-2 border-ac-brown shadow-ac-sm'
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
                      ? 'bg-ac-red text-white border-2 border-ac-brown shadow-ac-sm'
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
                  className="flex-1 bg-white hover:bg-ac-cream border border-ac-brown text-ac-brown font-extrabold text-xs py-2 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ac-green text-white font-extrabold text-xs py-2 rounded-xl border border-ac-brown shadow-ac-sm cursor-pointer"
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
