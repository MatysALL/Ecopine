import React, { useState, useMemo } from 'react';
import { db, useDb, COLOR_PALETTE, getCustomCardStyle, getAccountBalanceSync } from '../db';
import { 
  ArrowLeft, Users, Shield, Crown, Edit3, Trash2, Plus, 
  PiggyBank, Gift, Handshake, Landmark, LogOut, Check, X, 
  Sparkles, ArrowRightLeft, UserPlus, Coins, AlertTriangle,
  Folder, User, CheckCircle2, ChevronRight
} from 'lucide-react';
import TransactionModal from './TransactionModal';
import PocketManager from './PocketManager';

export default function ProjectDetailView({ project, onBack }) {
  const { 
    user, 
    username, 
    accounts, 
    transactions, 
    pockets, 
    wishlist, 
    debts, 
    acceptedFriends, 
    allUsersMeta 
  } = useDb();

  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'accounts' | 'wishlist' | 'debts' | 'members'
  
  // Selected Account for drill-down within project
  const [selectedAccId, setSelectedAccId] = useState(null);

  // Project Rename State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newProjectName, setNewProjectName] = useState(project.name || '');

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedFriendUid, setSelectedFriendUid] = useState('');
  const [selectedInviteRole, setSelectedInviteRole] = useState('editor');

  // Project Account Modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accBankName, setAccBankName] = useState('');
  const [accColor, setAccColor] = useState('#78B159');
  const [accInitialBalance, setAccInitialBalance] = useState('0');

  // Transaction Modal for project account
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  // Transfer Modal within project
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState('');
  const [transferDestId, setTransferDestId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');

  // Project Wish Modal
  const [wishModalOpen, setWishModalOpen] = useState(false);
  const [editingWish, setEditingWish] = useState(null);
  const [wishName, setWishName] = useState('');
  const [wishDesc, setWishDesc] = useState('');
  const [buyingWish, setBuyingWish] = useState(null);
  const [buyingPrice, setBuyingPrice] = useState('');
  const [buyingAccountId, setBuyingAccountId] = useState('');

  // Project Debt Modal
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [debtorType, setDebtorType] = useState('member'); // 'member' | 'free'
  const [creditorType, setCreditorType] = useState('member'); // 'member' | 'free'
  const [debtorMemberUid, setDebtorMemberUid] = useState('');
  const [debtorFreeName, setDebtorFreeName] = useState('');
  const [creditorMemberUid, setCreditorMemberUid] = useState('');
  const [creditorFreeName, setCreditorFreeName] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDescription, setDebtDescription] = useState('');

  // Current User's Role in this project
  const myRole = useMemo(() => {
    if (!project || !user) return 'viewer';
    if (project.ownerId === user.uid) return 'owner';
    const memberObj = project.members?.[user.uid];
    return memberObj?.role || 'viewer';
  }, [project, user]);

  const isOwner = myRole === 'owner';
  const canEdit = myRole === 'owner' || myRole === 'editor';

  // Filter project-specific accounts
  const projectAccounts = useMemo(() => {
    return (accounts || [])
      .filter(a => a.projectId === project.id)
      .map(acc => {
        const bal = getAccountBalanceSync(acc, transactions || []);
        return { ...acc, balance: bal, visibleBalance: bal };
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [accounts, transactions, project.id]);

  // Selected project account object
  const activeAccount = useMemo(() => {
    return projectAccounts.find(a => a.id === selectedAccId) || null;
  }, [projectAccounts, selectedAccId]);

  // Transactions of selected project account
  const activeAccountTxs = useMemo(() => {
    if (!selectedAccId) return [];
    return (transactions || [])
      .filter(t => t.accountId === selectedAccId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, selectedAccId]);

  // Filter project-specific wishlist items
  const projectWishes = useMemo(() => {
    return (wishlist || [])
      .filter(w => w.projectId === project.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [wishlist, project.id]);

  // Filter project-specific debts
  const projectDebts = useMemo(() => {
    return (debts || [])
      .filter(d => d.projectId === project.id)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [debts, project.id]);

  // Members list with metadata resolved
  const projectMemberList = useMemo(() => {
    const memberUids = project.memberUids || [];
    return memberUids.map(uid => {
      const storedMember = project.members?.[uid] || {};
      const meta = (allUsersMeta || []).find(m => m.uid === uid);
      const isProjectOwner = uid === project.ownerId;
      return {
        uid,
        name: meta?.username || storedMember.username || 'Membre',
        photoURL: meta?.photoURL || storedMember.photoURL || '/pfp-ac.jpg',
        role: isProjectOwner ? 'owner' : (storedMember.role || 'viewer')
      };
    });
  }, [project, allUsersMeta]);

  // Friends eligible for invite (accepted friends who are not yet in project)
  const eligibleFriendsToInvite = useMemo(() => {
    const existingUids = project.memberUids || [];
    return (acceptedFriends || []).filter(f => !existingUids.includes(f.uid));
  }, [acceptedFriends, project.memberUids]);

  // Summary Metrics
  const totalAccountBalance = useMemo(() => {
    return projectAccounts.reduce((sum, a) => sum + (a.visibleBalance || 0), 0);
  }, [projectAccounts]);

  const activeDebtsCount = useMemo(() => {
    return projectDebts.filter(d => d.status !== 'resolved' && d.status !== 'settled').length;
  }, [projectDebts]);

  // Handlers for Project Meta
  const handleRenameProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !isOwner) return;
    try {
      await db.projects.update(project.id, { name: newProjectName.trim() });
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la modification du nom.");
    }
  };

  const handleDeleteProject = async () => {
    if (!isOwner) return;
    const confirmName = window.prompt(`Pour supprimer définitivement le projet "${project.name}" et toutes ses données (comptes, transactions, souhaits, dettes), écris "${project.name}" ci-dessous :`);
    if (confirmName === project.name) {
      try {
        await db.projects.delete(project.id);
        onBack();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression du projet.");
      }
    }
  };

  const handleLeaveProject = async () => {
    if (isOwner) {
      alert("En tant que propriétaire, tu ne peux pas quitter ton propre projet sans le supprimer ou désigner un autre propriétaire.");
      return;
    }
    if (window.confirm("Es-tu sûr de vouloir quitter ce projet partagé ?")) {
      try {
        await db.projects.leaveProject(project.id);
        setSelectedAccId(null);
        setEditingWish(null);
        setBuyingWish(null);
        onBack("Vous avez quitté le projet.");
      } catch (err) {
        console.error(err);
        alert("Erreur lors du départ du projet : " + (err.message || err));
      }
    }
  };

  // Handlers for Member Management
  const handleInviteFriend = async (e) => {
    e.preventDefault();
    if (!selectedFriendUid || !isOwner) return;
    const targetFriend = eligibleFriendsToInvite.find(f => f.uid === selectedFriendUid);
    if (targetFriend && targetFriend.allowProjects === false) {
      alert(`${targetFriend.name} ne souhaite pas être ajouté à des projets.`);
      return;
    }
    try {
      await db.projects.addMember(project.id, selectedFriendUid, selectedInviteRole);
      setSelectedFriendUid('');
      setSelectedInviteRole('editor');
      setInviteModalOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Erreur lors de l'invitation de l'ami.");
    }
  };

  const handleUpdateRole = async (memberUid, newRole) => {
    if (!isOwner || memberUid === project.ownerId) return;
    try {
      await db.projects.updateMemberRole(project.id, memberUid, newRole);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du changement de rôle.");
    }
  };

  const handleKickMember = async (memberUid, memberName) => {
    if (!isOwner || memberUid === project.ownerId) return;
    if (window.confirm(`Retirer ${memberName} du projet ?`)) {
      try {
        await db.projects.removeMember(project.id, memberUid);
      } catch (err) {
        console.error(err);
        alert("Erreur lors du retrait du membre.");
      }
    }
  };

  // Handlers for Project Accounts
  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!accName.trim() || !canEdit) return;
    try {
      await db.accounts.add({
        name: accName.trim(),
        bankName: accBankName.trim(),
        color: accColor,
        initialBalance: parseFloat(accInitialBalance) || 0,
        type: 'Courant',
        projectId: project.id,
        projectName: project.name,
        allowedUsers: project.memberUids || [user.uid]
      });
      setAccName('');
      setAccBankName('');
      setAccInitialBalance('0');
      setAccountModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création du compte.");
    }
  };

  const handleDeleteAccount = async (accId) => {
    if (!canEdit) return;
    if (window.confirm("Supprimer ce compte et toutes ses transactions ?")) {
      try {
        await db.accounts.delete(accId);
        if (selectedAccId === accId) setSelectedAccId(null);
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  // Handlers for Project Transactions
  const handleSaveTransaction = async (txData) => {
    if (!canEdit || !selectedAccId) return;
    try {
      const preparedData = {
        ...txData,
        accountId: selectedAccId,
        projectId: project.id,
        projectName: project.name,
        allowedUsers: project.memberUids || [user.uid]
      };
      if (editingTx) {
        await db.transactions.update(editingTx.id, preparedData);
      } else {
        await db.transactions.add(preparedData);
      }
      setTxModalOpen(false);
      setEditingTx(null);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la transaction.");
    }
  };

  const handleDeleteTx = async (txId) => {
    if (!canEdit) return;
    if (window.confirm("Supprimer cette transaction ?")) {
      try {
        await db.transactions.delete(txId);
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  // Handlers for Project Wishlist
  const handleSaveWish = async (e) => {
    e.preventDefault();
    if (!wishName.trim() || !canEdit) return;
    try {
      const wishData = {
        name: wishName.trim(),
        description: wishDesc.trim(),
        projectId: project.id,
        projectName: project.name,
        allowedUsers: project.memberUids || [user.uid]
      };
      if (editingWish) {
        await db.wishlist.update(editingWish.id, wishData);
      } else {
        await db.wishlist.add({
          ...wishData,
          order: projectWishes.length
        });
      }
      setWishName('');
      setWishDesc('');
      setEditingWish(null);
      setWishModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du souhait.");
    }
  };

  const handleDeleteWish = async (wishId) => {
    if (!canEdit) return;
    if (window.confirm("Retirer ce souhait du projet ?")) {
      try {
        await db.wishlist.delete(wishId);
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const handleConfirmPurchaseWish = async (e) => {
    e.preventDefault();
    if (!buyingWish || !buyingAccountId || !canEdit) return;
    const priceVal = parseFloat(buyingPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      alert("Veuillez entrer un prix valide.");
      return;
    }
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await db.transactions.add({
        accountId: buyingAccountId,
        name: `Achat souhait : ${buyingWish.name}`,
        description: buyingWish.description || 'Souhait projet réalisé',
        amount: priceVal,
        type: 'debit',
        date: todayStr,
        executionType: 'spontaneous',
        projectId: project.id,
        projectName: project.name,
        allowedUsers: project.memberUids || [user.uid]
      });
      await db.wishlist.delete(buyingWish.id);
      setBuyingWish(null);
      setBuyingPrice('');
      setBuyingAccountId('');
    } catch (err) {
      console.error(err);
      alert("Erreur lors du règlement du souhait.");
    }
  };

  // Handlers for Project Debts
  const handleSaveDebt = async (e) => {
    e.preventDefault();
    if (!canEdit) return;

    let finalDebtor = '';
    let finalCreditor = '';

    if (debtorType === 'member') {
      const m = projectMemberList.find(mem => mem.uid === debtorMemberUid);
      finalDebtor = m?.name || 'Membre';
    } else {
      finalDebtor = debtorFreeName.trim();
    }

    if (creditorType === 'member') {
      const m = projectMemberList.find(mem => mem.uid === creditorMemberUid);
      finalCreditor = m?.name || 'Membre';
    } else {
      finalCreditor = creditorFreeName.trim();
    }

    const amt = parseFloat(debtAmount);
    if (!finalDebtor || !finalCreditor || isNaN(amt) || amt <= 0) {
      alert("Veuillez renseigner le débiteur, le créancier et un montant valide.");
      return;
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await db.debts.add({
        debtorName: finalDebtor,
        creditorName: finalCreditor,
        person: finalDebtor,
        entityName: finalDebtor,
        name: `${finalDebtor} doit à ${finalCreditor}`,
        amount: amt,
        description: debtDescription.trim(),
        projectId: project.id,
        projectName: project.name,
        allowedUsers: project.memberUids || [user.uid],
        status: 'pending',
        createdAt: todayStr,
        date: todayStr
      });
      setDebtorFreeName('');
      setCreditorFreeName('');
      setDebtAmount('');
      setDebtDescription('');
      setDebtModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création de la dette collective.");
    }
  };

  const handleSettleDebt = async (debtId) => {
    if (!canEdit) return;
    if (window.confirm("Marquer cette dette collective comme réglée ?")) {
      try {
        await db.debts.update(debtId, { status: 'settled', isPaid: true });
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la mise à jour.");
      }
    }
  };

  const handleDeleteDebt = async (debtId) => {
    if (!canEdit) return;
    if (window.confirm("Supprimer cette dette ?")) {
      try {
        await db.debts.delete(debtId);
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  // Internal Transfer Handler
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferSourceId || !transferDestId || transferSourceId === transferDestId || !canEdit) {
      alert("Veuillez sélectionner deux comptes distincts.");
      return;
    }
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Montant invalide.");
      return;
    }
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const srcAcc = projectAccounts.find(a => a.id === transferSourceId);
      const destAcc = projectAccounts.find(a => a.id === transferDestId);

      await db.transaction(async () => {
        await db.transactions.add({
          accountId: transferSourceId,
          name: `Virement vers ${destAcc?.name || 'compte projet'}`,
          description: transferDesc.trim() || 'Virement interne projet',
          amount: amt,
          type: 'debit',
          date: todayStr,
          executionType: 'spontaneous',
          projectId: project.id,
          projectName: project.name,
          allowedUsers: project.memberUids || [user.uid]
        });
        await db.transactions.add({
          accountId: transferDestId,
          name: `Virement depuis ${srcAcc?.name || 'compte projet'}`,
          description: transferDesc.trim() || 'Virement interne projet',
          amount: amt,
          type: 'credit',
          date: todayStr,
          executionType: 'spontaneous',
          projectId: project.id,
          projectName: project.name,
          allowedUsers: project.memberUids || [user.uid]
        });
      });
      setTransferSourceId('');
      setTransferDestId('');
      setTransferAmount('');
      setTransferDesc('');
      setTransferModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du virement interne.");
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'owner':
        return <span className="bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">👑 Propriétaire</span>;
      case 'editor':
        return <span className="bg-blue-100 text-blue-800 border border-blue-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">✏️ Éditeur</span>;
      case 'viewer':
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">👁️ Spectateur</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 select-none">
      {/* Top Banner & Project Header */}
      <div className="bg-[#1E232A] text-white border-3 border-[#2E3440] rounded-3xl p-6 shadow-ac-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 relative z-10">
          <div className="flex items-start md:items-center gap-3.5">
            <button
              onClick={onBack}
              className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 text-white rounded-full p-2.5 transition-all hover:scale-105 cursor-pointer shrink-0 mt-0.5 md:mt-0"
              title="Retour à la liste des projets"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              {isEditingName ? (
                <form onSubmit={handleRenameProject} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="bg-slate-800 border-2 border-ac-gold rounded-xl px-3 py-1 text-lg font-black text-white focus:outline-none"
                    autoFocus
                  />
                  <button type="submit" className="p-1.5 bg-ac-green text-white rounded-lg cursor-pointer">
                    <Check className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setIsEditingName(false)} className="p-1.5 bg-slate-700 text-slate-300 rounded-lg cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2 tracking-tight">
                    📁 {project.name}
                  </h2>
                  {isOwner && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Renommer le projet"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-slate-300">
                <span>Créé par <strong className="text-white">{project.ownerName || 'Habitant'}</strong></span>
                <span>•</span>
                <span>{project.createdAt ? new Date(project.createdAt).toLocaleDateString('fr-FR') : ''}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-bold text-ac-gold">
                  <Users className="w-3.5 h-3.5" /> {projectMemberList.length} membre{projectMemberList.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {getRoleBadge(myRole)}
            
            {isOwner ? (
              <button
                onClick={handleDeleteProject}
                className="bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white font-extrabold text-xs px-3.5 py-2 rounded-xl border border-red-800 transition-all cursor-pointer flex items-center gap-1.5"
                title="Supprimer le projet et toutes ses données"
              >
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
            ) : (
              <button
                onClick={handleLeaveProject}
                className="bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 font-extrabold text-xs px-3.5 py-2 rounded-xl border border-slate-700 hover:border-red-800 transition-all cursor-pointer flex items-center gap-1.5"
                title="Quitter le projet"
              >
                <LogOut className="w-3.5 h-3.5" /> Quitter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 p-1.5 bg-white border-3 border-ac-brown rounded-2xl shadow-ac-xs">
        {[
          { id: 'overview', label: "Vue d'ensemble", icon: Folder },
          { id: 'accounts', label: `Comptes (${projectAccounts.length})`, icon: PiggyBank },
          { id: 'wishlist', label: `Souhaits (${projectWishes.length})`, icon: Gift },
          { id: 'debts', label: `Dettes collectives (${projectDebts.length})`, icon: Handshake },
          { id: 'members', label: `Membres (${projectMemberList.length})`, icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                if (tab.id !== 'accounts') setSelectedAccId(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs md:text-sm whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-ac-green text-white shadow-ac-xs'
                  : 'text-ac-brown hover:bg-ac-cream'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. TAB : VUE D'ENSEMBLE */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-3 border-ac-brown rounded-3xl p-5 shadow-ac-xs flex flex-col justify-between">
              <div className="flex justify-between items-center text-ac-brown-light">
                <span className="text-xs font-black uppercase">Solde Total Comptes</span>
                <PiggyBank className="w-5 h-5 text-ac-gold" />
              </div>
              <span className="text-2xl font-black text-ac-brown mt-3">
                {totalAccountBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
              </span>
            </div>

            <div className="bg-white border-3 border-ac-brown rounded-3xl p-5 shadow-ac-xs flex flex-col justify-between">
              <div className="flex justify-between items-center text-ac-brown-light">
                <span className="text-xs font-black uppercase">Comptes Dédiés</span>
                <Landmark className="w-5 h-5 text-ac-green" />
              </div>
              <span className="text-2xl font-black text-ac-brown mt-3">
                {projectAccounts.length}
              </span>
            </div>

            <div className="bg-white border-3 border-ac-brown rounded-3xl p-5 shadow-ac-xs flex flex-col justify-between">
              <div className="flex justify-between items-center text-ac-brown-light">
                <span className="text-xs font-black uppercase">Souhaits en cours</span>
                <Gift className="w-5 h-5 text-ac-red" />
              </div>
              <span className="text-2xl font-black text-ac-brown mt-3">
                {projectWishes.length}
              </span>
            </div>

            <div className="bg-white border-3 border-ac-brown rounded-3xl p-5 shadow-ac-xs flex flex-col justify-between">
              <div className="flex justify-between items-center text-ac-brown-light">
                <span className="text-xs font-black uppercase">Dettes collectives</span>
                <Handshake className="w-5 h-5 text-ac-orange" />
              </div>
              <span className="text-2xl font-black text-ac-brown mt-3">
                {activeDebtsCount}
              </span>
            </div>
          </div>

          {/* Members preview card */}
          <div className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-ac-brown flex items-center gap-2">
                <Users className="w-5 h-5 text-ac-green" /> Membres de l'équipe
              </h3>
              {isOwner && (
                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="bg-ac-green text-white font-extrabold text-xs px-3.5 py-2 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" /> Inviter un ami
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {projectMemberList.map(m => (
                <div key={m.uid} className="flex items-center gap-3 p-3 bg-ac-cream/40 border-2 border-ac-brown/15 rounded-2xl">
                  <div className="w-10 h-10 rounded-full border-2 border-ac-brown overflow-hidden bg-ac-green text-white font-black text-xs flex items-center justify-center shrink-0">
                    <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-sm text-ac-brown truncate block">
                      {m.name} {m.uid === user?.uid && '(Toi)'}
                    </span>
                    {getRoleBadge(m.role)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. TAB : COMPTES DU PROJET */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-6 animate-fade-in">
          {selectedAccId && activeAccount ? (
            /* Account Drilldown within project */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#1E232A] text-white border-3 border-[#2E3440] rounded-3xl p-6 shadow-ac-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedAccId(null)}
                    className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 text-white rounded-full p-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                      {activeAccount.name}
                      {activeAccount.bankName && (
                        <span className="text-xs font-black bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                          {activeAccount.bankName}
                        </span>
                      )}
                    </h3>
                    <span className="text-xs text-slate-400 font-bold">Compte collaboratif • Projet {project.name}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right bg-slate-800/90 border border-slate-700 rounded-2xl px-5 py-2.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase block">Solde Disponible</span>
                  <span className="text-2xl font-black text-ac-gold">
                    {(activeAccount.visibleBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                  </span>
                </div>
              </div>

              {/* Pockets Manager inside project account */}
              <PocketManager accountId={selectedAccId} role={myRole} />

              {/* Account Transactions header */}
              <div className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-black text-ac-brown flex items-center gap-2">
                    <Coins className="w-5 h-5 text-ac-green" /> Historique des transactions
                  </h4>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditingTx(null);
                        setTxModalOpen(true);
                      }}
                      className="bg-ac-green text-white font-extrabold text-xs px-3.5 py-2 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1.5 hover:translate-y-[1px] cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Nouvelle Transaction
                    </button>
                  )}
                </div>

                {activeAccountTxs.length === 0 ? (
                  <p className="text-center py-8 text-ac-brown-light font-bold text-xs">
                    Aucune transaction sur ce compte de projet pour l'instant.
                  </p>
                ) : (
                  <div className="divide-y divide-ac-brown/10">
                    {activeAccountTxs.map(tx => {
                      const isIncome = tx.type === 'credit';
                      return (
                        <div key={tx.id} className="py-3.5 flex justify-between items-center">
                          <div>
                            <span className="text-[10px] font-black text-ac-brown-light">
                              {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : ''}
                            </span>
                            <h5 className="font-extrabold text-sm text-ac-brown">
                              {tx.name || tx.description}
                            </h5>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-black text-sm ${isIncome ? 'text-ac-green' : 'text-ac-brown'}`}>
                              {isIncome ? '+' : '-'}{(tx.amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                            </span>
                            {canEdit && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => {
                                    setEditingTx(tx);
                                    setTxModalOpen(true);
                                  }}
                                  className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTx(tx.id)}
                                  className="p-1.5 hover:bg-ac-red-light rounded-lg text-ac-brown-light hover:text-ac-red cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Accounts Grid */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
                <div>
                  <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                    <PiggyBank className="w-6 h-6 text-ac-gold" /> Comptes bancaires du projet
                  </h3>
                  <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                    Gérez la trésorerie et les comptes partagés pour ce projet.
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-2.5">
                    {projectAccounts.length >= 2 && (
                      <button
                        onClick={() => setTransferModalOpen(true)}
                        className="bg-ac-gold text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-4 h-4" /> Virement interne
                      </button>
                    )}
                    <button
                      onClick={() => setAccountModalOpen(true)}
                      className="bg-ac-green text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Nouveau Compte
                    </button>
                  </div>
                )}
              </div>

              {projectAccounts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light space-y-3">
                  <PiggyBank className="w-12 h-12 text-ac-brown-light/40 mx-auto" />
                  <p className="font-extrabold text-sm">Aucun compte bancaire créé pour ce projet.</p>
                  {canEdit && (
                    <p className="text-xs">Créez votre premier compte dédié pour suivre les dépenses et recettes collectives !</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projectAccounts.map(acc => (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccId(acc.id)}
                      className="bg-[#1E232A] text-white border-3 border-[#2E3440] rounded-3xl p-5 shadow-ac-md cursor-pointer hover:scale-[1.01] transition-all flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-base text-white leading-tight break-words">
                            {acc.name || acc.title || "Compte"}
                          </h4>
                          {acc.bankName && (
                            <span className="text-[10px] font-bold text-slate-400 block mt-1">
                              🏦 {acc.bankName}
                            </span>
                          )}
                        </div>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAccount(acc.id);
                            }}
                            className="p-1.5 hover:bg-red-950/60 rounded-lg text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Supprimer le compte"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-700 flex justify-between items-baseline">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Solde Disponible</span>
                        <span className="font-black text-lg text-ac-gold">
                          {(acc.visibleBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB : SOUHAITS DU PROJET */}
      {activeSubTab === 'wishlist' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div>
              <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                <Gift className="w-6 h-6 text-ac-red" /> Souhaits & Achats du projet
              </h3>
              <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                Notez les besoins et souhaits d'achats collectifs sans fixer de prix à l'avance.
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingWish(null);
                  setWishName('');
                  setWishDesc('');
                  setWishModalOpen(true);
                }}
                className="bg-ac-green text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nouveau Souhait
              </button>
            )}
          </div>

          {projectWishes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light space-y-3">
              <Gift className="w-12 h-12 text-ac-brown-light/40 mx-auto" />
              <p className="font-extrabold text-sm">Aucun souhait dans ce projet.</p>
              {canEdit && (
                <p className="text-xs">Ajoutez un souhait d'achat pour que toute l'équipe puisse le suivre !</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectWishes.map(w => (
                <div
                  key={w.id}
                  className="bg-[#1E232A] text-white border-3 border-[#2E3440] rounded-3xl p-5 shadow-ac-md flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <h4 className="font-black text-base text-white tracking-wide break-words">
                      {w.name || w.title || "Souhait"}
                    </h4>
                    {w.description ? (
                      <p className="text-xs font-semibold text-slate-300 italic line-clamp-2">
                        "{w.description}"
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-slate-500 italic">
                        Aucune description renseignée.
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-700 flex justify-between items-center">
                    {canEdit ? (
                      <>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingWish(w);
                              setWishName(w.name || '');
                              setWishDesc(w.description || '');
                              setWishModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                            title="Modifier"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteWish(w.id)}
                            className="p-1.5 bg-slate-800 hover:bg-red-950 text-red-400 rounded-lg cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setBuyingWish(w);
                            setBuyingPrice('');
                            setBuyingAccountId(projectAccounts[0]?.id || '');
                          }}
                          className="bg-ac-green text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl border border-ac-brown shadow-ac-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 fill-white" /> Solder
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 italic">Lecture seule</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB : DETTES DU PROJET (COLLECTIVES & ISOLÉES) */}
      {activeSubTab === 'debts' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div>
              <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                <Handshake className="w-6 h-6 text-ac-orange" /> Dettes collectives du projet
              </h3>
              <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                Suivez qui doit de l'argent à qui au sein du projet. Ces dettes sont totalement isolées de votre onglet Dettes personnel.
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setDebtorType('member');
                  setCreditorType('member');
                  setDebtorMemberUid(projectMemberList[0]?.uid || '');
                  setCreditorMemberUid(projectMemberList[1]?.uid || projectMemberList[0]?.uid || '');
                  setDebtAmount('');
                  setDebtDescription('');
                  setDebtModalOpen(true);
                }}
                className="bg-ac-green text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nouvelle Dette
              </button>
            )}
          </div>

          {projectDebts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light space-y-3">
              <Handshake className="w-12 h-12 text-ac-brown-light/40 mx-auto" />
              <p className="font-extrabold text-sm">Aucune dette collective enregistrée dans ce projet.</p>
              {canEdit && (
                <p className="text-xs">Ajoutez un remboursement ou un partage de frais entre membres !</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectDebts.map(d => {
                const isSettled = d.status === 'settled' || d.status === 'resolved' || d.isPaid;
                return (
                  <div
                    key={d.id}
                    className={`bg-white border-3 border-ac-brown rounded-3xl p-5 shadow-ac-xs flex flex-col justify-between transition-all ${
                      isSettled ? 'opacity-65 bg-ac-cream/30' : ''
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-ac-red bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl">
                            {d.debtorName || d.person || 'Débiteur'}
                          </span>
                          <span className="font-extrabold text-xs text-ac-brown-light">doit à</span>
                          <span className="font-black text-sm text-ac-green bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl">
                            {d.creditorName || 'Créancier'}
                          </span>
                        </div>
                        <span className="font-black text-base text-ac-brown">
                          {(d.amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} 🔔
                        </span>
                      </div>

                      {d.description && (
                        <p className="text-xs font-semibold text-ac-brown-light mt-3 italic bg-ac-cream/50 p-2.5 rounded-xl border border-ac-brown/10">
                          "{d.description}"
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-ac-brown/10 flex justify-between items-center">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                        isSettled 
                          ? 'bg-green-100 text-green-800 border-green-300' 
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>
                        {isSettled ? '✅ Réglée' : '⏳ En attente'}
                      </span>

                      {canEdit && (
                        <div className="flex items-center gap-2">
                          {!isSettled && (
                            <button
                              onClick={() => handleSettleDebt(d.id)}
                              className="bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown shadow-ac-xs hover:translate-y-[1px] cursor-pointer"
                            >
                              Marquer réglée
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDebt(d.id)}
                            className="p-1.5 hover:bg-ac-red-light rounded-xl text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB : MEMBRES & PERMISSIONS */}
      {activeSubTab === 'members' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
            <div>
              <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                <Users className="w-6 h-6 text-ac-green" /> Gestion des membres & Rôles
              </h3>
              <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
                Contrôlez les accès et rôles des collaborateurs sur ce projet.
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => setInviteModalOpen(true)}
                className="bg-ac-green text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Inviter un ami
              </button>
            )}
          </div>

          <div className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm divide-y divide-ac-brown/10">
            {projectMemberList.map(m => {
              const isProjOwner = m.uid === project.ownerId;
              const isCurrentUser = m.uid === user?.uid;
              return (
                <div key={m.uid} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full border-2 border-ac-brown overflow-hidden bg-ac-green text-white font-black text-sm flex items-center justify-center shrink-0 shadow-ac-xs">
                      <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-ac-brown">
                          {m.name}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-ac-cream-dark text-ac-brown rounded-full border border-ac-brown/20">
                            Toi
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        {getRoleBadge(m.role)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {isOwner && !isProjOwner && (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => handleUpdateRole(m.uid, e.target.value)}
                          className="bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold text-ac-brown focus:outline-none cursor-pointer"
                        >
                          <option value="editor">✏️ Éditeur</option>
                          <option value="viewer">👁️ Spectateur</option>
                        </select>
                        <button
                          onClick={() => handleKickMember(m.uid, m.name)}
                          className="p-2 hover:bg-ac-red-light rounded-xl text-ac-brown-light hover:text-ac-red border border-ac-brown/15 cursor-pointer"
                          title="Bannir / Retirer du projet"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL : INVITER UN AMI (Owner only) */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-ac-brown/10 pb-2">
              <UserPlus className="w-5 h-5 text-ac-green" /> Inviter un ami au projet
            </h3>

            {eligibleFriendsToInvite.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm font-extrabold text-ac-brown">Tous tes amis font déjà partie de ce projet, ou tu n'as pas encore d'amis acceptés.</p>
                <p className="text-xs text-ac-brown-light">Rends-toi dans l'onglet "Social" pour ajouter de nouveaux amis !</p>
              </div>
            ) : (
              <form onSubmit={handleInviteFriend} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Sélectionner un ami *</label>
                  <select
                    value={selectedFriendUid}
                    onChange={(e) => setSelectedFriendUid(e.target.value)}
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none cursor-pointer"
                    required
                  >
                    <option value="">-- Choisir un ami --</option>
                    {eligibleFriendsToInvite.map(f => {
                      const isAllowed = f.allowProjects !== false;
                      return (
                        <option 
                          key={f.uid} 
                          value={f.uid}
                          disabled={!isAllowed}
                        >
                          {f.name} ({f.email}) {!isAllowed ? '- (Invitations non autorisées)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Rôle accordé *</label>
                  <select
                    value={selectedInviteRole}
                    onChange={(e) => setSelectedInviteRole(e.target.value)}
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none cursor-pointer"
                  >
                    <option value="editor">✏️ Éditeur (Ajout & modification)</option>
                    <option value="viewer">👁️ Spectateur (Lecture seule)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-ac-brown/10">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2.5 bg-white text-ac-brown rounded-xl border-2 border-ac-brown font-extrabold text-xs cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-ac-green text-white rounded-xl border-2 border-ac-brown font-extrabold text-xs shadow-ac-xs cursor-pointer hover:translate-y-[1px]"
                  >
                    Envoyer l'invitation
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL : NOUVEAU COMPTE PROJET */}
      {accountModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              onClick={() => setAccountModalOpen(false)}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-ac-brown/10 pb-2">
              <PiggyBank className="w-5 h-5 text-ac-gold" /> Nouveau Compte de Projet
            </h3>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du compte *</label>
                <input
                  type="text"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Ex: Trésorerie, Cagnotte, Caisse commune..."
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Banque (optionnel)</label>
                <input
                  type="text"
                  value={accBankName}
                  onChange={(e) => setAccBankName(e.target.value)}
                  placeholder="Ex: Boursorama, Nook Bank..."
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Solde initial</label>
                <input
                  type="number"
                  step="0.01"
                  value={accInitialBalance}
                  onChange={(e) => setAccInitialBalance(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(false)}
                  className="px-4 py-2.5 bg-white text-ac-brown rounded-xl border-2 border-ac-brown font-extrabold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-ac-green text-white rounded-xl border-2 border-ac-brown font-extrabold text-xs shadow-ac-xs cursor-pointer hover:translate-y-[1px]"
                >
                  Créer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : SOUHAIT DU PROJET */}
      {wishModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              onClick={() => setWishModalOpen(false)}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-ac-brown/10 pb-2">
              <Gift className="w-5 h-5 text-ac-red" /> {editingWish ? 'Modifier le souhait' : 'Nouveau Souhait'}
            </h3>

            <form onSubmit={handleSaveWish} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du souhait / achat *</label>
                <input
                  type="text"
                  value={wishName}
                  onChange={(e) => setWishName(e.target.value)}
                  placeholder="Ex: Matériel de camping, Billets d'avion..."
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Description / Notes</label>
                <input
                  type="text"
                  value={wishDesc}
                  onChange={(e) => setWishDesc(e.target.value)}
                  placeholder="Ex: Détails, liens, coloris..."
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => setWishModalOpen(false)}
                  className="px-4 py-2.5 bg-white text-ac-brown rounded-xl border-2 border-ac-brown font-extrabold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-ac-green text-white rounded-xl border-2 border-ac-brown font-extrabold text-xs shadow-ac-xs cursor-pointer hover:translate-y-[1px]"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : SOLDER UN SOUHAIT */}
      {buyingWish && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              onClick={() => setBuyingWish(null)}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-ac-brown/10 pb-2">
              <Sparkles className="w-5 h-5 text-ac-green fill-ac-green" /> Solder le souhait : "{buyingWish.name}"
            </h3>

            <form onSubmit={handleConfirmPurchaseWish} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant réel payé *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={buyingPrice}
                  onChange={(e) => setBuyingPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Compte débité *</label>
                <select
                  value={buyingAccountId}
                  onChange={(e) => setBuyingAccountId(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Choisir un compte --</option>
                  {projectAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({(a.visibleBalance ?? 0).toLocaleString('fr-FR')} 🔔 dispo)</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => setBuyingWish(null)}
                  className="px-4 py-2.5 bg-white text-ac-brown rounded-xl border-2 border-ac-brown font-extrabold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-ac-green text-white rounded-xl border-2 border-ac-brown font-extrabold text-xs shadow-ac-xs cursor-pointer hover:translate-y-[1px]"
                >
                  Valider l'achat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : NOUVELLE DETTE DU PROJET */}
      {debtModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-lg w-full shadow-ac-lg relative animate-bounce-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setDebtModalOpen(false)}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-ac-brown/10 pb-2">
              <Handshake className="w-5 h-5 text-ac-orange" /> Nouvelle Dette Collective
            </h3>

            <form onSubmit={handleSaveDebt} className="space-y-4">
              {/* Debtor section */}
              <div className="bg-red-50/70 border-2 border-red-200 rounded-2xl p-3.5 space-y-2">
                <span className="text-xs font-black uppercase text-red-800 block">1. Qui doit de l'argent ? (Débiteur)</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDebtorType('member')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-extrabold border ${
                      debtorType === 'member' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-ac-brown border-ac-brown/20'
                    }`}
                  >
                    Membre du projet
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtorType('free')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-extrabold border ${
                      debtorType === 'free' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-ac-brown border-ac-brown/20'
                    }`}
                  >
                    Saisie libre
                  </button>
                </div>

                {debtorType === 'member' ? (
                  <select
                    value={debtorMemberUid}
                    onChange={(e) => setDebtorMemberUid(e.target.value)}
                    className="w-full bg-white border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none cursor-pointer"
                  >
                    {projectMemberList.map(m => (
                      <option key={m.uid} value={m.uid}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={debtorFreeName}
                    onChange={(e) => setDebtorFreeName(e.target.value)}
                    placeholder="Nom du débiteur (ex: Tom Nook, Jean...)"
                    className="w-full bg-white border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none"
                    required
                  />
                )}
              </div>

              {/* Creditor section */}
              <div className="bg-green-50/70 border-2 border-green-200 rounded-2xl p-3.5 space-y-2">
                <span className="text-xs font-black uppercase text-green-800 block">2. À qui l'argent est dû ? (Créancier)</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditorType('member')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-extrabold border ${
                      creditorType === 'member' ? 'bg-green-600 text-white border-green-700' : 'bg-white text-ac-brown border-ac-brown/20'
                    }`}
                  >
                    Membre du projet
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditorType('free')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-extrabold border ${
                      creditorType === 'free' ? 'bg-green-600 text-white border-green-700' : 'bg-white text-ac-brown border-ac-brown/20'
                    }`}
                  >
                    Saisie libre
                  </button>
                </div>

                {creditorType === 'member' ? (
                  <select
                    value={creditorMemberUid}
                    onChange={(e) => setCreditorMemberUid(e.target.value)}
                    className="w-full bg-white border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none cursor-pointer"
                  >
                    {projectMemberList.map(m => (
                      <option key={m.uid} value={m.uid}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={creditorFreeName}
                    onChange={(e) => setCreditorFreeName(e.target.value)}
                    placeholder="Nom du créancier (ex: Marie, Boutique Nook...)"
                    className="w-full bg-white border-2 border-ac-brown rounded-xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none"
                    required
                  />
                )}
              </div>

              {/* Amount & Description */}
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Motif / Description</label>
                <input
                  type="text"
                  value={debtDescription}
                  onChange={(e) => setDebtDescription(e.target.value)}
                  placeholder="Ex: Avance resto, courses, hébergement..."
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => setDebtModalOpen(false)}
                  className="px-4 py-2.5 bg-white text-ac-brown rounded-xl border-2 border-ac-brown font-extrabold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-ac-green text-white rounded-xl border-2 border-ac-brown font-extrabold text-xs shadow-ac-xs cursor-pointer hover:translate-y-[1px]"
                >
                  Créer la dette
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : VIREMENT INTERNE DU PROJET */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              onClick={() => setTransferModalOpen(false)}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-ac-brown/10 pb-2">
              <ArrowRightLeft className="w-5 h-5 text-ac-gold" /> Virement entre comptes du projet
            </h3>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Compte source (Débit) *</label>
                <select
                  value={transferSourceId}
                  onChange={(e) => setTransferSourceId(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Choisir le compte à débiter --</option>
                  {projectAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({(a.visibleBalance ?? 0).toLocaleString('fr-FR')} 🔔)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Compte cible (Crédit) *</label>
                <select
                  value={transferDestId}
                  onChange={(e) => setTransferDestId(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Choisir le compte à créditer --</option>
                  {projectAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({(a.visibleBalance ?? 0).toLocaleString('fr-FR')} 🔔)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Montant *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Motif</label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  placeholder="Ex: Répartition trésorerie..."
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2.5 bg-white text-ac-brown rounded-xl border-2 border-ac-brown font-extrabold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-ac-green text-white rounded-xl border-2 border-ac-brown font-extrabold text-xs shadow-ac-xs cursor-pointer hover:translate-y-[1px]"
                >
                  Transférer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {txModalOpen && selectedAccId && (
        <TransactionModal
          isOpen={txModalOpen}
          onClose={() => {
            setTxModalOpen(false);
            setEditingTx(null);
          }}
          onSave={handleSaveTransaction}
          transaction={editingTx}
          accountId={selectedAccId}
        />
      )}
    </div>
  );
}
