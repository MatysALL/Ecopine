import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAccountBalance, getAccountVisibleBalance } from '../db';
import { 
  Coins, ArrowRight, TrendingUp, TrendingDown, Sparkles, Shield, 
  ChevronRight, HelpCircle, MessageSquare, StickyNote, Activity
} from 'lucide-react';

export default function Dashboard({ onViewAccountDetails, username }) {
  const [noteText, setNoteText] = useState('');



  // Fetch current month details
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  // 1. Fetch user metadata (note & favorite account id)
  const userMeta = useLiveQuery(() => db.user_meta.toArray());

  // 2. Fetch all accounts with live balances
  const accountsData = useLiveQuery(async () => {
    const list = await db.accounts.toArray();
    return Promise.all(
      list.map(async (acc) => {
        const bal = await getAccountBalance(acc.id);
        const visBal = await getAccountVisibleBalance(acc.id);
        return { ...acc, balance: bal, visibleBalance: visBal };
      })
    );
  });

  // Calculate 30-day balance variation and retrieve 5 latest transactions for favorite account
  const favoriteAccountDetails = useLiveQuery(async () => {
    if (!accountsData || accountsData.length === 0 || !userMeta) return null;

    const favMeta = userMeta.find(m => m.key === 'favorite_account_id');
    let favId = favMeta ? Number(favMeta.value) : null;
    
    // Fallback if no favorite account is configured
    if (!favId) {
      const courant = accountsData.find(a => a.type === 'Courant');
      favId = courant ? courant.id : accountsData[0].id;
    }

    const favAccount = accountsData.find(a => a.id === favId);
    if (!favAccount) return null;

    // Date strings
    const todayStr = today.toISOString().split('T')[0];
    const prevDate = new Date();
    prevDate.setDate(prevDate.getDate() - 30);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    // Compute balance variation
    const balToday = await getAccountVisibleBalance(favId, todayStr);
    const balPrev = await getAccountVisibleBalance(favId, prevDateStr);

    let variationPct = 0;
    if (balPrev !== 0) {
      variationPct = ((balToday - balPrev) / Math.abs(balPrev)) * 100;
    } else if (balToday !== 0) {
      variationPct = balToday > 0 ? 100 : -100;
    }

    // Get 5 latest transactions for this account
    const txs = await db.transactions
      .where('accountId')
      .equals(favId)
      .reverse()
      .sortBy('date');
    const latestTxs = txs.slice(0, 5);

    return {
      account: favAccount,
      variationPct,
      latestTxs
    };
  }, [accountsData, userMeta]);

  // 3. Fetch last 5 transactions across ALL accounts
  const globalLatestTransactions = useLiveQuery(async () => {
    return db.transactions
      .reverse()
      .sortBy('date')
      .then(txs => txs.slice(0, 5));
  });

  // Initial load of the note text
  useEffect(() => {
    if (userMeta) {
      const noteMeta = userMeta.find(m => m.key === 'dashboard_note');
      setNoteText(noteMeta?.value || '');
    }
  }, [userMeta]);

  // Handle note writing and auto-saving
  const handleNoteChange = async (e) => {
    const text = e.target.value.slice(0, 500);
    setNoteText(text);
    await db.user_meta.put({ key: 'dashboard_note', value: text });
  };

  if (!accountsData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-ac-brown">
        <div className="animate-spin w-12 h-12 border-4 border-ac-green border-t-transparent rounded-full mb-4"></div>
        <p className="font-bold">Chargement de ton île...</p>
      </div>
    );
  }

  // Split favorite vs others
  const favMeta = userMeta?.find(m => m.key === 'favorite_account_id');
  let favoriteId = favMeta ? Number(favMeta.value) : null;
  if (!favoriteId && accountsData.length > 0) {
    const courant = accountsData.find(a => a.type === 'Courant');
    favoriteId = courant ? courant.id : accountsData[0].id;
  }

  const otherAccounts = accountsData.filter(a => a.id !== favoriteId);

  // Compute total balance across all accounts
  const totalBalance = accountsData.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-8 select-none">
      {/* 1. Bulle de bienvenue Tom Nook */}
      <div className="flex flex-col md:flex-row gap-6 bg-ac-green-light border-3 border-ac-brown rounded-3xl p-6 relative overflow-hidden items-center md:items-start shadow-ac-sm">
        <div className="flex flex-col items-center shrink-0">
          <div className="w-16 h-16 bg-[#FFFDF9] rounded-full flex items-center justify-center border-3 border-ac-brown shadow-ac-sm mb-2 transform hover:rotate-6 hover:scale-105 transition-all duration-200 cursor-pointer">
            <svg viewBox="0 0 100 100" className="w-12 h-12">
              {/* Ears */}
              <path d="M 15 35 L 25 10 L 45 25 Z" fill="#8B5A2D" stroke="#4A3E3D" strokeWidth="3" strokeLinejoin="round" />
              <path d="M 8 35 L 75 10 L 55 25 Z" fill="#8B5A2D" stroke="#4A3E3D" strokeWidth="3" strokeLinejoin="round" />
              <path d="M 20 32 L 27 15 L 40 25 Z" fill="#E6C29E" />
              <path d="M 80 32 L 73 15 L 60 25 Z" fill="#E6C29E" />
              
              {/* Face Base */}
              <circle cx="50" cy="55" r="38" fill="#D2B48C" stroke="#4A3E3D" strokeWidth="3" />
              
              {/* Dark Mask around Eyes */}
              <path d="M 18 52 C 18 40, 38 40, 50 48 C 62 40, 82 40, 82 52 C 82 66, 62 64, 50 56 C 38 64, 18 66, 18 52 Z" fill="#4A3E3D" />
              
              {/* Eyes */}
              <ellipse cx="36" cy="50" rx="7" ry="5" fill="#FFFFFF" />
              <ellipse cx="36" cy="50" rx="4" ry="4" fill="#4A3E3D" />
              <ellipse cx="64" cy="50" rx="7" ry="5" fill="#FFFFFF" />
              <ellipse cx="64" cy="50" rx="4" ry="4" fill="#4A3E3D" />
              
              {/* Eyelids (Sleepy look) */}
              <path d="M 28 48 Q 36 43 44 48" stroke="#D2B48C" strokeWidth="3" fill="none" />
              <path d="M 56 48 Q 64 43 72 48" stroke="#D2B48C" strokeWidth="3" fill="none" />
              
              {/* Snout */}
              <ellipse cx="50" cy="67" rx="14" ry="10" fill="#FFF8DC" stroke="#4A3E3D" strokeWidth="2.5" />
              <polygon points="46,63 54,63 50,68" fill="#4A3E3D" />
              <path d="M 50 68 L 50 72 Q 47 74 45 72 M 50 72 Q 53 74 55 72" stroke="#4A3E3D" strokeWidth="2" fill="none" />
              
              {/* Cheeks */}
              <circle cx="22" cy="64" r="4" fill="#FFB6C1" opacity="0.6" />
              <circle cx="78" cy="64" r="4" fill="#FFB6C1" opacity="0.6" />
            </svg>
          </div>
          <span className="text-[10px] font-black text-white bg-ac-brown px-3 py-0.5 rounded-full border border-ac-brown shadow-ac-xs">
            Tom Nook
          </span>
        </div>

        <div className="flex-1 space-y-4 w-full">
          <div className="bg-white border-2 border-ac-brown/60 rounded-2xl p-4 shadow-ac-xs relative">
            <h3 className="font-black text-sm text-ac-brown flex items-center gap-1">
              Bonjour, {username || 'Îlien'} ! <Sparkles className="w-4 h-4 text-ac-gold fill-ac-gold animate-pulse" />
            </h3>
            <p className="text-xs font-bold leading-relaxed text-ac-brown-light mt-1">
              "Oui, oui ! Ravi de te revoir. Actuellement, ton île possède un total combiné de <strong>{totalBalance.toLocaleString('fr-FR')} 🔔</strong>. Prends soin de tes économies !"
            </p>
            {/* Dialogue bubble arrow */}
            <div className="w-3 h-3 bg-white border-l-2 border-t-2 border-ac-brown/60 absolute left-[-7px] top-6 transform rotate-[-45deg] hidden md:block"></div>
          </div>

          {/* Island Note textarea */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase text-ac-brown-light flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Note de l'île (Sauvegarde en direct)
            </label>
            <textarea
              value={noteText}
              onChange={handleNoteChange}
              placeholder="Écris tes remarques, projets de construction, ou objectifs de clochettes ici..."
              className="w-full bg-white border-2 border-ac-brown rounded-2xl p-3 text-xs font-bold text-ac-brown placeholder:text-ac-brown-light/40 focus:outline-none focus:ring-2 focus:ring-ac-green/30 resize-none h-20"
              maxLength={500}
            />
            <div className="text-right text-[9px] font-bold text-ac-brown-light/60">
              {noteText.length}/500 caractères
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Favorite Account Card & Other accounts */}
        <div className="lg:col-span-2 space-y-8">
          {/* 2. Section Compte Favori */}
          {favoriteAccountDetails ? (
            <div 
              onClick={() => onViewAccountDetails(favoriteAccountDetails.account.id)}
              className="ac-card bg-ac-gold-light p-8 cursor-pointer relative overflow-hidden group select-none border-ac-brown hover:scale-[1.01] transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-ac-gold-dark bg-white border border-ac-gold px-3 py-1 rounded-full shadow-ac-sm">
                    ⭐ Compte Favori - {favoriteAccountDetails.account.name}
                  </span>
                  <h3 className="text-base font-black text-ac-brown mt-4">
                    Solde Disponible
                  </h3>
                </div>
                <div className="w-12 h-12 bg-ac-gold rounded-full flex items-center justify-center border-2 border-ac-brown shadow-ac-sm group-hover:scale-110 transition-transform duration-200">
                  <Coins className="w-6 h-6 text-white fill-white" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight text-ac-brown">
                  {favoriteAccountDetails.account.visibleBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-lg font-black text-ac-brown-light">🔔</span>

                {/* 30 day variation badge */}
                <span className={`ml-4 text-xs font-black px-2 py-1 rounded-lg border flex items-center gap-0.5 ${
                  favoriteAccountDetails.variationPct >= 0 
                    ? 'bg-ac-green-light border-ac-green/20 text-ac-green' 
                    : 'bg-ac-red-light border-ac-red/20 text-ac-red'
                }`}>
                  {favoriteAccountDetails.variationPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {favoriteAccountDetails.variationPct >= 0 ? '+' : ''}{favoriteAccountDetails.variationPct.toFixed(1)}% (30j)
                </span>
              </div>

              {/* Internal objective blocked warning */}
              {favoriteAccountDetails.account.balance !== favoriteAccountDetails.account.visibleBalance && (
                <div className="mt-4 flex items-center gap-2 bg-white/85 border border-ac-gold rounded-xl px-3 py-2 text-[10px] font-bold text-ac-gold-dark">
                  <Shield className="w-3.5 h-3.5" />
                  <span>
                    Solde réel : <strong>{favoriteAccountDetails.account.balance.toLocaleString('fr-FR')} 🔔</strong> (dont <strong>{(favoriteAccountDetails.account.balance - favoriteAccountDetails.account.visibleBalance).toLocaleString('fr-FR')} 🔔</strong> bloqués dans des objectifs).
                  </span>
                </div>
              )}

              {/* 5 Latest transactions for this account */}
              <div className="mt-6 space-y-3 bg-white/70 border-2 border-ac-brown/30 rounded-2xl p-4">
                <h4 className="text-xs font-black text-ac-brown border-b border-ac-brown/15 pb-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-ac-gold" /> Dernières écritures de ce compte
                </h4>
                {favoriteAccountDetails.latestTxs.length === 0 ? (
                  <p className="text-[10px] text-ac-brown-light italic py-2 text-center">Aucune transaction récente.</p>
                ) : (
                  <div className="divide-y divide-ac-cream-dark">
                    {favoriteAccountDetails.latestTxs.map((tx) => {
                      const isIncome = tx.type === 'credit';
                      return (
                        <div key={tx.id} className="py-2 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-extrabold text-ac-brown truncate max-w-[150px]">{tx.name}</p>
                            <span className="text-[8px] font-bold text-ac-brown-light block">{new Date(tx.date).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <span className={`font-black ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                            {isIncome ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')} 🔔
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center text-[10px] font-black text-ac-brown-light group-hover:text-ac-brown transition-colors">
                Voir le détail des transactions <ChevronRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ) : (
            <div className="ac-card bg-white p-6 border-ac-brown text-center py-12">
              <span className="text-xl">⭐</span>
              <p className="font-extrabold text-ac-brown mt-2">Aucun compte configuré.</p>
              <p className="text-xs text-ac-brown-light mt-1">Crée un compte dans l'onglet dédié.</p>
            </div>
          )}

          {/* 3. Section Autres Comptes */}
          <div className="ac-card p-6 bg-white border-ac-brown">
            <h3 className="text-lg font-black text-ac-brown mb-4 flex items-center gap-2">
              Autres comptes
            </h3>
            {otherAccounts.length === 0 ? (
              <p className="text-xs font-semibold text-ac-brown-light text-center py-4 bg-ac-cream rounded-2xl border border-dashed border-ac-brown/20">
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
                      <h4 className="font-extrabold text-xs text-ac-brown">{acc.name}</h4>
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-white border border-ac-brown/20 text-ac-brown-light mt-1 inline-block">
                        {acc.type} {acc.rate > 0 ? `(${acc.rate}%)` : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-sm text-ac-brown block">
                        {acc.visibleBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 🔔
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Global flow of transactions */}
        <div className="space-y-8">
          <div className="ac-card p-6 bg-white border-ac-brown flex flex-col h-full justify-between">
            <div>
              <h3 className="text-base font-black text-ac-brown mb-6 flex items-center gap-2 border-b border-ac-brown/10 pb-4">
                Flux Global des Transactions
              </h3>

              {globalLatestTransactions === undefined ? (
                <div className="text-center py-6 text-ac-brown-light text-xs font-bold">Chargement...</div>
              ) : globalLatestTransactions.length === 0 ? (
                <div className="text-center py-8 bg-ac-cream rounded-3xl border border-dashed border-ac-brown/20 text-ac-brown-light text-xs font-semibold">
                  Aucune clochette dépensée ou gagnée ici pour le moment ! C'est le début d'une belle aventure financière. 🍃
                </div>
              ) : (
                <div className="space-y-4">
                  {globalLatestTransactions.map((tx) => {
                    const matchingAccount = accountsData.find(a => a.id === tx.accountId);
                    const isIncome = tx.type === 'credit';
                    return (
                      <div key={tx.id} className="flex gap-3 items-start border-b border-ac-cream pb-3 last:border-b-0">
                        <span className={`w-7 h-7 rounded-full border-2 border-ac-brown flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                          isIncome ? 'bg-ac-green-light text-ac-green' : 'bg-ac-red-light text-ac-red'
                        }`}>
                          {isIncome ? '+' : '-'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-xs text-ac-brown truncate">{tx.name}</h4>
                          
                          <div className="flex flex-wrap gap-1 items-center mt-1 text-[8px] font-black text-ac-brown-light">
                            <span>{new Date(tx.date).toLocaleDateString('fr-FR')}</span>
                            <span>•</span>
                            <span className="bg-ac-cream border border-ac-brown/10 px-1 rounded truncate max-w-[80px]">
                              {matchingAccount?.name || 'Inconnu'}
                            </span>
                            {tx.category && (
                              <>
                                <span>•</span>
                                <span className="text-ac-green bg-ac-green-light px-1 rounded">
                                  {tx.category}
                                </span>
                              </>
                            )}
                          </div>
                          
                          {/* Badges for Execution Types */}
                          <div className="mt-1 flex gap-1">
                            {tx.executionType && tx.executionType !== 'spontaneous' && (
                              <span className={`text-[7px] font-black uppercase px-1 rounded border ${
                                tx.executionType === 'planned' ? 'bg-ac-sky-light border-ac-sky/20 text-ac-sky' : 'bg-ac-cream-dark/50 border-ac-brown/15 text-ac-brown-light'
                              }`}>
                                {tx.executionType === 'planned' ? 'Planifiée' : 'Passée'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right whitespace-nowrap shrink-0">
                          <span className={`font-black text-xs ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                            {isIncome ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')} 🔔
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-[10px] font-bold text-ac-brown-light bg-ac-cream-dark/30 p-3 rounded-xl border border-dashed border-ac-brown/25 mt-6">
              💡 Le flux global regroupe les écritures de tous les comptes, incluant les transactions planifiées passées et spontanées.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
