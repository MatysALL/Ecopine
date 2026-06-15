import Dexie from 'dexie';

export const db = new Dexie('EcopineDB');

// Version 2 schema (legacy)
db.version(2).stores({
  accounts: '++id, name, type, initialBalance, rate',
  transactions: '++id, accountId, date, amount, description, category, isRecurring, recurrencePeriod, recurrenceEnd',
  envelopes: '++id, accountId, name, monthlyLimit, carryOver, blockBalance',
  budgets: '++id, month, limit',
  user_meta: '++id, key, value'
});

// Version 3 schema (updated)
db.version(3).stores({
  user_meta: 'key',
  accounts: '++id, name, type, bankName, initialBalance, currentBalance, rate, description, rib',
  categories: '++id, name, isDefault',
  budgets: '++id, accountId, parentBudgetId, name, type, limitAmount, currentAmount, carryOverAmount, frequency',
  transactions: '++id, accountId, budgetId, name, amount, type, date, categoryId, executionType'
}).upgrade(async (tx) => {
  // 1. Migrate user_meta: convert ++id auto-increment to simple key/value store
  const oldMeta = await tx.table('user_meta').toArray();
  await tx.table('user_meta').clear();
  for (const m of oldMeta) {
    if (m.key) {
      await tx.table('user_meta').put({ key: m.key, value: m.value });
    }
  }

  // 2. Migrate envelopes to budgets
  const oldEnvs = await tx.table('envelopes').toArray();
  const envToBudgetId = {};
  for (const env of oldEnvs) {
    const newBudgetId = await tx.table('budgets').add({
      accountId: Number(env.accountId),
      parentBudgetId: null,
      name: env.name,
      type: env.carryOver ? 'leisure' : 'regular',
      limitAmount: Number(env.monthlyLimit) || 0,
      currentAmount: 0,
      carryOverAmount: 0,
      frequency: 'monthly'
    });
    envToBudgetId[env.name] = newBudgetId;
  }

  // 3. Migrate transactions
  const oldTxs = await tx.table('transactions').toArray();
  await tx.table('transactions').clear();
  for (const txObj of oldTxs) {
    const isIncome = txObj.amount > 0;
    const absAmount = Math.abs(txObj.amount);
    const budgetId = envToBudgetId[txObj.category] || null;

    await tx.table('transactions').add({
      accountId: Number(txObj.accountId),
      budgetId: budgetId,
      name: txObj.description || 'Transaction',
      amount: absAmount,
      type: isIncome ? 'credit' : 'debit',
      date: txObj.date,
      categoryId: null, // Will resolve dynamically or manually
      executionType: 'spontaneous',
      // Keep recurrence metadata to maintain calendar functionality
      isRecurring: txObj.isRecurring || false,
      recurrencePeriod: txObj.recurrencePeriod || 'none',
      recurrenceEnd: txObj.recurrenceEnd || ''
    });
  }
});

// Handle version change and blocked events
db.on('versionchange', () => {
  console.warn("Changement de version de la base de données détecté. Fermeture de la connexion...");
  db.close();
  window.location.reload();
});

db.on('blocked', () => {
  console.warn("La mise à niveau de la base de données est bloquée par un autre onglet ouvert.");
});

// Open database and handle collisions
db.open().catch(async (err) => {
  console.error("Erreur lors de l'ouverture d'IndexedDB:", err);
  if (err.name === 'VersionError' || err.name === 'UpgradeError' || err.message?.includes('schema')) {
    console.warn("Version mismatch or schema issue detected. Re-creating EcopineDB...");
    try {
      await Dexie.delete('EcopineDB');
      window.location.reload();
    } catch (deleteErr) {
      console.error("Failed to delete database:", deleteErr);
    }
  }
});

// Populate default categories if empty
db.open().then(async () => {
  try {
    const count = await db.categories.count();
    if (count === 0) {
      await db.categories.bulkAdd([
        { name: 'Loisirs', isDefault: 1 },
        { name: 'Nourriture', isDefault: 1 },
        { name: 'Logement', isDefault: 1 },
        { name: 'Transports', isDefault: 1 },
        { name: 'Abonnements', isDefault: 1 },
        { name: 'Cadeaux', isDefault: 1 },
        { name: 'Santé', isDefault: 1 },
        { name: 'Salaire', isDefault: 1 },
        { name: 'Autre', isDefault: 1 }
      ]);
    }
  } catch (err) {
    console.error("Erreur lors de la population des catégories:", err);
  }
});

/**
 * Simulates French quinzaines interest capitalization for a Livret account
 * @param {object} account - The account object
 * @param {Array} transactions - List of transactions for this account
 * @param {string} targetDateStr - Date to compute interests up to
 * @returns {object} { capitalized: number, accrued: number }
 */
export function calculateLivretInterests(account, transactions, targetDateStr) {
  const rate = Number(account.rate) || 0;
  if (rate <= 0) return { capitalized: 0, accrued: 0 };

  const targetDate = new Date(targetDateStr);
  const targetYear = targetDate.getFullYear();

  // 1. Gather effective transactions up to targetDateStr
  // Exclude 'past' transactions since they are historical only and don't impact balance
  const todayStr = new Date().toISOString().split('T')[0];
  const validTxs = transactions.filter(t => {
    const exeType = t.executionType || 'spontaneous';
    const isEffective = exeType === 'spontaneous' || (exeType === 'planned' && t.date <= todayStr);
    return isEffective && t.date <= targetDateStr;
  });

  // Start year is the year of the earliest transaction or targetYear
  let startYear = targetYear;
  if (validTxs.length > 0) {
    const years = validTxs.map(t => new Date(t.date).getFullYear());
    startYear = Math.min(...years);
  }

  let capitalizedInterests = 0;
  let accruedInterests = 0;

  for (let y = startYear; y <= targetYear; y++) {
    // Start balance of this year = initialBalance + capitalized interests from past years + transactions before this year
    const txsBeforeYear = validTxs.filter(t => new Date(t.date).getFullYear() < y);
    const sumTxsBeforeYear = txsBeforeYear.reduce((sum, t) => {
      const amt = Number(t.amount) || 0;
      return sum + (t.type === 'credit' ? amt : -amt);
    }, 0);
    const yearStartBalance = Number(account.initialBalance) + sumTxsBeforeYear + capitalizedInterests;

    // Get transactions of this year
    const txsOfYear = validTxs.filter(t => new Date(t.date).getFullYear() === y);

    let yearlyInterest = 0;

    for (let month = 0; month < 12; month++) {
      for (let qPart = 1; qPart <= 2; qPart++) {
        const lastDayOfMonth = new Date(y, month + 1, 0).getDate();
        const qEndDay = qPart === 1 ? 15 : lastDayOfMonth;
        const qEndDateStr = `${y}-${String(month + 1).padStart(2, '0')}-${String(qEndDay).padStart(2, '0')}`;

        // Stop if this quinzaine ends in the future relative to targetDateStr
        if (qEndDateStr > targetDateStr) {
          break;
        }

        // Calculate interest-bearing balance for this quinzaine
        // Deposits (credit) count from start of next quinzaine (so transaction date <= end of prev quinzaine)
        let prevQEndDateStr;
        if (qPart === 2) {
          prevQEndDateStr = `${y}-${String(month + 1).padStart(2, '0')}-15`;
        } else {
          const prevMonthLastDay = new Date(y, month, 0).getDate();
          const prevMonth = month === 0 ? 12 : month;
          const prevYear = month === 0 ? y - 1 : y;
          prevQEndDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevMonthLastDay).padStart(2, '0')}`;
        }

        const deposits = txsOfYear.filter(t => t.type === 'credit' && t.date <= prevQEndDateStr);
        // Withdrawals (debit) count immediately (so transaction date <= end of current quinzaine)
        const withdrawals = txsOfYear.filter(t => t.type === 'debit' && t.date <= qEndDateStr);

        const sumDeposits = deposits.reduce((sum, t) => sum + Number(t.amount), 0);
        const sumWithdrawals = withdrawals.reduce((sum, t) => sum + Number(t.amount), 0);

        const interestBalance = yearStartBalance + sumDeposits - sumWithdrawals;
        const qInterest = Math.max(0, interestBalance) * (rate / 100) * (1 / 24);

        if (y < targetYear) {
          yearlyInterest += qInterest;
        } else {
          accruedInterests += qInterest;
        }
      }
    }

    if (y < targetYear) {
      capitalizedInterests += yearlyInterest;
    }
  }

  return {
    capitalized: capitalizedInterests,
    accrued: accruedInterests
  };
}

/**
 * Calculates the REAL balance of an account at a specific date
 */
export async function getAccountBalance(accountId, targetDateStr = null) {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const target = targetDateStr || todayStr;

  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .toArray();

  // Filter effective transactions
  const validTxs = transactions.filter(t => {
    const exeType = t.executionType || 'spontaneous';
    const isEffective = exeType === 'spontaneous' || (exeType === 'planned' && t.date <= todayStr);
    return isEffective && t.date <= target;
  });

  const sumTxs = validTxs.reduce((sum, t) => {
    const amt = Number(t.amount) || 0;
    return sum + (t.type === 'credit' ? amt : -amt);
  }, 0);

  let balance = Number(account.initialBalance) + sumTxs;

  // Add capitalized interests for booklet (livret) type accounts
  const isLivret = account.type && account.type.toLowerCase() !== 'courant';
  if (isLivret && Number(account.rate) > 0) {
    const interests = calculateLivretInterests(account, transactions, target);
    balance += interests.capitalized;
  }

  return balance;
}

/**
 * Calculates the VISIBLE balance (Real Balance - Blocked Objective funds)
 */
export async function getAccountVisibleBalance(accountId, targetDateStr = null) {
  const realBalance = await getAccountBalance(accountId, targetDateStr);

  // Find all Objective budgets for this account and sum their currentAmount
  const budgets = await db.budgets
    .where('accountId')
    .equals(accountId)
    .toArray();

  const blockedSum = budgets
    .filter(b => b.type === 'objective')
    .reduce((sum, b) => sum + (Number(b.currentAmount) || 0), 0);

  return realBalance - blockedSum;
}

/**
 * Expands recurring transactions within a date range (inclusive)
 */
export function expandRecurringTransactions(txs, startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const occurrences = [];

  for (const tx of txs) {
    if (!tx.isRecurring) {
      if (tx.date >= startDateStr && tx.date <= endDateStr) {
        occurrences.push({ ...tx, isOccurrence: false });
      }
      continue;
    }

    const txDate = new Date(tx.date);
    const recEnd = tx.recurrenceEnd ? new Date(tx.recurrenceEnd) : null;
    let current = new Date(txDate);

    while (current <= end) {
      if (recEnd && current > recEnd) break;

      const currentStr = current.toISOString().split('T')[0];
      if (currentStr >= startDateStr && currentStr <= endDateStr) {
        occurrences.push({
          ...tx,
          id: `${tx.id}-${currentStr}`,
          originalId: tx.id,
          date: currentStr,
          isOccurrence: true
        });
      }

      if (tx.recurrencePeriod === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else if (tx.recurrencePeriod === 'monthly') {
        current.setMonth(current.getMonth() + 1);
      } else {
        break;
      }
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Projects combined balance of accounts up to a future date or displays historical past balance
 */
export async function getProjectedBalance(selectedAccountIds, targetDateStr) {
  const todayStr = new Date().toISOString().split('T')[0];

  if (targetDateStr <= todayStr) {
    // Historical past balance: sum of balances at targetDateStr
    let sum = 0;
    for (const accId of selectedAccountIds) {
      sum += await getAccountBalance(accId, targetDateStr);
    }
    return sum;
  }

  // Future projection: sum of current balances + planned transactions in the future range
  let sum = 0;
  for (const accId of selectedAccountIds) {
    sum += await getAccountBalance(accId, todayStr);
  }

  const txs = await db.transactions
    .filter(t => selectedAccountIds.includes(Number(t.accountId)))
    .toArray();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Only take planned transactions between tomorrow and targetDateStr
  const tomorrowToTargetTxs = txs.filter(t => {
    const exeType = t.executionType || 'spontaneous';
    return exeType === 'planned' && t.date >= tomorrowStr && t.date <= targetDateStr;
  });

  // Also expand recurring planned transactions
  const expanded = expandRecurringTransactions(tomorrowToTargetTxs, tomorrowStr, targetDateStr);

  const futureSum = expanded.reduce((s, t) => {
    const amt = Number(t.amount) || 0;
    return s + (t.type === 'credit' ? amt : -amt);
  }, 0);

  return sum + futureSum;
}
