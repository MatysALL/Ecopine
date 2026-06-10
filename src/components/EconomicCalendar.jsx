import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, expandRecurringTransactions, getProjectedBalance } from '../db';
import { 
  ChevronLeft, ChevronRight, HelpCircle, Calendar, 
  Coins, Leaf, ArrowUpRight, ArrowDownRight, EyeOff, Sparkles 
} from 'lucide-react';

export default function EconomicCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [hoveredDay, setHoveredDay] = useState(null);
  const [hoveredData, setHoveredData] = useState([]);
  const [hoveredProjectedBalance, setHoveredProjectedBalance] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState({ x: 0, y: 0 });
  const [isProjectionMode, setIsProjectionMode] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 1. Fetch accounts to build filters
  const accounts = useLiveQuery(() => db.accounts.toArray());

  // Initialize selected accounts dictionary once accounts are loaded
  React.useEffect(() => {
    if (accounts && Object.keys(selectedAccounts).length === 0) {
      const initial = {};
      accounts.forEach(a => {
        initial[a.id] = true; // Select all by default
      });
      setSelectedAccounts(initial);
    }
  }, [accounts]);

  // Determine selected account IDs list
  const activeAccountIds = accounts
    ? accounts.filter(a => selectedAccounts[a.id]).map(a => a.id)
    : [];

  // 2. Fetch and expand transactions for the active month
  const startOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const endOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const transactionsData = useLiveQuery(async () => {
    if (activeAccountIds.length === 0) return [];
    
    // Fetch all transactions for these accounts
    const txs = await db.transactions
      .filter(t => activeAccountIds.includes(Number(t.accountId)))
      .toArray();

    // Expand recurrences for the target month
    return expandRecurringTransactions(txs, startOfMonthStr, endOfMonthStr);
  }, [selectedAccounts, currentDate]);

  // Calendar Grid builder helpers
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Adjust so Monday is first day of week (0 = Monday, 6 = Sunday)
  const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const daysInMonth = lastDayOfMonth;
  const calendarCells = [];

  // Padding cells from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = adjustedFirstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({
      day: prevMonthLastDay - i,
      isCurrentMonth: false,
      dateStr: `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(prevMonthLastDay - i).padStart(2, '0')}`
    });
  }

  // Current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      day: i,
      isCurrentMonth: true,
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    });
  }

  // Padding cells for next month
  const remainingCells = 42 - calendarCells.length; // 6 rows of 7 days = 42
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      day: i,
      isCurrentMonth: false,
      dateStr: `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    });
  }

  const navigateMonth = (direction) => {
    const nextDate = new Date(currentDate);
    nextDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(nextDate);
  };

  const handleAccountToggle = (id) => {
    setSelectedAccounts(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleDayHoverEnter = async (e, cell) => {
    if (!cell.isCurrentMonth) return;
    
    const dayTxs = transactionsData
      ? transactionsData.filter(t => t.date === cell.dateStr)
      : [];

    setHoveredDay(cell.dateStr);
    setHoveredData(dayTxs);

    // Calculate mouse position relative to window for tooltip
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredPosition({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 10
    });

    if (isProjectionMode) {
      // Calculate projected balance for this future date
      const projBal = await getProjectedBalance(activeAccountIds, cell.dateStr);
      setHoveredProjectedBalance(projBal);
    } else {
      setHoveredProjectedBalance(null);
    }
  };

  const handleDayHoverLeave = () => {
    setHoveredDay(null);
    setHoveredData([]);
    setHoveredProjectedBalance(null);
  };

  const frenchDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="space-y-6 select-none relative">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            <Calendar className="w-6 h-6 text-ac-sky" /> Le Calendrier Économique
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Suis l'évolution de tes rentrées et sorties d'argent, récurrentes ou ponctuelles.
          </p>
        </div>

        {/* Projection Switch */}
        <div className="flex items-center gap-3 bg-ac-sky-light border-2 border-ac-brown rounded-2xl px-4 py-2.5">
          <div className="flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-ac-sky fill-ac-sky animate-pulse" />
            <span className="text-xs font-black text-ac-brown">Solde Projeté</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isProjectionMode}
              onChange={(e) => setIsProjectionMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-ac-cream-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ac-brown after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-ac-sky border border-ac-brown"></div>
          </label>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="ac-card p-6 bg-white border-ac-brown relative">
        {/* Month Selector */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigateMonth(-1)}
            className="bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-2 transition-transform active:translate-y-[1px] cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-ac-brown" />
          </button>
          <h3 className="text-xl font-black text-ac-brown capitalize">
            {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => navigateMonth(1)}
            className="bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-2 transition-transform active:translate-y-[1px] cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-ac-brown" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Days of Week Header */}
          {frenchDays.map(d => (
            <div key={d} className="text-center font-black text-xs text-ac-brown-light uppercase py-2">
              {d}
            </div>
          ))}

          {/* Grid Cells */}
          {calendarCells.map((cell, idx) => {
            const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
            const isFuture = cell.dateStr > new Date().toISOString().split('T')[0];
            
            // Get transactions for this day
            const dayTxs = cell.isCurrentMonth && transactionsData
              ? transactionsData.filter(t => t.date === cell.dateStr)
              : [];

            const incomesCount = dayTxs.filter(t => t.amount > 0).length;
            const expensesCount = dayTxs.filter(t => t.amount < 0).length;

            return (
              <div
                key={idx}
                onMouseEnter={(e) => handleDayHoverEnter(e, cell)}
                onMouseLeave={handleDayHoverLeave}
                className={`min-h-[75px] md:min-h-[85px] border-2 rounded-2xl p-2 transition-all flex flex-col justify-between relative ${
                  cell.isCurrentMonth
                    ? 'bg-white border-ac-brown hover:bg-ac-cream-dark/20 hover:scale-[1.02] cursor-help'
                    : 'bg-ac-cream-dark/30 border-ac-brown/10 text-ac-brown-light/40 pointer-events-none'
                } ${isToday ? 'ring-3 ring-ac-green bg-ac-green-light/25' : ''}`}
              >
                {/* Day Number */}
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-black ${isToday ? 'text-ac-green font-extrabold text-sm' : 'text-ac-brown'}`}>
                    {cell.day}
                  </span>
                  {isToday && (
                    <span className="text-[10px] font-black bg-ac-green text-white px-1.5 py-0.2 rounded-full">Auj.</span>
                  )}
                </div>

                {/* Indicators / Transaction Icons */}
                {cell.isCurrentMonth && dayTxs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 justify-start">
                    {incomesCount > 0 && (
                      <span className="bg-ac-green-light text-ac-green border border-ac-green/30 rounded-full px-1.5 py-0.2 text-[9px] font-black flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5 fill-ac-green/20" /> +
                      </span>
                    )}
                    {expensesCount > 0 && (
                      <span className="bg-ac-red-light text-ac-red border border-ac-red/30 rounded-full px-1.5 py-0.2 text-[9px] font-black flex items-center gap-0.5">
                        <Leaf className="w-2.5 h-2.5 fill-ac-red/20" /> -
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Account Filters */}
      <div className="ac-card p-6 bg-white border-ac-brown">
        <h4 className="text-sm font-black text-ac-brown mb-4 flex items-center gap-1.5">
          Filtres par Comptes ({accounts?.length || 0})
        </h4>
        {!accounts ? (
          <p className="text-xs text-ac-brown-light">Chargement des comptes...</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {accounts.map(acc => (
              <label 
                key={acc.id}
                className={`flex items-center gap-2 border-2 border-ac-brown rounded-full px-4 py-2 text-xs font-bold cursor-pointer select-none transition-colors ${
                  selectedAccounts[acc.id]
                    ? 'bg-ac-green-light border-ac-brown text-ac-brown font-extrabold'
                    : 'bg-white hover:bg-ac-cream border-ac-brown/30 text-ac-brown-light'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!selectedAccounts[acc.id]}
                  onChange={() => handleAccountToggle(acc.id)}
                  className="hidden"
                />
                <span className={`w-3.5 h-3.5 rounded-full border border-ac-brown flex items-center justify-center p-0.5 ${
                  selectedAccounts[acc.id] ? 'bg-ac-green' : 'bg-white'
                }`}>
                  {selectedAccounts[acc.id] && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                </span>
                {acc.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Floating Hover Tooltip Detail Component */}
      {hoveredDay && (
        <div 
          className="absolute z-50 bg-white border-3 border-ac-brown rounded-2xl p-4 shadow-ac-lg max-w-sm w-72 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 animate-fade-in"
          style={{ 
            left: `${hoveredPosition.x - window.scrollX}px`, 
            top: `${hoveredPosition.y - window.scrollY}px` 
          }}
        >
          {/* Top arrow */}
          <div className="w-3.5 h-3.5 bg-white border-r-3 border-b-3 border-ac-brown absolute bottom-[-8.5px] left-1/2 transform -translate-x-1/2 rotate-45"></div>

          <h4 className="font-black text-xs text-ac-brown border-b border-ac-brown/10 pb-2 mb-2">
            Transactions du {new Date(hoveredDay).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </h4>

          {hoveredData.length === 0 ? (
            <p className="text-[11px] font-bold text-ac-brown-light italic py-1 text-center bg-ac-cream rounded-lg">Aucune transaction ce jour.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {hoveredData.map((tx, index) => {
                const acc = accounts?.find(a => a.id === tx.accountId);
                const isIncome = tx.amount > 0;
                return (
                  <div key={index} className="flex justify-between items-center text-[11px]">
                    <div className="truncate pr-2">
                      <p className="font-extrabold text-ac-brown truncate">{tx.description}</p>
                      <span className="text-[9px] font-bold text-ac-brown-light bg-ac-cream px-1 rounded uppercase">
                        {acc?.name || 'Compte'}
                      </span>
                    </div>
                    <span className={`font-black whitespace-nowrap ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                      {isIncome ? '+' : ''}{tx.amount.toFixed(2)} 🔔
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Solde Projeté Area */}
          {isProjectionMode && hoveredProjectedBalance !== null && (
            <div className="mt-3 pt-2 border-t border-dashed border-ac-brown/25 bg-ac-sky-light/50 p-2.5 rounded-xl text-center">
              <span className="text-[9px] font-black text-ac-sky uppercase block">Solde Combiné Estimé</span>
              <span className="text-sm font-black text-ac-brown">
                {hoveredProjectedBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
