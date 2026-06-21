import React, { useState, useMemo } from 'react';
import { useDb, expandRecurringTransactions } from '../db';
import { 
  ChevronLeft, ChevronRight, Calendar, 
  Coins, Leaf, ArrowUpRight, ArrowDownRight, EyeOff, Sparkles, Smile
} from 'lucide-react';

export default function EconomicCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [hoveredDay, setHoveredDay] = useState(null);
  const [hoveredData, setHoveredData] = useState([]);
  const [hoveredPosition, setHoveredPosition] = useState({ x: 0, y: 0 });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { accounts, transactions: allTransactions } = useDb();

  // Initialize selected accounts dictionary
  React.useEffect(() => {
    if (accounts && Object.keys(selectedAccounts).length === 0) {
      const initial = {};
      accounts.forEach(a => {
        initial[a.id] = true; // Select all by default
      });
      setSelectedAccounts(initial);
    }
  }, [accounts]);

  // Determine active account IDs list
  const activeAccountIds = useMemo(() => {
    return accounts
      ? accounts.filter(a => selectedAccounts[a.id]).map(a => a.id)
      : [];
  }, [accounts, selectedAccounts]);

  // Determine date ranges for the active month
  const startOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const endOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  // Fetch and expand transactions for the active month
  const transactionsData = useMemo(() => {
    if (activeAccountIds.length === 0 || !allTransactions) return [];
    
    const txs = allTransactions.filter(t => activeAccountIds.includes(t.accountId));

    return expandRecurringTransactions(txs, startOfMonthStr, endOfMonthStr);
  }, [activeAccountIds, currentDate, allTransactions]);

  // Calendar Grid builder helpers
  const firstDayIndex = new Date(year, month, 1).getDay();
  const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const daysInMonth = lastDayOfMonth;
  const calendarCells = [];

  // Padding cells from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = adjustedFirstDayIndex - 1; i >= 0; i--) {
    const prevMonthNum = month === 0 ? 12 : month;
    const prevYearNum = month === 0 ? year - 1 : year;
    const prevDay = prevMonthLastDay - i;
    calendarCells.push({
      day: prevDay,
      isCurrentMonth: false,
      dateStr: `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`
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
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonthNum = month === 11 ? 1 : month + 2;
    const nextYearNum = month === 11 ? year + 1 : year;
    calendarCells.push({
      day: i,
      isCurrentMonth: false,
      dateStr: `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`
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

  const handleDayHoverEnter = (e, cell) => {
    if (!cell.isCurrentMonth) return;
    
    // In Mode 1, we list transactions on that date
    const dayTxs = transactionsData
      ? transactionsData.filter(t => t.date === cell.dateStr)
      : [];

    setHoveredDay(cell.dateStr);
    setHoveredData(dayTxs);

    // Calculate tooltip coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredPosition({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 10
    });
  };

  const handleDayHoverLeave = () => {
    setHoveredDay(null);
    setHoveredData([]);
  };

  const frenchDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="space-y-6 select-none relative text-ac-brown">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            <Calendar className="w-6 h-6 text-ac-sky animate-bounce" /> Le Calendrier Économique
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Visualise ton flux quotidien de clochettes.
          </p>
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
            
            // Mode 1 data calculations
            const dayTxs = cell.isCurrentMonth && transactionsData
              ? transactionsData.filter(t => t.date === cell.dateStr)
              : [];

            const incomeSum = dayTxs.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
            const expenseSum = dayTxs.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0);
            const netFlow = incomeSum - expenseSum;

            // Compute background styling
            let cellStyle = 'bg-white border-ac-brown';
            if (cell.isCurrentMonth) {
              if (dayTxs.length > 0) {
                if (netFlow > 0) cellStyle = 'bg-[#EAF5E9] border-ac-green text-ac-green hover:bg-[#DFF0DC]';
                else if (netFlow < 0) cellStyle = 'bg-[#FDF2F2] border-ac-red text-ac-red hover:bg-[#FCE8E8]';
                else cellStyle = 'bg-ac-cream-dark/20 border-ac-brown/50 text-ac-brown-light hover:bg-ac-cream-dark/30';
              } else {
                cellStyle = 'bg-white border-ac-brown hover:bg-ac-cream-light/35';
              }
            } else {
              cellStyle = 'bg-ac-cream-dark/35 border-ac-brown/10 text-ac-brown-light/30 pointer-events-none';
            }

            return (
              <div
                key={idx}
                onMouseEnter={(e) => handleDayHoverEnter(e, cell)}
                onMouseLeave={handleDayHoverLeave}
                className={`min-h-[75px] md:min-h-[90px] border-2 rounded-2xl p-2 transition-all flex flex-col justify-between relative cursor-help ${cellStyle} ${
                  isToday ? 'ring-3 ring-ac-green bg-ac-green-light/20' : ''
                }`}
              >
                {/* Day Number */}
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-black ${isToday ? 'text-ac-green font-extrabold text-sm' : 'text-ac-brown'}`}>
                    {cell.day}
                  </span>
                  {isToday && (
                    <span className="text-[8px] font-black bg-ac-green text-white px-1 py-0.2 rounded-full">Auj.</span>
                  )}
                </div>

                {/* Render mode specific data inside cells */}
                {cell.isCurrentMonth && dayTxs.length > 0 && (
                  <div className="text-[10px] font-bold text-left mt-1">
                    <div className="font-extrabold">
                      {netFlow > 0 ? `+${Math.round(netFlow)}` : Math.round(netFlow)} 🔔
                    </div>
                  </div>
                )}

                {/* Relative Hover Tooltip Detail Component */}
                {hoveredDay === cell.dateStr && (
                  <div 
                    className={`absolute bottom-full mb-2 z-50 bg-[#FFFDF9] border-3 border-ac-brown rounded-2xl p-4 shadow-ac-lg max-w-sm w-72 pointer-events-none animate-fade-in text-ac-brown ${
                      idx % 7 >= 4 
                        ? 'right-0' 
                        : 'left-1/2 -translate-x-1/2'
                    }`}
                  >
                    {/* Tooltip triangle indicator */}
                    <div className={`w-3 h-3 bg-[#FFFDF9] border-r-3 border-b-3 border-ac-brown absolute bottom-[-7px] rotate-[45deg] ${
                      idx % 7 >= 4 
                        ? 'right-8' 
                        : 'left-1/2 -translate-x-1/2'
                    }`}></div>

                    <h4 className="font-black text-xs text-ac-brown border-b border-ac-brown/10 pb-2 mb-2">
                      Détails du {new Date(hoveredDay).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </h4>



                    {/* Transactions list */}
                    {hoveredData.length === 0 ? (
                      <p className="text-[10px] font-bold text-ac-brown-light italic py-2 text-center bg-ac-cream-dark/20 rounded-lg border border-dashed border-ac-brown/10">Aucun flux financier ce jour. 🍃</p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {hoveredData.map((tx, index) => {
                          const acc = accounts?.find(a => a.id === tx.accountId);
                          const isIncome = tx.type === 'credit';
                          return (
                            <div key={index} className="flex justify-between items-center text-[10px] border-b border-ac-cream pb-1.5 last:border-b-0">
                              <div className="truncate pr-2">
                                <p className="font-extrabold text-ac-brown truncate">{tx.name || tx.description}</p>
                                
                                <div className="flex gap-1.5 mt-0.5">
                                  <span className="text-[7px] font-bold text-ac-brown-light bg-ac-cream px-1 rounded uppercase">
                                    {acc?.name || 'Compte'}
                                  </span>
                                  {tx.executionType && tx.executionType !== 'spontaneous' && (
                                    <span className={`text-[7px] font-bold px-1 rounded uppercase border ${
                                      tx.executionType === 'planned' ? 'bg-ac-sky-light border-ac-sky/10 text-ac-sky' : 'bg-ac-cream-dark/40 border-ac-brown/10 text-ac-brown-light'
                                    }`}>
                                      {tx.executionType === 'planned' ? 'Prévu' : 'Passé'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className={`font-black whitespace-nowrap ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                                {isIncome ? '+' : '-'}{tx.amount.toFixed(2)} 🔔
                              </span>
                            </div>
                          );
                        })}
                      </div>
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
    </div>
  );
}
