import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { auth, googleProvider, db as firestoreDb } from './firebase';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, 
  setDoc, query, where, onSnapshot, writeBatch, runTransaction,
  arrayUnion, arrayRemove
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

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
      t.budgetId && descendantIds.includes(t.budgetId)
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
          const destId = budget.redirectionBudgetId;
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
export function getAccountBalanceSync(account, transactions, targetDateStr = null) {
  if (!account) return 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const target = targetDateStr || todayStr;

  const accTxs = transactions.filter(t => t.accountId === account.id);

  const validTxs = accTxs.filter(t => {
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
    const interests = calculateLivretInterests(account, accTxs, target);
    balance += interests.capitalized;
  }

  return balance;
}

/**
 * Calculates the VISIBLE balance (Real Balance - Blocked Objective funds)
 */
export function getNextRenewalDate(dateStr, frequency, renewalDay) {
  if (!dateStr) return '';
  const baseDate = new Date(dateStr);
  if (isNaN(baseDate.getTime())) return '';

  let date = new Date(baseDate);

  if (frequency === 'weekly') {
    // Adjust date to the selected day of the week in the current week (1 = Monday, ..., 7 = Sunday)
    const currentDay = date.getDay() || 7; // Sunday is 7
    const targetDay = renewalDay !== undefined && renewalDay !== null ? Number(renewalDay) : currentDay;
    const diff = targetDay - currentDay;
    date.setDate(date.getDate() + diff);

    // If it's in the past or today, add 7 days
    if (date.toISOString().split('T')[0] <= dateStr) {
      date.setDate(date.getDate() + 7);
    }
  } else if (frequency === 'monthly') {
    // Adjust date to the selected day of the month in the current month
    const targetDay = renewalDay !== undefined && renewalDay !== null ? Number(renewalDay) : date.getDate();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(targetDay, lastDay));

    // If it's in the past or today, move to next month
    if (date.toISOString().split('T')[0] <= dateStr) {
      date.setMonth(date.getMonth() + 1);
      const nextLastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(targetDay, nextLastDay));
    }
  } else {
    return '';
  }

  return date.toISOString().split('T')[0];
}

export function getAccountVisibleBalanceSync(account, budgets, transactions, targetDateStr = null) {
  return getAccountBalanceSync(account, transactions, targetDateStr);
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
export function getProjectedBalanceSync(selectedAccountIds, targetDateStr, accounts, transactions) {
  const todayStr = new Date().toISOString().split('T')[0];

  if (targetDateStr <= todayStr) {
    let sum = 0;
    for (const accId of selectedAccountIds) {
      const acc = accounts.find(a => a.id === accId);
      sum += getAccountBalanceSync(acc, transactions, targetDateStr);
    }
    return sum;
  }

  let sum = 0;
  for (const accId of selectedAccountIds) {
    const acc = accounts.find(a => a.id === accId);
    sum += getAccountBalanceSync(acc, transactions, todayStr);
  }

  const txs = transactions.filter(t => selectedAccountIds.includes(t.accountId));

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

/**
 * Legacy API compatibility layer mapping Dexie actions to Cloud Firestore
 */
export const db = {
  _activeBatch: null,
  user_meta: {
    put: async ({ key, value }) => {
      if (!auth.currentUser) return;
      const ref = doc(firestoreDb, 'users_meta', auth.currentUser.uid);
      const fieldMap = {
        'username': 'username',
        'favorite_account_id': 'favoriteAccountId',
        'dashboard_note': 'dashboardNote',
        'photoURL': 'photoURL',
        'theme_preference': 'themePreference',
        'unlocked_themes': 'unlockedThemes',
        'tutorial_progress': 'tutorialProgress'
      };
      const field = fieldMap[key];
      if (field) {
        if (db._activeBatch) {
          db._activeBatch.set(ref, { [field]: value }, { merge: true });
        } else {
          await setDoc(ref, { [field]: value }, { merge: true });
        }
      }
    },
    get: async (key) => {
      if (!auth.currentUser) return null;
      const docSnap = await getDoc(doc(firestoreDb, 'users_meta', auth.currentUser.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (key === 'username') return { key: 'username', value: data.username };
        if (key === 'favorite_account_id') return { key: 'favorite_account_id', value: data.favoriteAccountId };
        if (key === 'dashboard_note') return { key: 'dashboard_note', value: data.dashboardNote };
        if (key === 'photoURL') return { key: 'photoURL', value: data.photoURL };
        if (key === 'theme_preference') return { key: 'theme_preference', value: data.themePreference || 'default' };
        if (key === 'unlocked_themes') return { key: 'unlocked_themes', value: data.unlockedThemes || ['default', 'red', 'blue', 'yellow'] };
        if (key === 'tutorial_progress') return { key: 'tutorial_progress', value: data.tutorialProgress || { isCompleted: false, steps: { accounts: false, calendar: false, debts: false, wishlist: false, home: false, settings: false } } };
      }
      return null;
    },
    clear: async () => {
      if (!auth.currentUser) return;
      const ref = doc(firestoreDb, 'users_meta', auth.currentUser.uid);
      if (db._activeBatch) {
        db._activeBatch.delete(ref);
      } else {
        await deleteDoc(ref);
      }
    },
    bulkAdd: async (list) => {
      if (!auth.currentUser) return;
      const ref = doc(firestoreDb, 'users_meta', auth.currentUser.uid);
      const fields = {};
      list.forEach(m => {
        if (m.key === 'username') fields.username = m.value;
        if (m.key === 'favorite_account_id') fields.favoriteAccountId = m.value;
        if (m.key === 'dashboard_note') fields.dashboardNote = m.value;
        if (m.key === 'photoURL') fields.photoURL = m.value;
        if (m.key === 'theme_preference') fields.themePreference = m.value;
        if (m.key === 'unlocked_themes') fields.unlockedThemes = m.value;
        if (m.key === 'tutorial_progress') fields.tutorialProgress = m.value;
      });
      if (db._activeBatch) {
        db._activeBatch.set(ref, fields, { merge: true });
      } else {
        await setDoc(ref, fields, { merge: true });
      }
    }
  },
  accounts: {
    add: async (data) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      const docData = {
        ...data,
        userId: auth.currentUser.uid
      };
      if (db._activeBatch) {
        const ref = doc(collection(firestoreDb, 'accounts'));
        db._activeBatch.set(ref, docData);
        return ref.id;
      }
      const docRef = await addDoc(collection(firestoreDb, 'accounts'), docData);
      return docRef.id;
    },
    update: async (id, data) => {
      const ref = doc(firestoreDb, 'accounts', id);
      if (db._activeBatch) {
        db._activeBatch.update(ref, data);
      } else {
        await updateDoc(ref, data);
      }
    },
    delete: async (id) => {
      if (!auth.currentUser) return;
      const batch = db._activeBatch || writeBatch(firestoreDb);
      batch.delete(doc(firestoreDb, 'accounts', id));
      
      const txsQuery = query(collection(firestoreDb, 'transactions'), where('accountId', '==', id));
      const txsSnap = await getDocs(txsQuery);
      txsSnap.docs.forEach(docSnap => {
        batch.delete(doc(firestoreDb, 'transactions', docSnap.id));
      });
      
      const pocketsQuery = query(collection(firestoreDb, 'pockets'), where('accountId', '==', id));
      const pocketsSnap = await getDocs(pocketsQuery);
      pocketsSnap.docs.forEach(docSnap => {
        batch.delete(doc(firestoreDb, 'pockets', docSnap.id));
      });
      
      if (!db._activeBatch) {
        await batch.commit();
      }
    },
    clear: async () => {
      if (!auth.currentUser) return;
      const q = query(collection(firestoreDb, 'accounts'), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const batch = db._activeBatch || writeBatch(firestoreDb);
      snap.docs.forEach(docSnap => batch.delete(doc(firestoreDb, 'accounts', docSnap.id)));
      if (!db._activeBatch) {
        await batch.commit();
      }
    },
    bulkAdd: async (list) => {
      if (!auth.currentUser) return;
      const batch = db._activeBatch || writeBatch(firestoreDb);
      list.forEach(item => {
        const ref = doc(collection(firestoreDb, 'accounts'));
        const { id, ...rest } = item;
        batch.set(ref, {
          ...rest,
          userId: auth.currentUser.uid
        });
      });
      if (!db._activeBatch) {
        await batch.commit();
      }
    }
  },
  transactions: {
    add: async (data) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      const docData = {
        ...data,
        userId: auth.currentUser.uid
      };
      const batch = db._activeBatch || writeBatch(firestoreDb);
      const txRef = doc(collection(firestoreDb, 'transactions'));
      batch.set(txRef, docData);

      if (data.pocketId) {
        const pocketRef = doc(firestoreDb, 'pockets', data.pocketId);
        const pocketSnap = await getDoc(pocketRef);
        if (pocketSnap.exists()) {
          const pocketData = pocketSnap.data();
          const current = Number(pocketData.currentAmount) || 0;
          const txAmt = Number(data.amount) || 0;
          const newAmt = data.type === 'debit' ? current - txAmt : current + txAmt;
          batch.update(pocketRef, { currentAmount: newAmt });
        }
      }

      if (!db._activeBatch) {
        await batch.commit();
      }
      return txRef.id;
    },
    update: async (id, data) => {
      const batch = db._activeBatch || writeBatch(firestoreDb);
      const txRef = doc(firestoreDb, 'transactions', id);
      
      const oldTxSnap = await getDoc(txRef);
      if (!oldTxSnap.exists()) {
        throw new Error("Transaction non trouvée");
      }
      const oldTx = oldTxSnap.data();
      const oldPocketId = oldTx.pocketId || null;
      const targetPocketId = data.hasOwnProperty('pocketId') ? data.pocketId : oldPocketId;

      // 1. Revert old pocket if it existed
      if (oldPocketId) {
        const oldPocketRef = doc(firestoreDb, 'pockets', oldPocketId);
        const oldPocketSnap = await getDoc(oldPocketRef);
        if (oldPocketSnap.exists()) {
          const oldPocketData = oldPocketSnap.data();
          const current = Number(oldPocketData.currentAmount) || 0;
          const oldTxAmt = Number(oldTx.amount) || 0;
          const revertedAmt = oldTx.type === 'debit' ? current + oldTxAmt : current - oldTxAmt;
          batch.update(oldPocketRef, { currentAmount: revertedAmt });
        }
      }

      // 2. Apply new pocket if it exists
      if (targetPocketId) {
        const newPocketRef = doc(firestoreDb, 'pockets', targetPocketId);
        const newPocketSnap = await getDoc(newPocketRef);
        if (newPocketSnap.exists()) {
          const newPocketData = newPocketSnap.data();
          let current = Number(newPocketData.currentAmount) || 0;

          // If the pocket is the same, base calculation on the reverted amount in memory
          if (oldPocketId === targetPocketId) {
            const oldTxAmt = Number(oldTx.amount) || 0;
            const revertedAmt = oldTx.type === 'debit' ? current + oldTxAmt : current - oldTxAmt;
            current = revertedAmt;
          }

          const txAmt = Number(data.amount !== undefined ? data.amount : oldTx.amount) || 0;
          const type = data.type !== undefined ? data.type : oldTx.type;
          const newAmt = type === 'debit' ? current - txAmt : current + txAmt;
          batch.update(newPocketRef, { currentAmount: newAmt });
        }
      }

      batch.update(txRef, data);

      if (!db._activeBatch) {
        await batch.commit();
      }
    },
    delete: async (id) => {
      const batch = db._activeBatch || writeBatch(firestoreDb);
      const txRef = doc(firestoreDb, 'transactions', id);
      
      const txSnap = await getDoc(txRef);
      if (txSnap.exists()) {
        const txData = txSnap.data();
        if (txData.pocketId) {
          const pocketRef = doc(firestoreDb, 'pockets', txData.pocketId);
          const pocketSnap = await getDoc(pocketRef);
          if (pocketSnap.exists()) {
            const pocketData = pocketSnap.data();
            const current = Number(pocketData.currentAmount) || 0;
            const txAmt = Number(txData.amount) || 0;
            const revertedAmt = txData.type === 'debit' ? current + txAmt : current - txAmt;
            batch.update(pocketRef, { currentAmount: revertedAmt });
          }
        }
      }

      batch.delete(txRef);

      if (!db._activeBatch) {
        await batch.commit();
      }
    },
    clear: async () => {
      if (!auth.currentUser) return;
      const q = query(collection(firestoreDb, 'transactions'), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const batch = db._activeBatch || writeBatch(firestoreDb);
      snap.docs.forEach(docSnap => batch.delete(doc(firestoreDb, 'transactions', docSnap.id)));
      if (!db._activeBatch) {
        await batch.commit();
      }
    },
    bulkAdd: async (txs) => {
      if (!auth.currentUser || !txs || txs.length === 0) return;
      const currentUid = auth.currentUser.uid;
      const nowIso = new Date().toISOString();
      const chunkSize = 450;
      for (let i = 0; i < txs.length; i += chunkSize) {
        const chunk = txs.slice(i, i + chunkSize);
        const batch = writeBatch(firestoreDb);
        chunk.forEach(tx => {
          const ref = doc(collection(firestoreDb, 'transactions'));
          const { id, ...rest } = tx;
          batch.set(ref, {
            ...rest,
            userId: currentUid,
            allowedUsers: rest.allowedUsers || [currentUid],
            createdAt: rest.createdAt || nowIso
          });
        });
        await batch.commit();
      }
    }
  },
  pockets: {
    add: async (data) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      const docData = {
        ...data,
        userId: auth.currentUser.uid
      };
      if (db._activeBatch) {
        const ref = doc(collection(firestoreDb, 'pockets'));
        db._activeBatch.set(ref, docData);
        return ref.id;
      }
      const docRef = await addDoc(collection(firestoreDb, 'pockets'), docData);
      return docRef.id;
    },
    update: async (id, data) => {
      const ref = doc(firestoreDb, 'pockets', id);
      if (db._activeBatch) {
        db._activeBatch.update(ref, data);
      } else {
        await updateDoc(ref, data);
      }
    },
    delete: async (id) => {
      const ref = doc(firestoreDb, 'pockets', id);
      if (db._activeBatch) {
        db._activeBatch.delete(ref);
      } else {
        await deleteDoc(ref);
      }
    },
    clear: async () => {
      if (!auth.currentUser) return;
      const q = query(collection(firestoreDb, 'pockets'), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const batch = db._activeBatch || writeBatch(firestoreDb);
      snap.docs.forEach(docSnap => batch.delete(doc(firestoreDb, 'pockets', docSnap.id)));
      if (!db._activeBatch) {
        await batch.commit();
      }
    },
    bulkAdd: async (list) => {
      if (!auth.currentUser) return;
      const batch = db._activeBatch || writeBatch(firestoreDb);
      list.forEach(item => {
        const ref = doc(collection(firestoreDb, 'pockets'));
        const { id, ...rest } = item;
        batch.set(ref, {
          ...rest,
          userId: auth.currentUser.uid
        });
      });
      if (!db._activeBatch) {
        await batch.commit();
      }
    }
  },
  wishlist: {
    add: async (data) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      const docData = {
        ...data,
        userId: auth.currentUser.uid
      };
      if (db._activeBatch) {
        const ref = doc(collection(firestoreDb, 'wishlist'));
        db._activeBatch.set(ref, docData);
        return ref.id;
      }
      const docRef = await addDoc(collection(firestoreDb, 'wishlist'), docData);
      return docRef.id;
    },
    update: async (id, data) => {
      const ref = doc(firestoreDb, 'wishlist', id);
      if (db._activeBatch) {
        db._activeBatch.update(ref, data);
      } else {
        await updateDoc(ref, data);
      }
    },
    delete: async (id) => {
      const ref = doc(firestoreDb, 'wishlist', id);
      if (db._activeBatch) {
        db._activeBatch.delete(ref);
      } else {
        await deleteDoc(ref);
      }
    },
    clear: async () => {
      if (!auth.currentUser) return;
      const q = query(collection(firestoreDb, 'wishlist'), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const batch = db._activeBatch || writeBatch(firestoreDb);
      snap.docs.forEach(docSnap => batch.delete(doc(firestoreDb, 'wishlist', docSnap.id)));
      if (!db._activeBatch) {
        await batch.commit();
      }
    },
    bulkAdd: async (list) => {
      if (!auth.currentUser) return;
      const batch = db._activeBatch || writeBatch(firestoreDb);
      list.forEach(item => {
        const ref = doc(collection(firestoreDb, 'wishlist'));
        const { id, ...rest } = item;
        batch.set(ref, {
          ...rest,
          userId: auth.currentUser.uid
        });
      });
      if (!db._activeBatch) {
        await batch.commit();
      }
    }
  },
  friendships: {
    sendRequest: async (targetIdentifier) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      const cleanTarget = (targetIdentifier || '').trim();
      if (!cleanTarget) throw new Error("Identifiant invalide");

      if (
        cleanTarget.toLowerCase() === auth.currentUser.email?.toLowerCase() ||
        cleanTarget === auth.currentUser.uid
      ) {
        throw new Error("Tu ne peux pas t'envoyer une demande d'ami à toi-même !");
      }

      let friendDoc = null;
      let friendId = '';
      let friendData = null;

      // 1. Try finding target by UID in users_meta first
      const directDocRef = doc(firestoreDb, 'users_meta', cleanTarget);
      const directSnap = await getDoc(directDocRef);

      if (directSnap.exists()) {
        friendDoc = directSnap;
        friendId = directSnap.id;
        friendData = directSnap.data();
      } else {
        // Search by email
        const q = query(collection(firestoreDb, 'users_meta'), where('email', '==', cleanTarget.toLowerCase()));
        const snap = await getDocs(q);
        if (snap.empty) {
          throw new Error("Aucun habitant trouvé avec cette adresse e-mail.");
        }
        friendDoc = snap.docs[0];
        friendId = friendDoc.id;
        friendData = friendDoc.data();
      }

      if (friendId === auth.currentUser.uid) {
        throw new Error("Tu ne peux pas t'envoyer une demande d'ami à toi-même !");
      }

      // Check if target user has put currentUser in their Redlist
      const targetRedlist = Array.isArray(friendData.redlist) ? friendData.redlist : [];
      if (targetRedlist.includes(auth.currentUser.uid)) {
        throw new Error("Impossible d'envoyer une demande à cet habitant.");
      }

      // 2. Check if a friendship already exists or is pending
      const qExist1 = query(
        collection(firestoreDb, 'friendships'),
        where('senderId', '==', auth.currentUser.uid),
        where('receiverId', '==', friendId)
      );
      const qExist2 = query(
        collection(firestoreDb, 'friendships'),
        where('senderId', '==', friendId),
        where('receiverId', '==', auth.currentUser.uid)
      );
      const snapExist1 = await getDocs(qExist1);
      const snapExist2 = await getDocs(qExist2);

      const existingDocs = [...snapExist1.docs, ...snapExist2.docs].map(d => d.data());
      if (existingDocs.some(f => f.status === 'accepted')) {
        throw new Error("Vous êtes déjà amis avec cet habitant.");
      }
      if (existingDocs.some(f => f.status === 'pending')) {
        throw new Error("Une demande est déjà en attente avec cet habitant.");
      }

      // 3. Fetch current user meta to get their username
      const myMetaDoc = await getDoc(doc(firestoreDb, 'users_meta', auth.currentUser.uid));
      const myName = myMetaDoc.exists() ? (myMetaDoc.data().username || 'Habitant') : 'Habitant';

      // 4. Add friendship request
      const docData = {
        senderId: auth.currentUser.uid,
        senderEmail: (auth.currentUser.email || '').toLowerCase(),
        senderName: myName,
        receiverId: friendId,
        receiverEmail: (friendData.email || '').toLowerCase(),
        receiverName: friendData.username || 'Habitant',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(firestoreDb, 'friendships'), docData);
    },
    acceptRequest: async (id) => {
      const ref = doc(firestoreDb, 'friendships', id);
      await updateDoc(ref, { status: 'accepted' });
    },
    rejectAndRedlist: async (id, senderUid) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      if (senderUid) {
        const myMetaRef = doc(firestoreDb, 'users_meta', auth.currentUser.uid);
        try {
          await updateDoc(myMetaRef, {
            redlist: arrayUnion(senderUid)
          });
        } catch (err) {
          await setDoc(myMetaRef, { redlist: arrayUnion(senderUid) }, { merge: true });
        }
      }
      if (id) {
        const ref = doc(firestoreDb, 'friendships', id);
        await deleteDoc(ref);
      }
    },
    addToRedlist: async (uid) => {
      if (!auth.currentUser || !uid) return;
      const myMetaRef = doc(firestoreDb, 'users_meta', auth.currentUser.uid);
      try {
        await updateDoc(myMetaRef, {
          redlist: arrayUnion(uid)
        });
      } catch (err) {
        await setDoc(myMetaRef, { redlist: arrayUnion(uid) }, { merge: true });
      }
    },
    removeFromRedlist: async (uid) => {
      if (!auth.currentUser || !uid) return;
      const myMetaRef = doc(firestoreDb, 'users_meta', auth.currentUser.uid);
      await updateDoc(myMetaRef, {
        redlist: arrayRemove(uid)
      });
    },
    delete: async (id) => {
      const ref = doc(firestoreDb, 'friendships', id);
      await deleteDoc(ref);
    }
  },
  debts: {
    add: async (data) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      const docData = {
        ...data,
        userId: auth.currentUser.uid
      };
      if (db._activeBatch) {
        const ref = doc(collection(firestoreDb, 'debts'));
        db._activeBatch.set(ref, docData);
        return ref.id;
      }
      const docRef = await addDoc(collection(firestoreDb, 'debts'), docData);
      return docRef.id;
    },
    update: async (id, data) => {
      const ref = doc(firestoreDb, 'debts', id);
      if (db._activeBatch) {
        db._activeBatch.update(ref, data);
      } else {
        await updateDoc(ref, data);
      }
    },
    delete: async (id) => {
      const ref = doc(firestoreDb, 'debts', id);
      if (db._activeBatch) {
        db._activeBatch.delete(ref);
      } else {
        await deleteDoc(ref);
      }
    },
    clear: async () => {
      if (!auth.currentUser) return;
      const q = query(collection(firestoreDb, 'debts'), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const batch = db._activeBatch || writeBatch(firestoreDb);
      snap.docs.forEach(docSnap => batch.delete(doc(firestoreDb, 'debts', docSnap.id)));
      if (!db._activeBatch) {
        await batch.commit();
      }
    },
    bulkAdd: async (list) => {
      if (!auth.currentUser) return;
      const batch = db._activeBatch || writeBatch(firestoreDb);
      list.forEach(item => {
        const ref = doc(collection(firestoreDb, 'debts'));
        const { id, ...rest } = item;
        batch.set(ref, {
          ...rest,
          userId: auth.currentUser.uid
        });
      });
      if (!db._activeBatch) {
        await batch.commit();
      }
    }
  },
  categories: {
    add: async () => {},
    delete: async () => {},
    clear: async () => {},
    bulkAdd: async () => {}
  },
  transaction: async (...args) => {
    const fn = args[args.length - 1];
    if (typeof fn !== 'function') throw new Error("Transaction callback is not a function");
    if (db._activeBatch) {
      return fn();
    }
    const batch = writeBatch(firestoreDb);
    db._activeBatch = batch;
    try {
      const result = await fn();
      await batch.commit();
      return result;
    } catch (err) {
      db._activeBatch = null;
      throw err;
    } finally {
      db._activeBatch = null;
    }
  }
};

/**
 * Cascade deletion for admin operations:
 * Purges ALL associated documents across all collections in batch chunks <= 450
 */
export async function purgeUserCascadeData(targetUid) {
  if (!targetUid) return;

  const docRefsToDelete = new Map();

  const addDocRef = (docRef) => {
    if (docRef && docRef.path) {
      docRefsToDelete.set(docRef.path, docRef);
    }
  };

  const collectionsToCheck = [
    { name: 'accounts', fields: ['userId', 'creatorId', 'ownerId'] },
    { name: 'pockets', fields: ['userId', 'creatorId', 'ownerId'] },
    { name: 'transactions', fields: ['userId', 'creatorId', 'ownerId'] },
    { name: 'wishlist', fields: ['userId', 'creatorId', 'ownerId'] },
    { name: 'wishlists', fields: ['userId', 'creatorId', 'ownerId'] },
    { name: 'debts', fields: ['userId', 'creatorId', 'ownerId'] },
    { name: 'imports', fields: ['userId', 'creatorId', 'ownerId'] }
  ];

  for (const col of collectionsToCheck) {
    for (const field of col.fields) {
      try {
        const q = query(collection(firestoreDb, col.name), where(field, '==', targetUid));
        const snap = await getDocs(q);
        snap.docs.forEach(d => addDocRef(d.ref));
      } catch (err) {
        console.warn(`Query on ${col.name} (${field}) warning:`, err?.message);
      }
    }
  }

  // Friendships where user is sender or receiver
  try {
    const qSender = query(collection(firestoreDb, 'friendships'), where('senderId', '==', targetUid));
    const snapSender = await getDocs(qSender);
    snapSender.docs.forEach(d => addDocRef(d.ref));
  } catch (err) {
    console.warn("Friendships sender query warning:", err?.message);
  }

  try {
    const qReceiver = query(collection(firestoreDb, 'friendships'), where('receiverId', '==', targetUid));
    const snapReceiver = await getDocs(qReceiver);
    snapReceiver.docs.forEach(d => addDocRef(d.ref));
  } catch (err) {
    console.warn("Friendships receiver query warning:", err?.message);
  }

  // Commit deletions in batch chunks of <= 450
  const allRefs = Array.from(docRefsToDelete.values());
  const CHUNK_SIZE = 450;
  for (let i = 0; i < allRefs.length; i += CHUNK_SIZE) {
    const chunk = allRefs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(firestoreDb);
    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * CAS A : ACTION "RÉINITIALISER" L'UTILISATEUR
 * Purge l'ensemble des sous-données et remet le document users_meta à zéro.
 */
export async function adminResetUser(targetUid) {
  if (!targetUid) return;

  // 1. Purge all cascade data
  await purgeUserCascadeData(targetUid);

  // 2. Reset users_meta/{targetUid}
  const userRef = doc(firestoreDb, 'users_meta', targetUid);
  await updateDoc(userRef, {
    favoriteAccountId: null,
    dashboardNote: '',
    tutorialProgress: {
      isCompleted: false,
      steps: {
        accounts: false,
        calendar: false,
        debts: false,
        wishlist: false,
        home: false,
        settings: false
      }
    }
  });
}

/**
 * CAS B : ACTION "SUPPRIMER DÉFINITIVEMENT" L'UTILISATEUR
 * Purge l'ensemble des sous-données et supprime définitivement users_meta/{targetUid}.
 */
export async function adminDeleteUser(targetUid) {
  if (!targetUid) return;

  // 1. Purge all cascade data
  await purgeUserCascadeData(targetUid);

  // 2. Delete users_meta/{targetUid}
  const userRef = doc(firestoreDb, 'users_meta', targetUid);
  await deleteDoc(userRef);
}

/**
 * ACTION 1 (Paramètres) : RÉINITIALISER MON ÎLE / MES DONNÉES
 * Purge toutes les sous-données et réinitialise users_meta sans déconnecter l'utilisateur.
 */
export async function resetMyAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Aucun habitant connecté");
  await adminResetUser(user.uid);
}

/**
 * ACTION 2 (Paramètres) : SUPPRIMER DÉFINITIVEMENT MON COMPTE
 * Purge toutes les sous-données, supprime users_meta, supprime l'authentification (ou signOut) et vide le stockage.
 */
export async function deleteMyAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Aucun habitant connecté");
  const uid = user.uid;

  // 1. Purge all cascade data
  await purgeUserCascadeData(uid);

  // 2. Delete users_meta document
  const userRef = doc(firestoreDb, 'users_meta', uid);
  await deleteDoc(userRef);

  // 3. Try to delete the Firebase Auth user, fallback to signOut
  try {
    await user.delete();
  } catch (err) {
    console.warn("Impossible de supprimer le compte Auth directement (re-authentification requise), déconnexion fallback:", err);
    await signOut(auth);
  }

  // 4. Clear storage & set feedback message for login screen
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('auth_toast', 'Votre compte a été supprimé avec succès.');

  // 5. Reload to return to login screen
  window.location.reload();
}

/**
 * Firebase React Context & Hook definition
 */
const DbContext = createContext(null);

export const useDb = () => {
  const context = useContext(DbContext);
  if (!context) throw new Error("useDb must be used within a DbProvider");
  return context;
};

/**
 * Calculates the active theme based on user profile preferences and category list,
 * strictly applying the following priority:
 * 1. Priority 1 (Easter Egg 3): Category name exactly "waif" (case-insensitive) -> "NEON_MULTICOLOR"
 * 2. Priority 2 (Easter Egg 2): User's username is exactly "Wayfs" (case-insensitive) -> "DARK_BLUE_PURPLE"
 * 3. Priority 3 (Easter Egg 1): User's username is "Léa" or "Lea" (case-insensitive) -> "SAKURA_PINK_PURPLE"
 * 4. Priority 4: Manual choice themePreference ('default', 'red', 'blue', 'yellow')
 */
export function getActiveTheme(userProfile, categories) {
  const unlocked = userProfile?.unlockedThemes || ['default', 'red', 'blue', 'yellow'];
  const pref = userProfile?.themePreference || 'default';
  if (unlocked.includes(pref)) {
    return pref;
  }
  return 'default';
}

export const DbProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore Realtime Collections
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pockets, setPockets] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [categories, setCategories] = useState([]);
  const [debts, setDebts] = useState([]);
  const [friendships, setFriendships] = useState([]);
  
  // Single document state
  const [usersMetaDoc, setUsersMetaDoc] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [allUsersMeta, setAllUsersMeta] = useState([]);

  // Calculate the active theme dynamically
  const activeTheme = useMemo(() => {
    return getActiveTheme(usersMetaDoc, categories);
  }, [usersMetaDoc, categories]);

  // Permanent Theme Unlock Triggers Listener
  useEffect(() => {
    if (!currentUser || !usersMetaDoc) return;

    const unlocked = usersMetaDoc.unlockedThemes || ['default', 'red', 'blue', 'yellow'];
    const username = usersMetaDoc.username || '';
    const themePref = usersMetaDoc.themePreference || 'default';

    let needsUpdate = false;
    const nextUnlocked = [...unlocked];
    let nextThemePref = themePref;

    // 1. Easter Egg Léa
    const normalizedUsername = username.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (normalizedUsername === 'lea' && !nextUnlocked.includes('lea')) {
      nextUnlocked.push('lea');
      nextThemePref = 'lea';
      needsUpdate = true;
      alert("🎉 Thème Sakura (Rose & Violet) débloqué pour toujours !");
    }

    // 2. Easter Egg Wayfs
    if (username.toLowerCase().trim() === 'wayfs' && !nextUnlocked.includes('wayfs')) {
      nextUnlocked.push('wayfs');
      nextThemePref = 'wayfs';
      needsUpdate = true;
      alert("🎉 Thème Abyssal (Bleu & Violet) débloqué pour toujours !");
    }

    // 3. Easter Egg Waif
    const hasWaifCategory = categories?.some(cat => cat.name?.toLowerCase().trim() === 'waif');
    if (hasWaifCategory && !nextUnlocked.includes('neon')) {
      nextUnlocked.push('neon');
      nextThemePref = 'neon';
      needsUpdate = true;
      alert("🎉 Thème Néon Cyberpunk débloqué pour toujours !");
    }

    if (needsUpdate) {
      const metaRef = doc(firestoreDb, 'users_meta', currentUser.uid);
      updateDoc(metaRef, {
        unlockedThemes: nextUnlocked,
        themePreference: nextThemePref
      }).catch(err => console.error("Error unlocking theme:", err));
    }
  }, [currentUser, usersMetaDoc, categories]);

  // Sign up and create user profile & default categories
  const signUpUser = async (email, password, firstname) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create users_meta doc
    const metaRef = doc(firestoreDb, 'users_meta', user.uid);
    await setDoc(metaRef, {
      uid: user.uid,
      username: firstname.trim(),
      email: email.trim().toLowerCase(),
      favoriteAccountId: null,
      dashboardNote: '',
      photoURL: '/pfp-ac.jpg',
      themePreference: 'default',
      unlockedThemes: ['default', 'red', 'blue', 'yellow'],
      role: email.trim().toLowerCase() === 'matysallanet@gmail.com' ? 'admin' : 'member',
      createdAt: new Date().toISOString(),
      tutorialProgress: {
        isCompleted: false,
        steps: {
          accounts: false,
          calendar: false,
          debts: false,
          wishlist: false,
          home: false,
          settings: false
        }
      }
    });
    
    return user;
  };

  const logInUser = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user) {
        const metaRef = doc(firestoreDb, 'users_meta', user.uid);
        const docSnap = await getDoc(metaRef);

        if (!docSnap.exists()) {
          await setDoc(metaRef, {
            uid: user.uid,
            email: user.email,
            username: user.displayName || "Habitant",
            photoURL: user.photoURL || "/pfp-ac.jpg",
            role: user.email === "matysallanet@gmail.com" ? "admin" : "member",
            themePreference: "default",
            unlockedThemes: ["default", "red", "blue", "yellow"],
            favoriteAccountId: null,
            dashboardNote: "",
            createdAt: new Date().toISOString(),
            tutorialProgress: {
              isCompleted: false,
              steps: { accounts: false, calendar: false, debts: false, wishlist: false, home: false, settings: false }
            }
          });
        } else {
          await setDoc(metaRef, {
            email: user.email,
            photoURL: user.photoURL || "/pfp-ac.jpg"
          }, { merge: true });
        }
      }

      return user;
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log("Connexion Google annulée par l'utilisateur.");
        return null;
      }
      console.error("Erreur Google Auth:", error);
      throw error;
    }
  };

  const logOutUser = async () => {
    return signOut(auth);
  };

  // Auth Subscription
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        // Clear state if logged out
        setAccounts([]);
        setTransactions([]);
        setPockets([]);
        setWishlist([]);
        setCategories([]);
        setDebts([]);
        setFriendships([]);
        setUsersMetaDoc(null);
      }
    });
    return unsubscribeAuth;
  }, []);

  // Data Subscription (only when logged in)
  useEffect(() => {
    if (!currentUser) return;
    
    setDataLoading(true);
    let unsubscribes = [];

    // 1. Subscribe to users_meta doc
    const metaRef = doc(firestoreDb, 'users_meta', currentUser.uid);
    let hadDoc = false;
    let initialGraceTimer = setTimeout(() => {
      // If after 5 seconds the document still doesn't exist (e.g. orphaned token), disconnect
      if (!hadDoc) {
        console.warn("Aucun profil users_meta trouvé après le délai d'attente initial. Déconnexion...");
        signOut(auth).then(() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
        }).catch(() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
        });
      }
    }, 5000);

    const unsubMeta = onSnapshot(metaRef, (docSnap) => {
      if (docSnap.exists()) {
        hadDoc = true;
        if (initialGraceTimer) {
          clearTimeout(initialGraceTimer);
          initialGraceTimer = null;
        }
        const data = docSnap.data();
        setUsersMetaDoc(data);
        const updates = {};
        if (!data.email && currentUser.email) {
          updates.email = currentUser.email.toLowerCase();
        }
        if (!data.photoURL) {
          updates.photoURL = currentUser.photoURL || '/pfp-ac.jpg';
        }
        if (currentUser.email?.toLowerCase() === 'matysallanet@gmail.com' && data.role !== 'admin') {
          updates.role = 'admin';
        } else if (!data.role) {
          updates.role = 'member';
        }
        if (Object.keys(updates).length > 0) {
          updateDoc(metaRef, updates).catch(err => console.error(err));
        }
      } else {
        // Only trigger immediate logout if the document previously existed during this active session
        // (i.e. was just deleted in real-time by an admin)
        if (hadDoc) {
          console.warn("Profil utilisateur supprimé en temps réel par l'administrateur. Déconnexion...");
          signOut(auth).then(() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }).catch((err) => {
            console.error("Erreur lors de la déconnexion forcée:", err);
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          });
        }
      }
    }, (err) => {
      console.error("Erreur d'écoute users_meta:", err);
    });

    unsubscribes.push(() => {
      if (initialGraceTimer) clearTimeout(initialGraceTimer);
      unsubMeta();
    });

    // Subscribe to all users_meta to get names and avatars reactively
    const unsubAllMeta = onSnapshot(collection(firestoreDb, 'users_meta'), (snapshot) => {
      setAllUsersMeta(snapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
    unsubscribes.push(unsubAllMeta);

    // Helpers for snapshot listeners targeting document owner (userId or legacy fields: creatorId, ownerId, allowedUsers)
    const subscribeCollectionOwned = (colName, setList) => {
      const docsMap = {};
      const notify = () => {
        const list = Object.values(docsMap);
        if (colName === 'debts') {
          console.log("Dettes brutes Firestore :", list);
        }
        setList(list);
      };

      const handleSnapshot = (snapshot) => {
        snapshot.docs.forEach(d => {
          docsMap[d.id] = { id: d.id, ...d.data() };
        });
        snapshot.docChanges().forEach(change => {
          if (change.type === 'removed') {
            delete docsMap[change.doc.id];
          }
        });
        notify();
      };

      const qUserId = query(collection(firestoreDb, colName), where('userId', '==', currentUser.uid));
      const qCreatorId = query(collection(firestoreDb, colName), where('creatorId', '==', currentUser.uid));
      const qOwnerId = query(collection(firestoreDb, colName), where('ownerId', '==', currentUser.uid));
      const qAllowed = query(collection(firestoreDb, colName), where('allowedUsers', 'array-contains', currentUser.uid));

      const unsubs = [
        onSnapshot(qUserId, handleSnapshot, err => console.error(`[${colName}] qUserId error:`, err)),
        onSnapshot(qCreatorId, handleSnapshot, err => console.error(`[${colName}] qCreatorId error:`, err)),
        onSnapshot(qOwnerId, handleSnapshot, err => console.error(`[${colName}] qOwnerId error:`, err)),
        onSnapshot(qAllowed, handleSnapshot, err => console.error(`[${colName}] qAllowed error:`, err)),
      ];

      return () => unsubs.forEach(unsub => unsub());
    };

    unsubscribes.push(subscribeCollectionOwned('accounts', setAccounts));
    unsubscribes.push(subscribeCollectionOwned('wishlist', setWishlist));
    unsubscribes.push(subscribeCollectionOwned('debts', setDebts));


    // Friendships Subscriptions (both senderId and receiverId)
    const qFriendshipsSender = query(collection(firestoreDb, 'friendships'), where('senderId', '==', currentUser.uid));
    const qFriendshipsReceiver = query(collection(firestoreDb, 'friendships'), where('receiverId', '==', currentUser.uid));
    
    const friendshipsMap = {};
    const updateFriendshipsState = () => {
      setFriendships(Object.values(friendshipsMap));
    };

    const unsubSenders = onSnapshot(qFriendshipsSender, (snapshot) => {
      snapshot.docs.forEach(docSnap => {
        friendshipsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          delete friendshipsMap[change.doc.id];
        }
      });
      updateFriendshipsState();
    });
    unsubscribes.push(unsubSenders);

    const unsubReceivers = onSnapshot(qFriendshipsReceiver, (snapshot) => {
      snapshot.docs.forEach(docSnap => {
        friendshipsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          delete friendshipsMap[change.doc.id];
        }
      });
      updateFriendshipsState();
    });
    unsubscribes.push(unsubReceivers);

    // Wait a brief moment to let snapshots populate before disabling loader
    const timer = setTimeout(() => {
      setDataLoading(false);
    }, 850);

    return () => {
      unsubscribes.forEach(unsub => unsub());
      clearTimeout(timer);
    };
  }, [currentUser]);

  // Reactive subscription for transactions and pockets (based on authorized accounts)
  useEffect(() => {
    if (!currentUser) {
      setTransactions([]);
      setPockets([]);
      return;
    }
    
    const accountIds = accounts.map(a => a.id);
    if (accountIds.length === 0) {
      setTransactions([]);
      setPockets([]);
      return;
    }

    // Chunk size 30 for 'in' operator limits in Firestore (safest batching)
    const chunks = [];
    for (let i = 0; i < accountIds.length; i += 30) {
      chunks.push(accountIds.slice(i, i + 30));
    }

    const unsubscribes = [];
    const transactionsMap = {};
    const pocketsMap = {};

    const updateTransactionsState = () => {
      setTransactions(Object.values(transactionsMap));
    };

    const updatePocketsState = () => {
      setPockets(Object.values(pocketsMap));
    };

    chunks.forEach(chunk => {
      const qTx = query(collection(firestoreDb, 'transactions'), where('accountId', 'in', chunk));
      const unsubTx = onSnapshot(qTx, (snapshot) => {
        snapshot.docs.forEach(docSnap => {
          transactionsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        snapshot.docChanges().forEach(change => {
          if (change.type === 'removed') {
            delete transactionsMap[change.doc.id];
          }
        });
        updateTransactionsState();
      });
      unsubscribes.push(unsubTx);

      const qPocket = query(collection(firestoreDb, 'pockets'), where('accountId', 'in', chunk));
      const unsubPocket = onSnapshot(qPocket, (snapshot) => {
        snapshot.docs.forEach(docSnap => {
          pocketsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        snapshot.docChanges().forEach(change => {
          if (change.type === 'removed') {
            delete pocketsMap[change.doc.id];
          }
        });
        updatePocketsState();
      });
      unsubscribes.push(unsubPocket);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [accounts, currentUser]);

  // Pockets auto-renewal effect
  useEffect(() => {
    if (!currentUser || pockets.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const updateRenewals = async () => {
      const batch = writeBatch(firestoreDb);
      let hasUpdates = false;

      for (const pocket of pockets) {
        if (pocket.renewalFrequency && pocket.renewalFrequency !== 'none' && pocket.nextRenewalDate) {
          if (pocket.nextRenewalDate <= todayStr) {
            let nextDate = pocket.nextRenewalDate;
            let currentBal = Number(pocket.currentAmount) || 0;
            const allocated = Number(pocket.allocatedAmount) || 0;

            while (nextDate && nextDate <= todayStr) {
              const computed = getNextRenewalDate(nextDate, pocket.renewalFrequency, pocket.renewalDay);
              if (!computed || computed === nextDate) break;
              nextDate = computed;
              currentBal = pocket.accumulate ? allocated + Math.max(0, currentBal) : allocated;
            }

            const ref = doc(firestoreDb, 'pockets', pocket.id);
            batch.update(ref, {
              currentAmount: currentBal,
              nextRenewalDate: nextDate
            });
            hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        await batch.commit();
      }
    };

    updateRenewals().catch(err => console.error("Error auto-renewing pockets:", err));
  }, [pockets, currentUser]);

  // Derived userMeta compatibility format (array of {key, value})
  const userMeta = useMemo(() => {
    const list = [];
    if (usersMetaDoc) {
      if (usersMetaDoc.username !== undefined) {
        list.push({ key: 'username', value: usersMetaDoc.username });
      }
      if (usersMetaDoc.favoriteAccountId !== undefined) {
        list.push({ key: 'favorite_account_id', value: usersMetaDoc.favoriteAccountId });
      }
      if (usersMetaDoc.dashboardNote !== undefined) {
        list.push({ key: 'dashboard_note', value: usersMetaDoc.dashboardNote });
      }
      if (usersMetaDoc.photoURL !== undefined) {
        list.push({ key: 'photoURL', value: usersMetaDoc.photoURL });
      }
      if (usersMetaDoc.themePreference !== undefined) {
        list.push({ key: 'theme_preference', value: usersMetaDoc.themePreference });
      }
      if (usersMetaDoc.unlockedThemes !== undefined) {
        list.push({ key: 'unlocked_themes', value: usersMetaDoc.unlockedThemes });
      }
      if (usersMetaDoc.tutorialProgress !== undefined) {
        list.push({ key: 'tutorial_progress', value: usersMetaDoc.tutorialProgress });
      }
    }
    return list;
  }, [usersMetaDoc]);

  // Derived state: accountsData with live balances pre-calculated
  const accountsData = useMemo(() => {
    if (!accounts || !transactions) return [];
    return accounts.map(acc => {
      const balance = getAccountBalanceSync(acc, transactions);
      return { ...acc, balance, visibleBalance: balance };
    }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [accounts, transactions]);

  // Derived state: favoriteAccountDetails
  const favoriteAccountDetails = useMemo(() => {
    if (accountsData.length === 0) return null;
    
    let favId = usersMetaDoc?.favoriteAccountId;
    if (!favId || !accountsData.some(a => a.id === favId)) {
      favId = accountsData[0].id;
    }

    const favAccount = accountsData.find(a => a.id === favId);
    if (!favAccount) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const prevDate = new Date();
    prevDate.setDate(prevDate.getDate() - 30);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    const balToday = getAccountBalanceSync(favAccount, transactions, todayStr);
    const balPrev = getAccountBalanceSync(favAccount, transactions, prevDateStr);

    let variationPct = 0;
    if (balPrev !== 0) {
      variationPct = ((balToday - balPrev) / Math.abs(balPrev)) * 100;
    } else if (balToday !== 0) {
      variationPct = balToday > 0 ? 100 : -100;
    }

    // Latest 5 transactions for favorite account
    const favTxs = transactions
      .filter(t => t.accountId === favId)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    return {
      account: favAccount,
      variationPct,
      latestTxs: favTxs
    };
  }, [accountsData, usersMetaDoc, transactions]);

  // Derived state: globalLatestTransactions
  const globalLatestTransactions = useMemo(() => {
    return transactions
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [transactions]);

  // Derived state: acceptedFriends (friends with status === 'accepted', strictly sorted alphabetically by name)
  const acceptedFriends = useMemo(() => {
    if (!friendships || !currentUser) return [];
    return friendships
      .filter(f => f.status === 'accepted')
      .map(f => {
        const isSender = f.senderId === currentUser.uid;
        const friendUid = isSender ? f.receiverId : f.senderId;
        const meta = allUsersMeta.find(m => m.uid === friendUid);
        return {
          id: f.id,
          uid: friendUid,
          email: isSender ? f.receiverEmail : f.senderEmail,
          name: meta?.username || (isSender ? f.receiverName : f.senderName) || (isSender ? f.receiverEmail : f.senderEmail) || 'Habitant',
          photoURL: meta?.photoURL || meta?.avatarUrl || '/pfp-ac.jpg'
        };
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [friendships, currentUser, allUsersMeta]);

  // Derived state: count of received pending friend requests
  const pendingRequestsCount = useMemo(() => {
    if (!friendships || !currentUser) return 0;
    return friendships.filter(f => f.status === 'pending' && f.receiverId === currentUser.uid).length;
  }, [friendships, currentUser]);

  const value = {
    isLoading: authLoading || dataLoading,
    user: currentUser,
    username: usersMetaDoc?.username || '',
    userProfile: usersMetaDoc,
    usersMetaDoc,
    userMeta,
    accounts,
    transactions,
    pockets,
    wishlist,
    categories,
    debts,
    friendships,
    acceptedFriends,
    redlist: Array.isArray(usersMetaDoc?.redlist) ? usersMetaDoc.redlist : [],
    accountsData,
    favoriteAccountDetails,
    globalLatestTransactions,
    signUpUser,
    logInUser,
    loginWithGoogle,
    logOutUser,
    allUsersMeta,
    activeTheme,
    getActiveTheme,
    unlockedThemes: usersMetaDoc?.unlockedThemes || ['default', 'red', 'blue', 'yellow'],
    pendingRequestsCount,
    adminResetUser,
    adminDeleteUser,
    purgeUserCascadeData,
    resetMyAccount,
    deleteMyAccount,
    isAdmin: usersMetaDoc?.role === 'admin' || currentUser?.email?.toLowerCase() === 'matysallanet@gmail.com',
    tutorialProgress: {
      isCompleted: usersMetaDoc?.tutorialProgress?.isCompleted ?? false,
      steps: {
        accounts: usersMetaDoc?.tutorialProgress?.steps?.accounts ?? false,
        calendar: usersMetaDoc?.tutorialProgress?.steps?.calendar ?? false,
        debts: usersMetaDoc?.tutorialProgress?.steps?.debts ?? false,
        wishlist: usersMetaDoc?.tutorialProgress?.steps?.wishlist ?? false,
        home: usersMetaDoc?.tutorialProgress?.steps?.home ?? false,
        settings: usersMetaDoc?.tutorialProgress?.steps?.settings ?? false
      }
    }
  };

  return (
    <DbContext.Provider value={value}>
      {children}
    </DbContext.Provider>
  );
};

export const COLOR_PALETTE = [
  { id: 'green', hex: '#78B159', bg: '#F3F9EE', border: '#78B159', label: 'Vert' },
  { id: 'blue', hex: '#6CBAD8', bg: '#EEF8FC', border: '#6CBAD8', label: 'Bleu' },
  { id: 'red', hex: '#D9534F', bg: '#FCF0F0', border: '#D9534F', label: 'Rouge' },
  { id: 'yellow', hex: '#F1B24A', bg: '#FEF9ED', border: '#F1B24A', label: 'Jaune' },
  { id: 'purple', hex: '#9B59B6', bg: '#F8F1FC', border: '#9B59B6', label: 'Violet' },
  { id: 'orange', hex: '#E67E22', bg: '#FDF4EB', border: '#E67E22', label: 'Orange' },
  { id: 'neutral', hex: '#8C6D58', bg: '#FFFDF9', border: '#8C6D58', label: 'Beige / Neutre' },
];

export const getCustomCardStyle = (color) => {
  if (!color) return { backgroundColor: '#FFFDF9' };
  const found = COLOR_PALETTE.find(c => (c.hex && c.hex.toLowerCase() === color.toLowerCase()) || c.id === color);
  if (found) {
    return { backgroundColor: found.bg };
  }
  return { backgroundColor: color };
};

