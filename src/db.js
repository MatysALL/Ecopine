import Dexie from 'dexie';

export const db = new Dexie('EcopineDB');

db.version(1).stores({
  accounts: '++id, name, type, initialBalance, rate',
  transactions: '++id, accountId, date, amount, description, category, isRecurring, recurrencePeriod, recurrenceEnd',
  envelopes: '++id, accountId, name, monthlyLimit, carryOver, blockBalance',
  budgets: '++id, month, limit'
});

// Seed data function
export async function seedDatabase() {
  const accountCount = await db.accounts.count();
  if (accountCount > 0) return;

  // Insert mock accounts
  const mainAccountId = await db.accounts.add({
    name: 'Poche (Courant)',
    type: 'Courant',
    initialBalance: 1200.00,
    rate: 0
  });

  const savingsId = await db.accounts.add({
    name: 'Livret Clochettes',
    type: 'Livret A',
    initialBalance: 8500.00,
    rate: 3.0
  });

  await db.accounts.add({
    name: 'LDDS Méli-Mélo',
    type: 'LDDS',
    initialBalance: 3000.00,
    rate: 3.0
  });

  // Insert mock envelopes for main account
  const envCoursesId = await db.envelopes.add({
    accountId: mainAccountId,
    name: 'Courses Navets',
    monthlyLimit: 250,
    carryOver: true,
    blockBalance: false
  });

  const envNookId = await db.envelopes.add({
    accountId: mainAccountId,
    name: 'Mobilier Nook',
    monthlyLimit: 120,
    carryOver: false,
    blockBalance: true // Subtracts from main dashboard balance
  });

  // Today's date components
  const today = new Date();
  const year = today.getFullYear();
  const monthStr = String(today.getMonth() + 1).padStart(2, '0');
  
  // Seed past transactions
  await db.transactions.bulkAdd([
    {
      accountId: mainAccountId,
      date: `${year}-${monthStr}-01`,
      amount: 1500.00,
      description: 'Vente de Poissons & Insectes',
      category: 'Revenus',
      isRecurring: false,
      recurrencePeriod: 'none',
      recurrenceEnd: ''
    },
    {
      accountId: mainAccountId,
      date: `${year}-${monthStr}-02`,
      amount: -85.50,
      description: 'Courses Navets de la semaine',
      category: 'Courses Navets', // Matches envelope name
      isRecurring: false,
      recurrencePeriod: 'none',
      recurrenceEnd: ''
    },
    {
      accountId: mainAccountId,
      date: `${year}-${monthStr}-03`,
      amount: -45.00,
      description: 'Abonnement Méli-Mélo Premium',
      category: 'Abonnements',
      isRecurring: true,
      recurrencePeriod: 'monthly',
      recurrenceEnd: ''
    },
    {
      accountId: mainAccountId,
      date: `${year}-${monthStr}-05`,
      amount: -12.50,
      description: 'Café chez Robusto',
      category: 'Loisirs',
      isRecurring: false,
      recurrencePeriod: 'none',
      recurrenceEnd: ''
    },
    {
      accountId: mainAccountId,
      date: `${year}-${monthStr}-07`,
      amount: -90.00,
      description: 'Table en bois de fer',
      category: 'Mobilier Nook', // Matches envelope name
      isRecurring: false,
      recurrencePeriod: 'none',
      recurrenceEnd: ''
    }
  ]);

  // Seed default budget for the current month
  await db.budgets.add({
    month: `${year}-${monthStr}`,
    limit: 600
  });
}

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
