import React, { useMemo, useState } from 'react';
import { useDb } from '../db';
import { 
  Coins, ArrowRight, TrendingUp, TrendingDown, Sparkles, Shield, 
  ChevronRight, Gift, Activity, Smile, Handshake
} from 'lucide-react';

export default function Dashboard({ onViewAccountDetails, username }) {
  const { 
    userMeta, accountsData, favoriteAccountDetails, globalLatestTransactions, 
    wishlist, pockets, categories, debts 
  } = useDb();

  // Tom Nook interactive advice states for mobile / welcome banner
  const nookAdvices = [
    "Économise tes clochettes aujourd'hui pour t'offrir la maison de tes rêves demain !",
    "Un prêt à taux zéro, c'est une affaire en or ! Oui, oui !",
    "Pense à placer tes clochettes avant que le cours du navet ne chute !",
    "Agrandir ta maison demande des sacrifices économiques constants...",
    "Chaque projet de pont ou de rampe demande la participation de tous, mais surtout la tienne ! Oui, oui !"
  ];

  const [currentAdviceIndex, setCurrentAdviceIndex] = useState(0);
  const [viewedIndices, setViewedIndices] = useState([]);
  const [phase, setPhase] = useState('welcome'); // 'welcome', 'advices', 'yellow', 'distress', 'sold'
  const [yellowClickCount, setYellowClickCount] = useState(0);
  const [distressClickCount, setDistressClickCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleBannerClick = () => {
    if (isAnimating || phase === 'sold') return;

    setIsAnimating(true);

    // Swap text state halfway through animation (at 100ms)
    setTimeout(() => {
      if (phase === 'welcome') {
        setPhase('advices');
        setCurrentAdviceIndex(0);
        setViewedIndices([0]);
      } else if (phase === 'advices') {
        const unviewed = nookAdvices
          .map((_, idx) => idx)
          .filter(idx => !viewedIndices.includes(idx));

        if (unviewed.length > 0) {
          const randomIdx = unviewed[Math.floor(Math.random() * unviewed.length)];
          setCurrentAdviceIndex(randomIdx);
          setViewedIndices(prev => [...prev, randomIdx]);
        } else {
          setPhase('yellow');
        }
      } else if (phase === 'yellow') {
        const nextCount = yellowClickCount + 1;
        setYellowClickCount(nextCount);
        if (nextCount >= 5) {
          setPhase('distress');
        }
      } else if (phase === 'distress') {
        const nextCount = distressClickCount + 1;
        setDistressClickCount(nextCount);
        if (nextCount >= 10) {
          setPhase('sold');
        }
      }
    }, 100);

    // End animation after 200ms
    setTimeout(() => {
      setIsAnimating(false);
    }, 200);
  };

  if (!accountsData || accountsData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-ac-brown bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm text-center space-y-4">
        <span className="text-4xl animate-bounce">🏝️</span>
        <h3 className="font-black text-sm">Bienvenue sur ton île budgétaire !</h3>
        <p className="text-xs text-ac-brown-light max-w-sm">
          Pour commencer ton aventure financière, va dans l'onglet <strong>Comptes</strong> et crée ton premier compte courant.
        </p>
      </div>
    );
  }

  // Split favorite vs others
  const favMeta = userMeta?.find(m => m.key === 'favorite_account_id');
  let favoriteId = favMeta ? favMeta.value : null;
  if (!favoriteId && accountsData.length > 0) {
    const courant = accountsData.find(a => a.type === 'Courant');
    favoriteId = courant ? courant.id : accountsData[0].id;
  }

  // Limit other accounts to a maximum of 4
  const otherAccounts = accountsData.filter(a => a.id !== favoriteId).slice(0, 4);

  // Compute total balance across all accounts
  const totalBalance = accountsData.reduce((sum, a) => sum + a.balance, 0);

  // Filter pockets for favorite account, sort by order, slice to 2 max
  const favPockets = useMemo(() => {
    if (!pockets || !favoriteId) return [];
    return pockets
      .filter(p => p.accountId === favoriteId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, 2);
  }, [pockets, favoriteId]);

  const activeDebts = useMemo(() => {
    return debts ? debts.filter(d => d.status === 'pending') : [];
  }, [debts]);

  return (
    <div className="space-y-8 select-none">
      {/* 1. Bulle de bienvenue Tom Nook */}
      <div 
        onClick={handleBannerClick}
        className={`flex flex-col md:flex-row gap-6 bg-ac-green-light border-3 border-ac-brown rounded-3xl p-6 relative overflow-hidden items-center md:items-start shadow-ac-sm cursor-pointer transition-all duration-200 transform ${
          isAnimating 
            ? 'scale-95 opacity-80' 
            : 'hover:scale-[1.01]'
        }`}
      >
        <div className="flex flex-col items-center shrink-0">
          <div className="w-16 h-16 bg-[#FFFDF9] rounded-full flex items-center justify-center border-3 border-ac-brown shadow-ac-sm mb-2 transform hover:rotate-6 hover:scale-105 transition-all duration-200 cursor-pointer overflow-hidden">
            <img src="/tom-nook.png" alt="Tom Nook" className="w-12 h-12 object-contain" />
          </div>
          <span className="text-[10px] font-black text-white bg-ac-brown px-3 py-0.5 rounded-full border border-ac-brown shadow-ac-xs">
            Tom Nook
          </span>
        </div>

        <div className="flex-1 space-y-4 w-full relative">
          <div className="bg-white border-2 border-ac-brown/60 rounded-2xl p-4 shadow-ac-xs relative min-h-[90px] flex flex-col justify-center">
            {phase !== 'sold' && (
              <div className="absolute -top-3 right-3 border-2 border-ac-brown rounded-full px-2 py-0.5 text-[8px] font-black text-white bg-ac-gold flex items-center gap-1 animate-pulse">
                <Smile className="w-2.5 h-2.5" /> Info
              </div>
            )}

            <h3 className="font-black text-sm text-ac-brown flex items-center gap-1.5">
              {phase === 'welcome' ? `Bonjour, ${username || 'Îlien'} !` : "Conseil de Tom Nook"} <Sparkles className="w-4 h-4 text-ac-gold fill-ac-gold animate-pulse" />
            </h3>
            
            <p className="text-xs font-bold leading-relaxed text-ac-brown-light mt-1">
              {phase === 'welcome' && `"Oui, oui ! Ravi de te revoir. Actuellement, ton île possède un total combiné de ${totalBalance.toLocaleString('fr-FR')} 🔔. Prends soin de tes économies !"`}
              {phase === 'advices' && `"${nookAdvices[currentAdviceIndex]}"`}
              {phase === 'yellow' && `"Je ne suis pas une banque à conseils. Oui, Oui. Ma spécialité c'est garder mon argent"`}
              {phase === 'distress' && `"Eh je suis vraiment à sec !"`}
              {phase === 'sold' && `"..."`}
            </p>

            {phase === 'sold' && (
              <div className="absolute inset-0 bg-[#FFFDF9]/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-20 border-4 border-dashed border-ac-red">
                <span className="text-2xl font-black text-ac-red uppercase tracking-wider transform -rotate-12 border-4 border-ac-red px-4 py-2 rounded-xl bg-white shadow-ac-xs animate-bounce-in">
                  Vendu 
                </span>
              </div>
            )}

            {/* Dialogue bubble arrow */}
            <div className="w-3 h-3 bg-white border-l-2 border-t-2 border-ac-brown/60 absolute left-[-7px] top-6 transform rotate-[-45deg] hidden md:block"></div>
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

              {/* Pockets Section */}
              {favPockets.length > 0 && (
                <div className="mt-6 space-y-3 bg-white/70 border-2 border-ac-brown/30 rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
                  <h4 className="text-xs font-black text-ac-brown border-b border-ac-brown/15 pb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-ac-gold fill-ac-gold" /> Pochettes actives du compte
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {favPockets.map(pocket => {
                      const current = pocket.currentAmount !== undefined ? Number(pocket.currentAmount) : Number(pocket.allocatedAmount);
                      const allocated = Number(pocket.allocatedAmount) || 1;
                      const percentage = Math.min(100, Math.max(0, (current / allocated) * 100));
                      
                      let progressBg = 'bg-ac-green';
                      if (percentage < 25) progressBg = 'bg-ac-red';
                      else if (percentage < 60) progressBg = 'bg-ac-gold';

                      const cat = categories?.find(c => c.id === pocket.categoryId);
                      const cardStyle = cat 
                        ? { borderColor: cat.color, backgroundColor: cat.color + '09' }
                        : {};

                      return (
                        <div key={pocket.id} className="bg-white border-2 border-ac-brown/40 rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-ac-xs" style={cardStyle}>
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs shrink-0">{cat?.emoji || '🍃'}</span>
                              <span className="font-extrabold text-[10px] text-ac-brown leading-tight truncate" title={pocket.name}>
                                {pocket.name}
                              </span>
                            </div>
                            <span className="text-[9px] font-black text-ac-brown-light/75 whitespace-nowrap">
                              {Math.round(current).toLocaleString('fr-FR')} / {allocated.toLocaleString('fr-FR')} 🔔
                            </span>
                          </div>

                          <div className="w-full h-2.5 bg-ac-cream border border-ac-brown/30 rounded-full overflow-hidden p-[1px]">
                            <div 
                              className={`h-full ${progressBg} rounded-full transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5 Latest transactions for this account */}
              <div className="mt-6 space-y-3 bg-white/70 border-2 border-ac-brown/30 rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
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
              <p className="font-extrabold text-ac-brown mt-2">Aucun compte favori configuré.</p>
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

          {/* Sub-grid for Wishes & Debts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Wishlist Card */}
            <div className="ac-card p-6 bg-white border-ac-brown">
              <h3 className="text-base font-black text-ac-brown mb-4 flex items-center gap-2 border-b border-ac-brown/10 pb-4">
                <Gift className="w-5 h-5 text-ac-red fill-ac-red/20" /> Mes Souhaits ({wishlist ? wishlist.length : 0})
              </h3>
              {!wishlist || wishlist.length === 0 ? (
                <p className="text-xs font-semibold text-ac-brown-light text-center py-4 bg-ac-cream rounded-2xl border border-dashed border-ac-brown/20">
                  Aucun souhait en cours. 🍃
                </p>
              ) : (
                <div className="space-y-3">
                  {wishlist.slice(0, 2).map((wish) => (
                    <div key={wish.id} className="p-3 bg-ac-cream rounded-2xl border-2 border-ac-brown flex justify-between items-center">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-xs text-ac-brown truncate">{wish.name}</h4>
                        {wish.description && (
                          <p className="text-[10px] text-ac-brown-light truncate">{wish.description}</p>
                        )}
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <span className="font-black text-xs text-ac-brown bg-white border border-ac-brown/25 px-2 py-0.5 rounded-full inline-block shadow-ac-xs">
                          {wish.price.toLocaleString('fr-FR')} 🔔
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Debts Card */}
            <div className="ac-card p-6 bg-white border-ac-brown">
              <h3 className="text-base font-black text-ac-brown mb-4 flex items-center gap-2 border-b border-ac-brown/10 pb-4">
                <Handshake className="w-5 h-5 text-ac-orange" /> Mes Dettes ({activeDebts.length})
              </h3>
              {activeDebts.length === 0 ? (
                <p className="text-xs font-semibold text-ac-brown-light text-center py-4 bg-ac-cream rounded-2xl border border-dashed border-ac-brown/20">
                  Aucune dette en cours. Super ! 🍃
                </p>
              ) : (
                <div className="space-y-3">
                  {activeDebts.slice(0, 2).map((debt) => {
                    const isToPay = debt.type === 'to_pay';
                    return (
                      <div 
                        key={debt.id} 
                        className={`p-3 rounded-2xl border-2 border-ac-brown flex justify-between items-center ${
                          isToPay ? 'bg-ac-red-light/10' : 'bg-ac-green-light/20'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                              isToPay ? 'bg-ac-red text-white border-ac-brown' : 'bg-ac-green text-white border-ac-brown'
                            }`}>
                              {isToPay ? 'Je dois' : 'On me doit'}
                            </span>
                            <h4 className="font-extrabold text-xs text-ac-brown truncate">{debt.person}</h4>
                          </div>
                          {debt.description && (
                            <p className="text-[10px] text-ac-brown-light truncate mt-0.5">{debt.description}</p>
                          )}
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <span className="font-black text-xs text-ac-brown bg-white border border-ac-brown/25 px-2 py-0.5 rounded-full inline-block shadow-ac-xs font-black">
                            {debt.amount.toLocaleString('fr-FR')} 🔔
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Global flow of transactions (Stretched to full height) */}
        <div className="lg:col-span-1 h-full flex flex-col">
          <div className="ac-card p-6 bg-white border-ac-brown flex flex-col h-full justify-between">
            <div>
              <h3 className="text-base font-black text-ac-brown mb-6 flex items-center gap-2 border-b border-ac-brown/10 pb-4">
                Flux Global des Transactions
              </h3>

              {!globalLatestTransactions ? (
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
