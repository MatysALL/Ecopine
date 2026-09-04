import React, { useState, useMemo } from 'react';
import { useDb, expandRecurringTransactions, getExecutionBadgeInfo } from '../db';
import { 
  ChevronLeft, ChevronRight, Calendar, 
  Coins, Leaf, ArrowUpRight, ArrowDownRight, EyeOff, Sparkles, Smile, X
} from 'lucide-react';

export default function EconomicCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [hoveredDay, setHoveredDay] = useState(null);
  const [hoveredData, setHoveredData] = useState([]);
  const [hoveredPosition, setHoveredPosition] = useState({ x: 0, y: 0 });
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayForBottomSheet, setSelectedDayForBottomSheet] = useState(null);

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
    
    const dayTxs = transactionsData
      ? transactionsData.filter(t => t.date === cell.dateStr)
      : [];

    setHoveredDay(cell.dateStr);
    setHoveredData(dayTxs);

    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredPosition({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 10
    });
  };

  const getDayTransactions = (dateStr) => {
    if (!transactionsData) return [];
    return transactionsData.filter(t => t.date === dateStr);
  };

  const handleDayHoverLeave = () => {
    setHoveredDay(null);
    setHoveredData([]);
  };

  const frenchDaysLong = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const frenchDaysShort = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <div className="space-y-6 select-none relative text-ac-brown pb-28">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            <Calendar className="w-6 h-6 text-ac-sky animate-bounce" /> Le Calendrier Économique
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Visualise ton flux quotidien en euros.
          </p>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="ac-card p-4 md:p-6 bg-white border-ac-brown relative">
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
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {/* Days of Week Header */}
          {frenchDaysLong.map((d, idx) => (
            <div key={idx} className="text-center font-black text-xs text-ac-brown-light uppercase py-2">
              <span className="hidden md:inline">{d}</span>
              <span className="inline md:hidden">{frenchDaysShort[idx]}</span>
            </div>
          ))}

          {/* Grid Cells */}
          {calendarCells.map((cell, idx) => {
            const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
            const isSelected = selectedDay && selectedDay.dateStr === cell.dateStr;
            
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
                onClick={() => {
                  if (cell.isCurrentMonth) {
                    setSelectedDay(cell);
                    setSelectedDayForBottomSheet(cell);
                  }
                }}
                className={`aspect-square p-1 rounded-xl md:aspect-auto md:min-h-[90px] md:p-2 md:rounded-2xl border-2 transition-all flex flex-col justify-between relative cursor-pointer ${cellStyle} ${
                  isSelected 
                    ? 'ring-2 ring-[#7C9E59] bg-[#7C9E59]/15 border-[#7C9E59]' 
                    : isToday 
                    ? 'ring-2 ring-ac-green bg-ac-green-light/20' 
                    : ''
                }`}
              >
                {/* Day Number */}
                <div className="flex justify-between items-center w-full">
                  <span className={`text-[10px] md:text-xs font-black ${isToday || isSelected ? 'text-ac-green font-extrabold text-xs md:text-sm' : 'text-ac-brown'}`}>
                    {cell.day}
                  </span>
                  {isToday && (
                    <span className="hidden md:inline text-[7px] md:text-[8px] font-black bg-ac-green text-white px-1 py-0.2 rounded-full">Auj.</span>
                  )}
                </div>

                {/* Mobile Discrete Indicators (Pills / Dots) */}
                {cell.isCurrentMonth && dayTxs.length > 0 && (
                  <div className="flex md:hidden items-center justify-center gap-0.5 mt-auto pb-0.5">
                    {netFlow > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#7C9E59] shrink-0"></span>}
                    {netFlow < 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#E57373] shrink-0"></span>}
                    {netFlow === 0 && <span className="w-1.5 h-1.5 rounded-full bg-ac-gold shrink-0"></span>}
                    {dayTxs.length > 1 && <span className="w-1.5 h-1.5 rounded-full bg-ac-brown/40 shrink-0"></span>}
                  </div>
                )}

                {/* Desktop Full Amount View */}
                {cell.isCurrentMonth && dayTxs.length > 0 && (
                  <div className="hidden md:block text-[8px] md:text-[10px] font-bold text-left mt-0.5 md:mt-1">
                    <div className="font-extrabold truncate">
                      {netFlow > 0 ? `+${Math.round(netFlow)}` : Math.round(netFlow)} €
                    </div>
                  </div>
                )}

                {/* Relative Hover Tooltip Detail Component (Desktop only) */}
                {hoveredDay === cell.dateStr && (
                  <div 
                    className={`absolute bottom-full mb-2 z-50 bg-[#FFFDF9] border-3 border-ac-brown rounded-2xl p-4 shadow-ac-lg max-w-sm w-72 pointer-events-none animate-fade-in text-ac-brown hidden md:block ${
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
                      Détails du {(hoveredDay?.toDate ? hoveredDay.toDate() : new Date(hoveredDay || Date.now())).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                                <div className="flex gap-1.5 mt-0.5 items-center">
                                  <span className="text-[7px] font-bold text-ac-brown-light bg-ac-cream px-1 rounded uppercase">
                                    {acc?.name || 'Compte'}
                                  </span>
                                  {(() => {
                                    const badge = getExecutionBadgeInfo(tx);
                                    return (
                                      <span className={`text-[7px] font-bold px-1 rounded uppercase border inline-flex items-center gap-0.5 ${badge.className}`}>
                                        {badge.icon && <span>{badge.icon}</span>}
                                        <span>{badge.label}</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>

                              <span className={`font-black whitespace-nowrap ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                                {isIncome ? '+' : '-'}{(Number(tx.amount) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
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

      {/* Selected Day Operations Detail Section under Calendar */}
      {selectedDay && (
        <div className="ac-card p-4 md:p-6 bg-white border-ac-brown animate-fade-in space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-ac-brown/10">
            <h4 className="text-sm md:text-base font-black text-ac-brown flex items-center gap-2">
              🗓️ Opérations du {(selectedDay.dateStr?.toDate ? selectedDay.dateStr.toDate() : new Date(selectedDay.dateStr || Date.now())).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h4>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-xs font-black text-ac-brown-light hover:text-ac-brown bg-ac-cream hover:bg-ac-cream-dark px-2.5 py-1 rounded-full border border-ac-brown/20 cursor-pointer transition-colors"
            >
              Fermer ✕
            </button>
          </div>

          {getDayTransactions(selectedDay.dateStr).length === 0 ? (
            <p className="text-xs font-bold text-ac-brown-light italic py-6 text-center bg-ac-cream/50 rounded-2xl border border-dashed border-ac-brown/15">
              Aucune opération enregistrée ce jour-là. 🍃
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {getDayTransactions(selectedDay.dateStr).map((tx, idx) => {
                const acc = accounts?.find(a => a.id === tx.accountId);
                const isIncome = tx.type === 'credit';
                return (
                  <div key={idx} className="p-3 bg-ac-cream/60 border-2 border-ac-brown rounded-2xl flex justify-between items-center text-xs shadow-ac-xs">
                    <div className="truncate pr-2">
                      <p className="font-extrabold text-ac-brown truncate">{tx.name || tx.description}</p>
                      <div className="flex gap-1.5 mt-1 items-center">
                        <span className="text-[8px] font-black text-ac-brown-light bg-white border border-ac-brown/15 px-1.5 py-0.5 rounded uppercase">
                          {acc?.name || 'Compte'}
                        </span>
                        {(() => {
                          const badge = getExecutionBadgeInfo(tx);
                          return (
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase border inline-flex items-center gap-0.5 ${badge.className}`}>
                              {badge.icon && <span>{badge.icon}</span>}
                              <span>{badge.label}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <span className={`font-black text-sm whitespace-nowrap ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                      {isIncome ? '+' : '-'}{(Number(tx.amount) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom Sheet for selected day on Mobile */}
      {selectedDayForBottomSheet && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden bg-ac-brown/60 backdrop-blur-xs animate-fade-in" onClick={() => setSelectedDayForBottomSheet(null)}>
          <div 
            className="bg-white border-t-4 border-ac-brown rounded-t-3xl p-6 w-full max-h-[80vh] flex flex-col animate-slide-up text-ac-brown select-none pb-safe-bottom"
            onClick={e => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-ac-brown/20 rounded-full mx-auto mb-4 shrink-0"></div>
            
            <div className="flex justify-between items-center pb-3 border-b border-ac-brown/10 mb-4 shrink-0">
              <h3 className="text-base font-black text-ac-brown">
                🗓️ Opérations du {(selectedDayForBottomSheet.dateStr?.toDate ? selectedDayForBottomSheet.dateStr.toDate() : new Date(selectedDayForBottomSheet.dateStr || Date.now())).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <button 
                onClick={() => setSelectedDayForBottomSheet(null)}
                className="bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-colors z-10"
              >
                <X className="w-4 h-4 text-ac-brown" />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto space-y-3 flex-1 pb-4">
              {getDayTransactions(selectedDayForBottomSheet.dateStr).length === 0 ? (
                <p className="text-xs font-bold text-ac-brown-light italic py-8 text-center bg-ac-cream/50 rounded-2xl border border-dashed border-ac-brown/15">
                  Aucun flux financier ce jour. 🍃
                </p>
              ) : (
                getDayTransactions(selectedDayForBottomSheet.dateStr).map((tx, idx) => {
                  const acc = accounts?.find(a => a.id === tx.accountId);
                  const isIncome = tx.type === 'credit';
                  return (
                    <div key={idx} className="p-3 bg-ac-cream border-2 border-ac-brown rounded-2xl flex justify-between items-center text-xs">
                      <div>
                        <p className="font-extrabold text-ac-brown">{tx.name || tx.description}</p>
                        <div className="flex gap-1.5 mt-1 items-center">
                          <span className="text-[8px] font-black text-ac-brown-light bg-white border border-ac-brown/15 px-1.5 py-0.5 rounded uppercase">
                            {acc?.name || 'Compte'}
                          </span>
                          {(() => {
                            const badge = getExecutionBadgeInfo(tx);
                            return (
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase border inline-flex items-center gap-0.5 ${badge.className}`}>
                                {badge.icon && <span>{badge.icon}</span>}
                                <span>{badge.label}</span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <span className={`font-black text-sm whitespace-nowrap ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                        {isIncome ? '+' : '-'}{(Number(tx.amount) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Filters */}
      <div className="ac-card p-6 bg-white border-ac-brown">
        <h4 className="text-sm font-black text-ac-brown mb-4 flex items-center gap-1.5">
          Filtres par Comptes ({accounts?.length || 0})
        </h4>
        {!accounts ? (
          <p className="text-xs text-ac-brown-light">Chargement des comptes...</p>
        ) : (
          <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 scrollbar-none">
            {accounts.map(acc => (
              <label 
                key={acc.id}
                className={`flex items-center gap-2 border-2 border-ac-brown rounded-full px-4 py-2 text-xs font-bold cursor-pointer select-none transition-colors shrink-0 ${
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
                <span className="whitespace-nowrap">{acc.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

