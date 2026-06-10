import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAccountBalance } from '../db';
import { Coins, ArrowRight, TrendingUp, Sparkles, Shield, ChevronRight, HelpCircle } from 'lucide-react';

export default function Dashboard({ onViewAccountDetails, username }) {
  const [budgetInputOpen, setBudgetInputOpen] = useState(false);
  const [newBudgetLimit, setNewBudgetLimit] = useState('');

  // Fetch current month string 'YYYY-MM'
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  // 1. Fetch accounts
  const accountsData = useLiveQuery(async () => {
    const allAccounts = await db.accounts.toArray();
    const accountsWithBalance = await Promise.all(
      allAccounts.map(async (acc) => {
        const bal = await getAccountBalance(acc.id);
        return { ...acc, balance: bal };
      })
    );
    return accountsWithBalance;
  });

  // 2. Fetch envelopes on main account to calculate blocked balances
  const envelopes = useLiveQuery(() => db.envelopes.toArray());

  // 3. Fetch current month budget
  const currentBudget = useLiveQuery(() => 
    db.budgets.where('month').equals(currentMonthStr).first()
  );

  // 4. Fetch last 5 transactions across all accounts
  const latestTransactions = useLiveQuery(() => 
    db.transactions.orderBy('date').reverse().limit(5).toArray()
  );

  if (!accountsData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-ac-brown">
        <div className="animate-spin w-12 h-12 border-4 border-ac-green border-t-transparent rounded-full mb-4"></div>
        <p className="font-bold">Chargement de tes clochettes...</p>
      </div>
    );
  }

  // Find the primary current account (default to first current account, or the first account found)
  const mainAccount = accountsData.find(a => a.type === 'Courant') || accountsData[0];
  const otherAccounts = accountsData.filter(a => a.id !== mainAccount?.id);

  // Calculate sum of blocked envelopes for the main account
  const blockedEnvelopesSum = envelopes
    ? envelopes
        .filter(e => e.accountId === mainAccount?.id && e.blockBalance)
        .reduce((sum, e) => sum + Number(e.monthlyLimit), 0)
    : 0;

  // Real balance vs visible balance (visible is real balance minus blocked envelope funds)
  const realBalance = mainAccount ? mainAccount.balance : 0;
  const visibleBalance = realBalance - blockedEnvelopesSum;

  // Calculate total monthly expenses on primary account (only expenses, i.e., amount < 0)
  const monthlyExpenses = latestTransactions
    ? latestTransactions
        .filter(t => t.accountId === mainAccount?.id && t.amount < 0 && t.date.startsWith(currentMonthStr))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    : 0;

  // Get budget limit
  const isBudgetConfigured = !!currentBudget;
  const budgetLimit = currentBudget ? currentBudget.limit : 0; 
  const remainingBudget = Math.max(0, budgetLimit - monthlyExpenses);
  const budgetPercentage = budgetLimit > 0 ? Math.min(100, (monthlyExpenses / budgetLimit) * 100) : 0;

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const limit = parseFloat(newBudgetLimit);
    if (isNaN(limit) || limit < 0) return;

    if (currentBudget) {
      await db.budgets.update(currentBudget.id, { limit });
    } else {
      await db.budgets.add({
        month: currentMonthStr,
        limit
      });
    }
    setBudgetInputOpen(false);
    setNewBudgetLimit('');
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex justify-between items-center bg-ac-green-light border-3 border-ac-brown rounded-3xl p-6 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <h2 className="text-3xl font-black text-ac-brown flex items-center gap-2">
            Bonjour, {username || 'Îlien'} ! <Sparkles className="w-6 h-6 text-ac-gold fill-ac-gold animate-pulse" />
          </h2>
          <p className="text-sm font-semibold text-ac-brown-light">
            Voici l'état de ton île financière pour le mois de <strong className="text-ac-green capitalize">{today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</strong>.
          </p>
        </div>
        <div className="hidden md:flex absolute right-[-20px] bottom-[-20px] text-ac-green/10 transform rotate-12">
          <LeafIconLarge />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Cards */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Account Balance Card */}
          <div 
            onClick={() => mainAccount && onViewAccountDetails(mainAccount.id)}
            className="ac-card bg-ac-gold-light p-8 cursor-pointer relative overflow-hidden group select-none border-ac-brown"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-ac-gold-dark bg-white border border-ac-gold px-3 py-1 rounded-full shadow-ac-sm">
                  Compte Principal - {mainAccount?.name || 'Poche'}
                </span>
                <h3 className="text-lg font-black text-ac-brown mt-4 mb-2">
                  Clochettes Disponibles
                </h3>
              </div>
              <div className="w-14 h-14 bg-ac-gold rounded-full flex items-center justify-center border-3 border-ac-brown shadow-ac-sm group-hover:scale-110 transition-transform duration-200">
                <Coins className="w-8 h-8 text-white fill-white" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight text-ac-brown">
                {visibleBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xl font-black text-ac-brown-light">🔔</span>
            </div>

            {/* Blocked funds indicator */}
            {blockedEnvelopesSum > 0 && (
              <div className="mt-4 flex items-center gap-2 bg-white/75 border-2 border-ac-brown/50 rounded-xl px-3 py-2 text-xs font-bold text-ac-brown-light">
                <Shield className="w-4 h-4 text-ac-red shrink-0" />
                <span>
                  Solde réel : <strong>{realBalance.toLocaleString('fr-FR')} 🔔</strong> (dont <strong>{blockedEnvelopesSum.toLocaleString('fr-FR')} 🔔</strong> virtuellement bloqués dans vos enveloppes-coffres).
                </span>
              </div>
            )}

            <div className="mt-6 flex items-center text-xs font-black text-ac-brown-light group-hover:text-ac-brown transition-colors">
              Voir le détail des transactions <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Other Accounts List */}
          <div className="ac-card p-6 bg-white border-ac-brown">
            <h3 className="text-lg font-black text-ac-brown mb-4 flex items-center gap-2">
              Autres Comptes & Épargnes
            </h3>
            {otherAccounts.length === 0 ? (
              <p className="text-sm font-semibold text-ac-brown-light text-center py-4 bg-ac-cream rounded-2xl border border-dashed border-ac-brown/20">
                Aucun autre compte enregistré.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherAccounts.map((acc) => (
                  <div 
                    key={acc.id}
                    onClick={() => onViewAccountDetails(acc.id)}
                    className="p-4 bg-ac-cream-dark/40 hover:bg-ac-cream-dark/80 transition-colors border-2 border-ac-brown rounded-2xl cursor-pointer flex justify-between items-center group"
                  >
                    <div>
                      <h4 className="font-extrabold text-sm text-ac-brown">{acc.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-ac-brown/20 text-ac-brown-light">
                        {acc.type} {acc.rate > 0 ? `(${acc.rate}%)` : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-base text-ac-brown">
                        {acc.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 🔔
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Budget Widget */}
        <div className="space-y-8">
          {/* Monthly Budget Card */}
          <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-ac-brown">
                  Budget ce mois-ci
                </h3>
                <button 
                  onClick={() => {
                    setNewBudgetLimit(budgetLimit > 0 ? budgetLimit.toString() : '500');
                    setBudgetInputOpen(!budgetInputOpen);
                  }}
                  className="text-xs font-black text-ac-green hover:underline"
                >
                  Configurer
                </button>
              </div>

              {budgetInputOpen ? (
                <form onSubmit={handleSaveBudget} className="bg-ac-cream rounded-2xl border-2 border-ac-brown p-3 mb-4 flex items-center gap-2">
                  <input
                    type="number"
                    value={newBudgetLimit}
                    onChange={(e) => setNewBudgetLimit(e.target.value)}
                    placeholder="Ex: 500"
                    className="w-full bg-white border-2 border-ac-brown rounded-xl px-2 py-1 text-sm font-bold focus:outline-none"
                    autoFocus
                  />
                  <button type="submit" className="bg-ac-green text-white font-bold text-xs px-3 py-1.5 rounded-xl border-2 border-ac-brown shadow-ac-sm hover:translate-y-[1px]">
                    Valider
                  </button>
                </form>
              ) : null}

              {!isBudgetConfigured ? (
                <div className="bg-ac-cream/50 rounded-2xl p-4 border border-ac-brown/10 mb-6 text-center py-6">
                  <span className="text-xs font-bold text-ac-brown-light block mb-2">Budget non défini ce mois-ci</span>
                  <p className="text-[10px] text-ac-brown-light mb-4">Configure un budget mensuel pour suivre ton reste à dépenser en direct !</p>
                  <button 
                    onClick={() => {
                      setNewBudgetLimit('500');
                      setBudgetInputOpen(true);
                    }}
                    className="ac-btn bg-ac-green text-white font-extrabold text-xs px-4 py-2 border-2 border-ac-brown shadow-ac-sm active:translate-y-[1px]"
                  >
                    Définir mon budget
                  </button>
                </div>
              ) : (
                <div className="bg-ac-cream/50 rounded-2xl p-4 border border-ac-brown/10 mb-6">
                  <div className="text-center py-2">
                    <span className="text-xs font-bold text-ac-brown-light block mb-1">Reste à dépenser</span>
                    <span className="text-4xl font-black text-ac-green">
                      {remainingBudget.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} 🔔
                    </span>
                    <span className="text-xs font-bold text-ac-brown-light block mt-1">sur un budget de {budgetLimit} 🔔</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="w-full bg-ac-cream-dark border-2 border-ac-brown h-5 rounded-full overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          budgetPercentage > 90 ? 'bg-ac-red' : budgetPercentage > 70 ? 'bg-ac-gold' : 'bg-ac-green'
                        }`}
                        style={{ width: `${budgetPercentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-ac-brown-light mt-1 px-1">
                      <span>Dépensé: {monthlyExpenses.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} 🔔</span>
                      <span>{Math.round(budgetPercentage)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs font-semibold text-ac-brown-light bg-ac-cream-dark/30 p-3 rounded-xl border border-dashed border-ac-brown/25">
              💡 Le reste à dépenser est recalculé en soustrayant les dépenses faites sur le compte principal ce mois-ci ({monthlyExpenses.toLocaleString('fr-FR')} 🔔).
            </div>
          </div>
        </div>
      </div>

      {/* Latest Transactions Section */}
      <div className="ac-card p-6 bg-white border-ac-brown">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-ac-brown flex items-center gap-2">
            Aperçu des 5 Dernières Transactions
          </h3>
          {mainAccount && (
            <button
              onClick={() => onViewAccountDetails(mainAccount.id)}
              className="text-xs font-black text-ac-green hover:underline flex items-center gap-1 group"
            >
              Gérer les comptes <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>

        {latestTransactions === undefined ? (
          <div className="text-center py-6 text-ac-brown-light">Chargement...</div>
        ) : latestTransactions.length === 0 ? (
          <div className="text-center py-8 bg-ac-cream rounded-3xl border border-dashed border-ac-brown/20 text-ac-brown-light text-sm font-semibold">
            Aucune clochette dépensée ou gagnée ici pour le moment ! C'est le début d'une belle aventure financière. 🍃
          </div>
        ) : (
          <div className="divide-y-2 divide-ac-cream-dark">
            {latestTransactions.map((tx) => {
              const matchingAccount = accountsData.find(a => a.id === tx.accountId);
              const isIncome = tx.amount > 0;
              return (
                <div key={tx.id} className="py-3 flex justify-between items-center hover:bg-ac-cream-light/35 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full border-2 border-ac-brown flex items-center justify-center font-bold text-xs ${
                      isIncome ? 'bg-ac-green-light text-ac-green' : 'bg-ac-red-light text-ac-red'
                    }`}>
                      {isIncome ? '+' : '-'}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-sm text-ac-brown">{tx.description}</h4>
                      <div className="flex gap-2 items-center text-[10px] font-bold text-ac-brown-light mt-0.5">
                        <span>{new Date(tx.date).toLocaleDateString('fr-FR')}</span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 bg-ac-cream-dark/50 border border-ac-brown/10 rounded">
                          {matchingAccount?.name || 'Inconnu'}
                        </span>
                        {tx.category && (
                          <>
                            <span>•</span>
                            <span className="text-ac-green bg-ac-green-light px-1.5 py-0.2 rounded">
                              {tx.category}
                            </span>
                          </>
                        )}
                        {tx.isRecurring && (
                          <span className="text-ac-gold font-extrabold bg-ac-gold-light border border-ac-gold/30 rounded px-1">
                            ♻️ {tx.recurrencePeriod === 'weekly' ? 'Hebdo' : 'Mensuel'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-black text-sm ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                      {isIncome ? '+' : ''}{tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Decorative leaf logo
function LeafIconLarge() {
  return (
    <svg width="220" height="220" viewBox="0 0 24 24" fill="currentColor" className="text-ac-green">
      <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.58,20.08C14,20 18,15.5 21,8C22,5.5 22,2.5 22,2C22,2 19,2 16.5,3C9,6 8,10.5 8,18L7.08,20L9,20C15,18 19.5,13.5 17,8Z" />
    </svg>
  );
}
