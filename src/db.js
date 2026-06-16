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
  // 1. Migrate user_meta
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
      frequency: 'monthly',
      renewalFrequency: 'monthly',
      redirectionBudgetId: null,
      history: {},
      createdAt: new Date().toISOString().split('T')[0].substring(0, 7) // 'YYYY-MM'
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
      categoryId: null,
      executionType: 'spontaneous',
      isRecurring: txObj.isRecurring || false,
      recurrencePeriod: txObj.recurrencePeriod || 'none',
      recurrenceEnd: txObj.recurrenceEnd || ''
    });
  }
});

// Version 4 schema (updated for Wishlist)
db.version(4).stores({
  user_meta: 'key',
  accounts: '++id, name, type, bankName, initialBalance, currentBalance, rate, description, rib',
  categories: '++id, name, isDefault',
  budgets: '++id, accountId, parentBudgetId, name, type, limitAmount, currentAmount, carryOverAmount, frequency',
  transactions: '++id, accountId, budgetId, name, amount, type, date, categoryId, executionType',
  wishlist: '++id, name, price, description'
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
 * Period calculations helpers
 */
export function getISOWeek(date) {
  if (!date || isNaN(date.getTime())) return '';
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getBiweeklyPeriod(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const h = date.getDate() <= 15 ? 'H1' : 'H2';
  return `${y}-${m}-${h}`;
}

export function detectPeriodFrequency(periodStr) {
  if (!periodStr) return 'monthly';
  if (/^\d{4}-W\d{2}$/.test(periodStr)) return 'weekly';
  if (/^\d{4}-\d{2}-H[12]$/.test(periodStr)) return 'biweekly';
  if (/^\d{4}-\d{2}$/.test(periodStr)) return 'monthly';
  if (/^\d{4}$/.test(periodStr)) return 'annual';
  return 'monthly';
}

export function convertPeriod(periodStr, fromFreq, toFreq) {
  if (!periodStr) return '';
  const detectedFreq = fromFreq || detectPeriodFrequency(periodStr);
  const safeRange = getPeriodDateRange(periodStr, detectedFreq);
  return getPeriodForDate(safeRange.start, toFreq);
}

export function getPeriodForDate(dateStr, frequency) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const freq = frequency || 'monthly';

  if (freq === 'weekly') {
    return getISOWeek(date);
  }
  if (freq === 'biweekly') {
    return getBiweeklyPeriod(date);
  }
  if (freq === 'annual') {
    return String(y);
  }
  // Default to monthly
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getPeriodDateRange(periodStr, frequency) {
  const freq = frequency || 'monthly';

  if (!periodStr || typeof periodStr !== 'string') {
    return { start: '1970-01-01', end: '1970-01-01' };
  }

  if (freq === 'monthly') {
    const parts = periodStr.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (isNaN(y) || isNaN(m)) return { start: '1970-01-01', end: '1970-01-01' };
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }
  if (freq === 'annual') {
    const y = Number(periodStr);
    if (isNaN(y)) return { start: '1970-01-01', end: '1970-01-01' };
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  if (freq === 'weekly') {
    if (!periodStr.includes('-W')) return { start: '1970-01-01', end: '1970-01-01' };
    const [yStr, wStr] = periodStr.split('-W');
    const y = Number(yStr);
    const w = Number(wStr);
    if (isNaN(y) || isNaN(w)) return { start: '1970-01-01', end: '1970-01-01' };
    const simple = new Date(y, 0, 1 + (w - 1) * 7);
    if (isNaN(simple.getTime())) return { start: '1970-01-01', end: '1970-01-01' };
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const start = ISOweekStart.toISOString().split('T')[0];
    const endD = new Date(ISOweekStart);
    endD.setDate(endD.getDate() + 6);
    const end = endD.toISOString().split('T')[0];
    return { start, end };
  }
  if (freq === 'biweekly') {
    const parts = periodStr.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const h = parts[2];
    if (isNaN(y) || isNaN(m) || (h !== 'H1' && h !== 'H2')) {
      return { start: '1970-01-01', end: '1970-01-01' };
    }
    if (h === 'H1') {
      return {
        start: `${y}-${String(m).padStart(2, '0')}-01`,
        end: `${y}-${String(m).padStart(2, '0')}-15`
      };
    } else {
      const lastDay = new Date(y, m, 0).getDate();
      return {
        start: `${y}-${String(m).padStart(2, '0')}-16`,
        end: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      };
    }
  }
  return { start: '1970-01-01', end: '9999-12-31' };
}

export function getPeriodsBetween(startPeriod, endDateStr, frequency) {
  const list = [];
  const freq = frequency || 'monthly';
  const endPeriod = getPeriodForDate(endDateStr, freq);

  // Normalize startPeriod if its frequency doesn't match expected frequency format
  const detectedStartFreq = detectPeriodFrequency(startPeriod);
  let normalizedStartPeriod = startPeriod;
  if (detectedStartFreq !== freq) {
    normalizedStartPeriod = convertPeriod(startPeriod, detectedStartFreq, freq);
  }

  if (freq === 'monthly') {
    if (!/^\d{4}-\d{2}$/.test(normalizedStartPeriod)) {
      return [endPeriod];
    }
    let [y, m] = normalizedStartPeriod.split('-').map(Number);
    const [eY, eM] = endPeriod.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(eY) || isNaN(eM)) return [endPeriod];
    let count = 0;
    while ((y < eY || (y === eY && m <= eM)) && count < 1200) {
      list.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
      count++;
    }
  } else if (freq === 'annual') {
    let y = Number(normalizedStartPeriod);
    const eY = Number(endPeriod);
    if (isNaN(y) || isNaN(eY)) return [endPeriod];
    let count = 0;
    for (let currentY = y; currentY <= eY && count < 100; currentY++) {
      list.push(String(currentY));
      count++;
    }
  } else if (freq === 'weekly') {
    const startRange = getPeriodDateRange(normalizedStartPeriod, 'weekly');
    let current = new Date(startRange.start);
    const target = new Date(endDateStr);
    if (isNaN(current.getTime()) || isNaN(target.getTime())) return [endPeriod];
    let count = 0;
    while (current <= target && count < 5300) {
      const weekStr = getISOWeek(current);
      if (weekStr) list.push(weekStr);
      current.setDate(current.getDate() + 7);
      count++;
    }
    list.push(endPeriod);
  } else if (freq === 'biweekly') {
    const startRange = getPeriodDateRange(normalizedStartPeriod, 'biweekly');
    let current = new Date(startRange.start);
    const target = new Date(endDateStr);
    if (isNaN(current.getTime()) || isNaN(target.getTime())) return [endPeriod];
    let count = 0;
    while (current <= target && count < 2600) {
      const biweekStr = getBiweeklyPeriod(current);
      if (biweekStr) list.push(biweekStr);
      current.setDate(current.getDate() + 15);
      count++;
    }
    list.push(endPeriod);
  }
  
  return Array.from(new Set(list)).filter(Boolean).sort();
}

export function getDescendantIds(budgetId, budgets) {
  const ids = [budgetId];
  const children = budgets.filter(b => b.parentBudgetId === budgetId);
  children.forEach(child => {
    ids.push(...getDescendantIds(child.id, budgets));
  });
  return ids;
}

/**
 * Simulates chronological budget progression to resolve carryovers, debts, and redirections
 */
export function calculateBudgetsState(budgets, transactions, todayStr) {
  const states = {};
  const carryOver = {}; // budgetId -> next period carryover
  const redirectedInflows = {}; // budgetId -> { [periodStr]: amount }
  const objectiveRedirections = {}; // budgetId -> accumulated redirection amount

  budgets.forEach(b => {
    states[b.id] = {
      limit: b.limitAmount,
      carryOver: 0,
      redirectedInflow: 0,
      available: b.limitAmount,
      spent: 0,
      remaining: b.limitAmount,
      calculatedCurrentAmount: b.type === 'objective' ? (Number(b.currentAmount) || 0) : 0
    };
    carryOver[b.id] = 0;
    redirectedInflows[b.id] = {};
    objectiveRedirections[b.id] = 0;
  });

  // Generate chronological list of pairs (budget, periodStr)
  const pairs = [];
  const currentPeriodMap = {};

  budgets.forEach(b => {
    const freq = b.renewalFrequency || b.frequency || 'monthly';
    const startPeriod = b.createdAt || getPeriodForDate(todayStr, freq);
    const endPeriod = getPeriodForDate(todayStr, freq);
    currentPeriodMap[b.id] = endPeriod;

    const periods = getPeriodsBetween(startPeriod, todayStr, freq);
    periods.forEach(p => {
      const { start } = getPeriodDateRange(p, freq);
      pairs.push({
        budget: b,
        periodStr: p,
        startDateStr: start
      });
    });
  });

  // Sort pairs by date
  pairs.sort((a, b) => a.startDateStr.localeCompare(b.startDateStr));

  // Run period-by-period simulation
  pairs.forEach(pair => {
    const { budget, periodStr } = pair;
    const bid = budget.id;
    const freq = budget.renewalFrequency || budget.frequency || 'monthly';
    const isCurrent = periodStr === currentPeriodMap[bid];

    // Read limit from history if frozen, otherwise current limit
    const history = budget.history || {};
    const limit = history[periodStr] !== undefined ? Number(history[periodStr]) : Number(budget.limitAmount);

    const { start, end } = getPeriodDateRange(periodStr, freq);

    // Sum transactions in this period range (for descendant budgets recursively)
    const descendantIds = getDescendantIds(bid, budgets);
    const periodTxs = transactions.filter(t => 
      t.date >= start && t.date <= end && 
      t.budgetId && descendantIds.includes(Number(t.budgetId))
    );
    const spent = periodTxs.reduce((sum, t) => {
      const amt = Number(t.amount) || 0;
      return sum + (t.type === 'debit' ? amt : -amt);
    }, 0);

    const cOver = carryOver[bid] || 0;
    const rInflow = redirectedInflows[bid][periodStr] || 0;
    const available = limit + cOver + rInflow;
    const remaining = available - spent;

    if (!isCurrent) {
      // closed period
      if (remaining < 0) {
        // Debt carryover for Leisure
        if (budget.type === 'leisure') {
          carryOver[bid] = remaining; // negative carryover
        } else {
          carryOver[bid] = 0;
        }
      } else {
        // Surplus carryover or redirection
        if (budget.redirectionBudgetId) {
          const destId = Number(budget.redirectionBudgetId);
          const destBudget = budgets.find(b => b.id === destId);
          if (destBudget) {
            if (destBudget.type === 'objective') {
              objectiveRedirections[destId] = (objectiveRedirections[destId] || 0) + remaining;
            } else if (destBudget.type === 'leisure') {
              const destFreq = destBudget.renewalFrequency || destBudget.frequency || 'monthly';
              const destPeriod = getPeriodForDate(end, destFreq);
              if (!redirectedInflows[destId][destPeriod]) {
                redirectedInflows[destId][destPeriod] = 0;
              }
              redirectedInflows[destId][destPeriod] += remaining;
            }
          }
          carryOver[bid] = 0;
        } else {
          if (budget.type === 'leisure') {
            carryOver[bid] = remaining; // positive carryover
          } else {
            carryOver[bid] = 0;
          }
        }
      }
    } else {
      // current open period
      states[bid] = {
        limit,
        carryOver: cOver,
        redirectedInflow: rInflow,
        available,
        spent,
        remaining,
        calculatedCurrentAmount: budget.type === 'objective' ? ((Number(budget.currentAmount) || 0) + (objectiveRedirections[bid] || 0)) : 0
      };
    }
  });

  // Ensure objective calculations are fully written
  budgets.forEach(b => {
    if (b.type === 'objective') {
      const base = Number(b.currentAmount) || 0;
      const redirected = objectiveRedirections[b.id] || 0;
      states[b.id].calculatedCurrentAmount = base + redirected;
    }
  });

  const blockedObjectiveSum = budgets
    .filter(b => b.type === 'objective')
    .reduce((sum, b) => sum + states[b.id].calculatedCurrentAmount, 0);

  return {
    states,
    blockedObjectiveSum
  };
}

/**
 * Simulates French quinzaines interest capitalization for a Livret account
 */
export function calculateLivretInterests(account, transactions, targetDateStr) {
  const rate = Number(account.rate) || 0;
  if (rate <= 0) return { capitalized: 0, accrued: 0 };

  const targetDate = new Date(targetDateStr);
  const targetYear = targetDate.getFullYear();

  const todayStr = new Date().toISOString().split('T')[0];
  const validTxs = transactions.filter(t => {
    const exeType = t.executionType || 'spontaneous';
    const isEffective = exeType === 'spontaneous' || (exeType === 'planned' && t.date <= todayStr);
    return isEffective && t.date <= targetDateStr;
  });

  let startYear = targetYear;
  if (validTxs.length > 0) {
    const years = validTxs.map(t => new Date(t.date).getFullYear());
    startYear = Math.min(...years);
  }

  let capitalizedInterests = 0;
  let accruedInterests = 0;

  for (let y = startYear; y <= targetYear; y++) {
    const txsBeforeYear = validTxs.filter(t => new Date(t.date).getFullYear() < y);
    const sumTxsBeforeYear = txsBeforeYear.reduce((sum, t) => {
      const amt = Number(t.amount) || 0;
      return sum + (t.type === 'credit' ? amt : -amt);
    }, 0);
    const yearStartBalance = Number(account.initialBalance) + sumTxsBeforeYear + capitalizedInterests;

    const txsOfYear = validTxs.filter(t => new Date(t.date).getFullYear() === y);

    let yearlyInterest = 0;

    for (let month = 0; month < 12; month++) {
      for (let qPart = 1; qPart <= 2; qPart++) {
        const lastDayOfMonth = new Date(y, month + 1, 0).getDate();
        const qEndDay = qPart === 1 ? 15 : lastDayOfMonth;
        const qEndDateStr = `${y}-${String(month + 1).padStart(2, '0')}-${String(qEndDay).padStart(2, '0')}`;

        if (qEndDateStr > targetDateStr) {
          break;
        }

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
  const todayStr = new Date().toISOString().split('T')[0];
  const target = targetDateStr || todayStr;

  const budgets = await db.budgets
    .where('accountId')
    .equals(accountId)
    .toArray();

  if (budgets.length === 0) return realBalance;

  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .toArray();

  try {
    const result = calculateBudgetsState(budgets, transactions, target);
    return realBalance - result.blockedObjectiveSum;
  } catch (err) {
    console.error("Erreur lors du calcul du solde visible (getAccountVisibleBalance) :", err);
    return realBalance;
  }
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
    let sum = 0;
    for (const accId of selectedAccountIds) {
      sum += await getAccountBalance(accId, targetDateStr);
    }
    return sum;
  }

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

  const tomorrowToTargetTxs = txs.filter(t => {
    const exeType = t.executionType || 'spontaneous';
    if (exeType !== 'planned') return false;
    if (t.isRecurring) {
      return t.date <= targetDateStr && (!t.recurrenceEnd || t.recurrenceEnd >= tomorrowStr);
    }
    return t.date >= tomorrowStr && t.date <= targetDateStr;
  });

  const expanded = expandRecurringTransactions(tomorrowToTargetTxs, tomorrowStr, targetDateStr);

  const futureSum = expanded.reduce((s, t) => {
    const amt = Number(t.amount) || 0;
    return s + (t.type === 'credit' ? amt : -amt);
  }, 0);

  return sum + futureSum;
}
