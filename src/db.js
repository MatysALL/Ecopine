import Dexie from 'dexie';

export const db = new Dexie('EcopineDB');

db.version(2).stores({
  accounts: '++id, name, type, initialBalance, rate',
  transactions: '++id, accountId, date, amount, description, category, isRecurring, recurrencePeriod, recurrenceEnd',
  envelopes: '++id, accountId, name, monthlyLimit, carryOver, blockBalance',
  budgets: '++id, month, limit',
  user_meta: '++id, key, value'
});

// Explicitly open the database and handle schema collisions
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


// Recalculates actual balance for an account by summing all past and present transactions
export async function getAccountBalance(accountId) {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;
  
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .toArray();
    
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Only sum transactions that are today or in the past
  const pastTransactionsSum = transactions
    .filter(t => t.date <= todayStr)
    .reduce((sum, t) => sum + Number(t.amount), 0);
    
  return Number(account.initialBalance) + pastTransactionsSum;
}

// Calculate the carry-over surplus/deficit for envelopes.
// An envelope has a monthly limit. We need to check past months to see what was spent versus limit.
// Let's implement dynamic carryOver calculation.
export async function getEnvelopeStatus(envelope, targetYear, targetMonth) {
  const accountId = envelope.accountId;
  const targetMonthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  
  // Find transactions for this account belonging to the envelope category
  const txs = await db.transactions
    .where('accountId')
    .equals(accountId)
    .toArray();
  
  // Filter transactions by envelope name (matching category)
  const envTxs = txs.filter(t => t.category === envelope.name);
  
  let currentMonthSpent = envTxs
    .filter(t => t.date.startsWith(targetMonthStr))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  let carryOverAmount = 0;

  if (envelope.carryOver) {
    // We need to calculate carry-over from all previous months up to targetMonth.
    // Let's find the earliest transaction date or start from when accounts/envelopes were created.
    // For simplicity, we can scan the last 12 months.
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    
    // We look back month by month.
    // Let's accumulate limits and subtract spendings for preceding months.
    // E.g., for the past 6 months:
    for (let i = 1; i <= 12; i++) {
      const prevMonthDate = new Date(targetYear, targetMonth - 1 - i, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth() + 1;
      const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      
      // Stop scanning if we are before a reasonable epoch (e.g., year 2025)
      if (prevYear < 2025) break;

      // Check if there was any activity or if it's within the account history.
      const prevMonthTxs = envTxs.filter(t => t.date.startsWith(prevMonthStr));
      const prevSpent = prevMonthTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      // If there was no transactions at all in the database before the first transaction, 
      // we shouldn't infinitely accumulate limits.
      const hasAnyTxsBefore = envTxs.some(t => t.date < `${prevMonthStr}-01`);
      const hasTxsInPrevMonth = prevMonthTxs.length > 0;
      
      if (!hasAnyTxsBefore && !hasTxsInPrevMonth) {
        // Skip if before the envelope was active
        continue;
      }
      
      const prevSaved = envelope.monthlyLimit - prevSpent;
      carryOverAmount += prevSaved;
    }
  }

  const limitForMonth = envelope.monthlyLimit + carryOverAmount;
  const remaining = limitForMonth - currentMonthSpent;

  return {
    spent: currentMonthSpent,
    carryOver: carryOverAmount,
    limit: limitForMonth,
    remaining: remaining
  };
}

// Expands recurring transactions into discrete occurrences within a date range (inclusive)
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

    // Parse the start date of the recurrence
    const txDate = new Date(tx.date);
    const recEnd = tx.recurrenceEnd ? new Date(tx.recurrenceEnd) : null;

    // We start from the transaction's date and increment according to the recurrence period
    let current = new Date(txDate);

    // If it's a future transaction, we don't start occurrence generation before its date
    while (current <= end) {
      if (recEnd && current > recEnd) break;

      const currentStr = current.toISOString().split('T')[0];
      if (currentStr >= startDateStr && currentStr <= endDateStr) {
        // Create an occurrence
        occurrences.push({
          ...tx,
          id: `${tx.id}-${currentStr}`,
          originalId: tx.id,
          date: currentStr,
          isOccurrence: true
        });
      }

      // Move to the next period
      if (tx.recurrencePeriod === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else if (tx.recurrencePeriod === 'monthly') {
        current.setMonth(current.getMonth() + 1);
      } else {
        // Safety exit for invalid periods
        break;
      }
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}

// Projects the balance of selected accounts up to a specific target date
export async function getProjectedBalance(selectedAccountIds, targetDateStr) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // 1. Calculate current balance for selected accounts
  let currentBalanceSum = 0;
  for (const accountId of selectedAccountIds) {
    const bal = await getAccountBalance(accountId);
    currentBalanceSum += bal;
  }

  if (targetDateStr <= todayStr) {
    return currentBalanceSum;
  }

  // 2. Fetch all transactions for these accounts
  const txs = await db.transactions
    .filter(t => selectedAccountIds.includes(Number(t.accountId)))
    .toArray();

  // 3. Find future transactions and active recurring transactions between tomorrow and targetDate
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const expanded = expandRecurringTransactions(txs, tomorrowStr, targetDateStr);

  // 4. Sum up future transactions
  const futureSum = expanded.reduce((sum, t) => sum + Number(t.amount), 0);

  return currentBalanceSum + futureSum;
}
