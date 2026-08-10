import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useDb } from '../db';
import { db as firestoreDb } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Coins, ArrowRight, TrendingUp, TrendingDown, Sparkles, Shield, 
  ChevronRight, Gift, Activity, Smile, Handshake
} from 'lucide-react';
import AvatarStackPopover from './AvatarStackPopover';

export default function Dashboard({ onViewAccountDetails, username }) {
  const { 
    userMeta, userProfile, accountsData, favoriteAccountDetails, globalLatestTransactions, 
    wishlist, pockets, categories, debts, user 
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

  const userStorageKey = user?.uid ? `tomNookSold_${user.uid}` : null;

  // Cleanup old global residual keys
  useEffect(() => {
    localStorage.removeItem('tomNookSold');
    localStorage.removeItem('ecopine_tom_nook_sold');
  }, []);

  // Primary source of truth: Firestore userProfile.tomNookSold, fallback: scoped localStorage
  const isSold = userProfile?.tomNookSold === true || 
    userMeta?.find(m => m.key === 'tomNookSold')?.value === true || 
    (userStorageKey ? localStorage.getItem(userStorageKey) === 'true' : false);

  // Sync scoped localStorage backup when Firestore updates
  useEffect(() => {
    if (!userStorageKey) return;
    if (userProfile?.tomNookSold === true) {
      localStorage.setItem(userStorageKey, 'true');
    } else if (userProfile?.tomNookSold === false) {
      localStorage.removeItem(userStorageKey);
    }
  }, [userProfile?.tomNookSold, userStorageKey]);

  const [nookStep, setNookStep] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [isNookCollapsed, setIsNookCollapsed] = useState(false);
  const [openPopoverAccountId, setOpenPopoverAccountId] = useState(null);
  const shakeTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    };
  }, []);

  const handleBannerClick = async () => {
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

    // ÉTAPE 5 : Le Panneau VENDU (1 dernier clic après l'étape 13)
    if (nextStep >= 14) {
      if (userStorageKey) {
        localStorage.setItem(userStorageKey, 'true');
      }
      if (user?.uid) {
        try {
          await updateDoc(doc(firestoreDb, 'users_meta', user.uid), { tomNookSold: true });
        } catch (err) {
          console.error("Could not persist tomNookSold to Firestore:", err);
        }
      }
    }
  };

  const handleToggleCollapse = () => {
    if (!isNookCollapsed && !isSold) {
      // Reset step when user closes/reduces the bubble (unless sold permanently)
      setNookStep(0);
    }
    setIsNookCollapsed(!isNookCollapsed);
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
                      {nookStep === 0 && `"Oui, oui ! Ravi de te revoir. Actuellement, ton île possède un total combiné de ${totalBalance.toLocaleString('fr-FR')} 🔔. Prends soin de tes économies !"`}
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
          {favoriteAccountDetails ? (
            <div 
              onClick={() => onViewAccountDetails(favoriteAccountDetails.account.id)}
              className="ac-card bg-ac-gold-light p-8 cursor-pointer relative overflow-visible group select-none border-ac-brown hover:scale-[1.01] transition-all"
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
                <div className="flex items-center gap-2">
                  <AvatarStackPopover
                    allowedUsers={favoriteAccountDetails.account.allowedUsers || []}
                    userRoles={favoriteAccountDetails.account.userRoles || {}}
                    ownerId={favoriteAccountDetails.account.creatorId || favoriteAccountDetails.account.ownerId}
                    docId={favoriteAccountDetails.account.id}
                    collectionName="accounts"
                    size="md"
                  />
                  <div className="w-12 h-12 bg-ac-gold rounded-full flex items-center justify-center border-2 border-ac-brown shadow-ac-sm group-hover:scale-110 transition-transform duration-200">
                    <Coins className="w-6 h-6 text-white fill-white" />
                  </div>
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
                {otherAccounts.map((acc) => {
                  const isPopoverOpen = openPopoverAccountId === acc.id;
                  return (
                    <div 
                      key={acc.id}
                      onClick={() => onViewAccountDetails(acc.id)}
                      className={`p-4 bg-ac-cream-dark/40 hover:bg-ac-cream-dark/80 transition-colors border-2 border-ac-brown rounded-2xl cursor-pointer flex justify-between items-center group relative ${
                        isPopoverOpen ? 'z-30' : 'z-0'
                      }`}
                    >
                      <div>
                        <h4 className="font-extrabold text-xs text-ac-brown">{acc.name}</h4>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-white border border-ac-brown/20 text-ac-brown-light mt-1 inline-block">
                          {acc.sharedWithNames && acc.sharedWithNames.length > 0 
                            ? `Partagé avec ${acc.sharedWithNames.join(', ')}` 
                            : acc.type} {acc.rate > 0 ? `(${acc.rate}%)` : ''}
                        </span>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <AvatarStackPopover
                            allowedUsers={acc.allowedUsers || []}
                            userRoles={acc.userRoles || {}}
                            ownerId={acc.creatorId || acc.ownerId}
                            docId={acc.id}
                            collectionName="accounts"
                            size="sm"
                            onOpenChange={(open) => setOpenPopoverAccountId(open ? acc.id : null)}
                          />
                        </div>
                        <span className="font-black text-sm text-ac-brown block">
                          {acc.visibleBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 🔔
                        </span>
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
                      <div className="text-right ml-3 shrink-0 flex items-center gap-2">
                        <AvatarStackPopover
                          allowedUsers={wish.allowedUsers || []}
                          userRoles={wish.userRoles || {}}
                          ownerId={wish.creatorId || wish.userId}
                          docId={wish.id}
                          collectionName="wishlist"
                          size="sm"
                        />
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
