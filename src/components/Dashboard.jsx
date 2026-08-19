import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useDb, getCustomCardStyle, resolveColorHex, getExecutionBadgeInfo, getActiveOrFavoriteAccount } from '../db';
import { 
  Coins, ArrowRight, TrendingUp, TrendingDown, Sparkles, Shield, 
  ChevronRight, Gift, Activity, Smile, Handshake
} from 'lucide-react';

export default function Dashboard({ 
  onViewAccountDetails, 
  username, 
  setActiveTab, 
  setCurrentView, 
  onNavigate 
}) {
  const handleNavigate = (view) => {
    if (typeof onNavigate === 'function') onNavigate(view);
    else if (typeof setActiveTab === 'function') setActiveTab(view);
    else if (typeof setCurrentView === 'function') setCurrentView(view);
  };

  const { 
    userMeta, usersMetaDoc, accountsData, favoriteAccountDetails, globalLatestTransactions, 
    wishlist, pockets, debts, user 
  } = useDb();

  // 6 Financial Advices for Tom Nook
  const nookAdvices = [
    "Économise tes clochettes aujourd'hui pour t'offrir la maison de tes rêves demain ! Oui, oui !",
    "Un prêt à taux zéro, c'est une affaire en or ! Pense à placer tes clochettes régulièrement.",
    "Pense à placer tes clochettes avant que le cours du navet ne chute !",
    "Agrandir ta maison demande des sacrifices économiques constants...",
    "Chaque projet de pont ou de rampe demande la participation de tous, mais surtout la tienne ! Oui, oui !",
    "Gère bien tes comptes pour garder un solde toujours positif, oui oui !"
  ];

  // In-memory state for Tom Nook Easter Egg (no DB / localStorage persistence)
  const [nookStep, setNookStep] = useState(0);
  const [isSold, setIsSold] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isNookCollapsed, setIsNookCollapsed] = useState(false);
  const shakeTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    };
  }, []);

  // Reset function to clear Easter Egg state in RAM
  const resetTomNookState = () => {
    setNookStep(0);
    setIsSold(false);
  };

  const handleBannerClick = () => {
    if (isSold) return;

    const nextStep = nookStep + 1;
    setNookStep(nextStep);

    // Trigger reactive shake animation feedback on click (duration: 250ms)
    if (nextStep < 14) {
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      setIsShaking(false);
      setTimeout(() => {
        setIsShaking(true);
        shakeTimeoutRef.current = setTimeout(() => {
          setIsShaking(false);
        }, 250);
      }, 10);
    }

    // ÉTAPE 5 : Le Panneau VENDU (dernier clic après l'étape 13) - purement en mémoire
    if (nextStep >= 14) {
      setIsSold(true);
    }
  };

  const handleToggleCollapse = () => {
    if (!isNookCollapsed) {
      // Reset Easter Egg state on collapse/reopen
      resetTomNookState();
    }
    setIsNookCollapsed(!isNookCollapsed);
  };

  // Loading state
  if (!accountsData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-ac-brown gap-3">
        <div className="w-12 h-12 border-4 border-ac-green border-t-transparent rounded-full animate-spin"></div>
        <p className="font-extrabold text-sm animate-pulse">Chargement de ton île financière...</p>
      </div>
    );
  }

  // If no accounts exist
  if (accountsData.length === 0) {
    return (
      <div className="bg-white border-3 border-ac-brown rounded-3xl p-8 text-center text-ac-brown shadow-ac-md space-y-4 max-w-md mx-auto my-12 animate-bounce-in">
        <span className="text-4xl animate-bounce">🏝️</span>
        <h3 className="font-black text-sm">Bienvenue sur ton île budgétaire !</h3>
        <p className="text-xs text-ac-brown-light max-w-sm">
          Pour commencer ton aventure financière, va dans l'onglet <strong>Comptes</strong> et crée ton premier compte courant.
        </p>
      </div>
    );
  }

  // 1. Trie les comptes personnels
  const personalAccounts = (accountsData || [])
    .filter(acc => !acc.projectId)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  // 2. Résolution stricte du compte favori (favori explicite si valide, sinon index 0)
  const favAccountId = usersMetaDoc?.favoriteAccountId || userMeta?.find(m => m.key === 'favorite_account_id')?.value;
  const explicitFavorite = personalAccounts.find(acc => acc.id === favAccountId);
  const resolvedFavoriteAccount = explicitFavorite || personalAccounts[0] || accountsData[0] || null;
  const favoriteId = resolvedFavoriteAccount?.id || null;

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
    if (!debts) return [];
    return debts.filter(d => {
      if (d.status === 'resolved' || d.status === 'settled' || d.status === 'paid') return false;
      if (d.isPaid === true || d.isSettled === true) return false;
      return true;
    });
  }, [debts]);

  // Card background and text color calculation based on annoyance state
  const getCardStyle = () => {
    if (isSold) return "bg-white border-2 border-ac-brown/60 text-ac-brown";
    if (nookStep === 13) return "bg-black text-white border-2 border-black";
    if (nookStep >= 10) return "bg-black/60 text-white border-2 border-ac-brown/80 backdrop-blur-xs";
    if (nookStep >= 7) return "bg-black/20 text-ac-brown border-2 border-ac-brown/60 backdrop-blur-xs";
    return "bg-white border-2 border-ac-brown/60 text-ac-brown";
  };

  return (
    <div className="space-y-6 md:space-y-8 select-none pb-20 md:pb-0 p-1 md:p-0">
      {/* 1. Bulle de bienvenue Tom Nook */}
      <div 
        className={`bg-ac-green-light border-3 border-ac-brown rounded-3xl relative overflow-hidden transition-all duration-200 shadow-ac-sm p-4 ${
          isNookCollapsed ? 'pb-3' : 'pb-6'
        }`}
      >
        <div className="flex justify-between items-center w-full select-none">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center border-2 border-ac-brown shrink-0 bg-white transition-transform ${
              isShaking ? 'animate-shake-once' : ''
            }`}>
              <img src="/tom-nook.jpg" alt="Tom Nook" className="w-full h-full object-cover object-center block" />
            </div>
            <div>
              <h3 className="font-black text-xs text-ac-brown flex items-center gap-1">
                Tom Nook 
                <Sparkles className="w-3.5 h-3.5 text-ac-gold fill-ac-gold animate-pulse" />
              </h3>
              {isNookCollapsed && (
                <p className="text-[10px] text-ac-brown-light font-bold truncate max-w-[180px] sm:max-w-md">
                  {isSold ? '🔴 VENDU ! Ce terrain est réservé !' : (
                    <>
                      {nookStep === 0 && `Bonjour, ${username || 'Îlien'} ! Oui, oui !`}
                      {nookStep >= 1 && nookStep <= 6 && nookAdvices[nookStep - 1]}
                      {nookStep >= 7 && nookStep <= 9 && `Je n’ai plus de conseil à te donner`}
                      {nookStep >= 10 && nookStep <= 12 && `je n’ai vraiment plus de conseil, maintenant arrête`}
                      {nookStep === 13 && `un dernier conseil alors, ne me demande plus rien !`}
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={handleToggleCollapse}
            className="text-[9px] font-black uppercase text-ac-brown bg-white hover:bg-ac-cream border-2 border-ac-brown px-2 py-0.5 rounded-lg shadow-ac-xs hover:translate-y-[1px] cursor-pointer transition-colors"
          >
            {isNookCollapsed ? 'Ouvrir 🐾' : 'Réduire'}
          </button>
        </div>

        {!isNookCollapsed && (
          <div 
            onClick={handleBannerClick}
            className={`mt-4 flex flex-col md:flex-row gap-4 items-center md:items-start w-full transition-all duration-200 transform ${
              isSold ? 'cursor-default' : 'cursor-pointer'
            } ${
              isShaking 
                ? 'animate-shake-once' 
                : !isSold ? 'hover:scale-[1.005]' : ''
            }`}
          >
            <div className="flex-1 space-y-4 w-full relative">
              <div className={`rounded-2xl p-4 shadow-ac-xs relative min-h-[75px] flex flex-col justify-center transition-colors duration-300 ${getCardStyle()}`}>
                {!isSold && (
                  <div className={`absolute -top-3 right-3 border-2 border-ac-brown rounded-full px-2 py-0.5 text-[8px] font-black text-white flex items-center gap-1 shadow-xs ${
                    nookStep === 13 ? 'bg-red-600 animate-bounce' :
                    nookStep >= 10 ? 'bg-orange-600' :
                    nookStep >= 7 ? 'bg-gray-800' : 'bg-ac-gold animate-pulse'
                  }`}>
                    <Smile className="w-2.5 h-2.5" />
                    {nookStep === 0 && 'Info'}
                    {nookStep >= 1 && nookStep <= 6 && `Conseil ${nookStep}/6`}
                    {nookStep >= 7 && nookStep <= 9 && `0 conseil`}
                    {nookStep >= 10 && nookStep <= 12 && `Lassitude`}
                    {nookStep === 13 && `Crise !`}
                  </div>
                )}
                
                <p className="text-xs font-bold leading-relaxed mt-1">
                  {isSold && `"Ce terrain est désormais réservé / VENDU ! Merci pour tes clochettes !"`}
                  {!isSold && (
                    <>
                      {nookStep === 0 && `"Oui, oui ! Ravi de te revoir. Actuellement, ton île possède un total combiné de ${(totalBalance ?? 0).toLocaleString('fr-FR')} 🔔. Prends soin de tes économies !"`}
                      {nookStep >= 1 && nookStep <= 6 && `"${nookAdvices[nookStep - 1]}"`}
                      {nookStep >= 7 && nookStep <= 9 && `"Je n’ai plus de conseil à te donner"`}
                      {nookStep >= 10 && nookStep <= 12 && `"je n’ai vraiment plus de conseil, maintenant arrête"`}
                      {nookStep === 13 && `"un dernier conseil alors, ne me demande plus rien !"`}
                    </>
                  )}
                </p>

                {/* Statut final "VENDU" badge style Animal Crossing */}
                {isSold && (
                  <div className="absolute inset-0 bg-[#FFFDF9]/85 backdrop-blur-xs flex items-center justify-center rounded-2xl z-20 border-3 border-dashed border-ac-red select-none">
                    <div className="bg-[#D9534F] text-white border-3 border-ac-brown px-6 py-2.5 rounded-2xl shadow-ac-md transform -rotate-6 flex items-center gap-2.5 animate-bounce-in">
                      <span className="text-2xl">🚩</span>
                      <div className="text-center">
                        <span className="text-2xl font-black uppercase tracking-wider block leading-none">VENDU</span>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-white/90">Nook Inc.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left column: Favorite Account Card & Other accounts */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* 2. Section Compte Favori */}
          {favoriteAccountDetails ? (() => {
            const isFavProj = Boolean(favoriteAccountDetails.account.projectId);
            return (
            <div 
              onClick={() => onViewAccountDetails(favoriteAccountDetails.account.id)}
              style={isFavProj ? { backgroundColor: '#1E232A', borderColor: '#2E3440', color: '#ffffff' } : { backgroundColor: resolveColorHex(favoriteAccountDetails.account.color), color: '#ffffff', borderColor: '#4A3E3D' }}
              className={`ac-card account-card p-8 cursor-pointer relative overflow-visible group select-none hover:scale-[1.01] transition-all text-white ${
                isFavProj ? 'project-account-card bg-[#1E232A] text-white border-3 border-[#2E3440]' : 'border-3 border-ac-brown'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-ac-sm border ${
                      isFavProj ? 'bg-slate-800 border-slate-700 text-ac-gold' : 'text-white bg-white/20 border-white/30'
                    }`}>
                      ⭐ Compte Favori - {favoriteAccountDetails.account.name || favoriteAccountDetails.account.title || "Compte"}
                    </span>
                    {isFavProj && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-ac-gold/20 text-ac-gold border border-ac-gold/40 rounded-full">
                        📁 Projet
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black mt-4 text-white">
                    Solde Réel Principal
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 bg-ac-gold rounded-full flex items-center justify-center border-2 border-ac-brown shadow-ac-sm group-hover:scale-110 transition-transform duration-200">
                    <Coins className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight text-white">
                  {(favoriteAccountDetails.account.balance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-lg font-black text-white/90">🔔</span>

                {/* 30 day variation badge */}
                <span className={`ml-4 text-xs font-black px-2 py-1 rounded-lg border flex items-center gap-0.5 ${
                  favoriteAccountDetails.variationPct >= 0 
                    ? 'bg-ac-green-light border-ac-green/20 text-ac-green' 
                    : 'bg-ac-red-light border-ac-red/20 text-ac-red'
                }`}>
                  {favoriteAccountDetails.variationPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {favoriteAccountDetails.variationPct >= 0 ? '+' : ''}{(favoriteAccountDetails.variationPct ?? 0).toFixed(1)}% (30j)
                </span>
              </div>

              {/* Indicative available balance if pockets exist */}
              {favoriteAccountDetails.account.balance !== favoriteAccountDetails.account.visibleBalance && (
                <div className="mt-4 flex items-center justify-between gap-2 bg-white/90 border border-ac-gold rounded-xl px-3.5 py-2 text-[10px] font-bold text-ac-brown shadow-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 text-ac-gold shrink-0 fill-ac-gold" />
                    <span className="truncate">
                      Solde disponible (indicatif) : <strong className={favoriteAccountDetails.account.visibleBalance < 0 ? 'text-ac-red' : 'text-ac-green'}>{(favoriteAccountDetails.account.visibleBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔</strong>
                    </span>
                  </div>
                  <span className="text-[9px] font-extrabold text-ac-brown-light shrink-0">
                    ({((favoriteAccountDetails.account.balance ?? 0) - (favoriteAccountDetails.account.visibleBalance ?? 0)).toLocaleString('fr-FR')} 🔔 en poches)
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

                      return (
                        <div 
                          key={pocket.id} 
                          style={{ backgroundColor: resolveColorHex(pocket.color), color: '#FFFFFF' }}
                          className="border-2 border-ac-brown/40 rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-ac-xs text-white"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs shrink-0">🍃</span>
                              <span className="font-extrabold text-[10px] text-white leading-tight truncate" title={pocket.name}>
                                {pocket.name}
                              </span>
                            </div>
                            <span className="text-[9px] font-black text-white/85 whitespace-nowrap">
                              {(Math.round(current) ?? 0).toLocaleString('fr-FR')} / {(allocated ?? 0).toLocaleString('fr-FR')} 🔔
                            </span>
                          </div>

                          <div className="w-full h-2.5 bg-black/20 border border-white/30 rounded-full overflow-hidden p-[1px]">
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
                      const formattedDate = tx.date ? (tx.date?.toDate ? tx.date.toDate().toLocaleDateString('fr-FR') : (isNaN(new Date(tx.date).getTime()) ? String(tx.date) : new Date(tx.date).toLocaleDateString('fr-FR'))) : '';
                      return (
                        <div key={tx.id} className="py-2 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-extrabold text-ac-brown truncate max-w-[150px]">{tx.name}</p>
                            <span className="text-[8px] font-bold text-ac-brown-light block">{formattedDate}</span>
                          </div>
                          <span className={`font-black ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                            {isIncome ? '+' : '-'}{(tx.amount ?? 0).toLocaleString('fr-FR')} 🔔
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center text-[10px] font-black text-white/80 group-hover:text-white transition-colors">
                Voir le détail des transactions <ChevronRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            );
          })() : (
            <div className="ac-card bg-white p-6 border-ac-brown text-center py-12">
              <span className="text-2xl">⭐</span>
              <p className="font-extrabold text-ac-brown mt-2">Aucun compte bancaire enregistré.</p>
              <p className="text-xs text-ac-brown-light mt-1">Crée ton premier compte dans l'onglet Comptes pour commencer à suivre tes clochettes ! 🍃</p>
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
                {otherAccounts.map((acc) => {
                  const isProj = Boolean(acc.projectId);
                  return (
                    <div 
                      key={acc.id}
                      onClick={() => onViewAccountDetails(acc.id)}
                      style={isProj ? { backgroundColor: '#1E232A', borderColor: '#2E3440', color: '#ffffff' } : { backgroundColor: resolveColorHex(acc.color), color: '#ffffff' }}
                      className={`p-4 hover:brightness-95 transition-all border-2 rounded-2xl cursor-pointer flex justify-between items-center group relative shadow-xs text-white ${
                        isProj ? 'project-account-card bg-[#1E232A] text-white border-[#2E3440]' : 'border-ac-brown'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`font-extrabold text-xs ${isProj ? 'text-white' : 'text-white'}`}>{acc.name || acc.title || (isProj ? "Compte Projet" : "Compte")}</h4>
                          {isProj && (
                            <span className="text-[7px] font-black uppercase px-1.5 py-0.2 bg-ac-gold/20 text-ac-gold border border-ac-gold/40 rounded-full">
                              📁 Projet
                            </span>
                          )}
                        </div>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border mt-1 inline-block ${
                          isProj ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white/20 border-white/30 text-white/90'
                        }`}>
                          🏦 {acc.bank || acc.bankName || '—'}
                        </span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={`font-black text-sm block ${isProj ? 'text-white' : 'text-white'}`}>
                          {(acc.balance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 🔔
                        </span>
                        {acc.balance !== acc.visibleBalance && (
                          <span className={`text-[8px] font-extrabold block ${acc.visibleBalance < 0 ? 'text-amber-300' : (isProj ? 'text-slate-400' : 'text-white/75')}`}>
                            Dispo : {(acc.visibleBalance ?? 0).toLocaleString('fr-FR')} 🔔
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sub-grid for Wishes & Debts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Wishlist Card */}
            <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
              <div>
                <div 
                  onClick={() => handleNavigate('wishlist')} 
                  className="flex items-center justify-between mb-4 border-b border-ac-brown/10 pb-3 cursor-pointer group select-none"
                  title="Accéder à mes souhaits"
                >
                  <h3 className="text-base font-black text-ac-brown flex items-center gap-2 group-hover:text-ac-green transition-colors">
                    <Gift className="w-5 h-5 text-ac-red fill-ac-red/20 group-hover:scale-110 transition-transform" /> Mes Souhaits ({wishlist ? wishlist.length : 0})
                  </h3>
                  <ChevronRight className="w-4 h-4 text-ac-brown-light group-hover:translate-x-1 group-hover:text-ac-green transition-all" />
                </div>

                {!wishlist || wishlist.length === 0 ? (
                  <div 
                    onClick={() => handleNavigate('wishlist')}
                    className="cursor-pointer text-xs font-semibold text-ac-brown-light text-center py-4 bg-ac-cream hover:bg-ac-cream-dark/30 rounded-2xl border border-dashed border-ac-brown/20 transition-all hover:scale-[1.01]"
                  >
                    <p>Aucun souhait en cours. 🍃</p>
                    <span className="text-[10px] font-bold text-ac-green underline mt-0.5 inline-block">Voir tous les souhaits</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wishlist.slice(0, 2).map((wish) => (
                      <div 
                        key={wish.id} 
                        onClick={() => handleNavigate('wishlist')}
                        className="p-3 bg-ac-cream hover:bg-ac-cream-dark/40 rounded-2xl border-2 border-ac-brown flex justify-between items-center cursor-pointer transition-all hover:scale-[1.02] active:scale-95 shadow-xs hover:shadow-ac-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-xs text-ac-brown truncate">{wish.name}</h4>
                          {wish.description && (
                            <p className="text-[10px] text-ac-brown-light truncate">{wish.description}</p>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-ac-brown-light/60 shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Debts Card */}
            <div className="ac-card p-6 bg-white border-ac-brown flex flex-col justify-between">
              <div>
                <div 
                  onClick={() => handleNavigate('debts')} 
                  className="flex items-center justify-between mb-4 border-b border-ac-brown/10 pb-3 cursor-pointer group select-none"
                  title="Accéder à mes dettes"
                >
                  <h3 className="text-base font-black text-ac-brown flex items-center gap-2 group-hover:text-ac-orange transition-colors">
                    <Handshake className="w-5 h-5 text-ac-orange group-hover:scale-110 transition-transform" /> Mes Dettes ({activeDebts.length})
                  </h3>
                  <ChevronRight className="w-4 h-4 text-ac-brown-light group-hover:translate-x-1 group-hover:text-ac-orange transition-all" />
                </div>

                {activeDebts.length === 0 ? (
                  <div 
                    onClick={() => handleNavigate('debts')}
                    className="cursor-pointer text-xs font-semibold text-ac-brown-light text-center py-4 bg-ac-cream hover:bg-ac-cream-dark/30 rounded-2xl border border-dashed border-ac-brown/20 transition-all hover:scale-[1.01]"
                  >
                    <p>Aucune dette en cours. Super ! 🍃</p>
                    <span className="text-[10px] font-bold text-ac-orange underline mt-0.5 inline-block">Voir le registre des dettes</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeDebts.slice(0, 2).map((debt) => {
                      const rawType = (debt.type || '').toLowerCase().trim();
                      const isToPay = ['i_owe', 'debt', 'je_dois', 'to_pay', 'dette'].includes(rawType) || (typeof debt.amount === 'number' && debt.amount < 0);
                      const personName = debt.person || debt.name || debt.associatedFriendName || 'Dette';
                      const amountVal = Math.abs(debt.amount ?? 0);
                      return (
                        <div 
                          key={debt.id} 
                          onClick={() => handleNavigate('debts')}
                          className={`p-3 rounded-2xl border-2 border-ac-brown flex justify-between items-center cursor-pointer transition-all hover:scale-[1.02] active:scale-95 shadow-xs hover:shadow-ac-xs ${
                            isToPay ? 'bg-ac-red-light/10 hover:bg-ac-red-light/20' : 'bg-ac-green-light/20 hover:bg-ac-green-light/30'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                isToPay ? 'bg-ac-red text-white border-ac-brown' : 'bg-ac-green text-white border-ac-brown'
                              }`}>
                                {isToPay ? 'Je dois' : 'On me doit'}
                              </span>
                              <h4 className="font-extrabold text-xs text-ac-brown truncate">{personName}</h4>
                            </div>
                            {debt.description && (
                              <p className="text-[10px] text-ac-brown-light truncate mt-0.5">{debt.description}</p>
                            )}
                          </div>
                          <div className="text-right ml-3 shrink-0">
                            <span className="font-black text-xs text-ac-brown bg-white border border-ac-brown/25 px-2 py-0.5 rounded-full inline-block shadow-ac-xs">
                              {(amountVal ?? 0).toLocaleString('fr-FR')} 🔔
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
                    const formattedDate = tx.date ? (tx.date?.toDate ? tx.date.toDate().toLocaleDateString('fr-FR') : (isNaN(new Date(tx.date).getTime()) ? String(tx.date) : new Date(tx.date).toLocaleDateString('fr-FR'))) : '';
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
                            <span>{formattedDate}</span>
                            <span>•</span>
                            <span className="bg-ac-cream border border-ac-brown/10 px-1 rounded truncate max-w-[80px]">
                              {matchingAccount?.name || 'Inconnu'}
                            </span>
                          </div>
                          
                          {/* Badges for Execution Types */}
                          <div className="mt-1 flex gap-1 items-center">
                            {(() => {
                              const badge = getExecutionBadgeInfo(tx);
                              return (
                                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${badge.className}`}>
                                  {badge.icon && <span>{badge.icon}</span>}
                                  <span>{badge.label}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="text-right whitespace-nowrap shrink-0">
                          <span className={`font-black text-xs ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                            {isIncome ? '+' : '-'}{(tx.amount ?? 0).toLocaleString('fr-FR')} 🔔
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
