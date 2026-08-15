import React, { useState, useMemo } from 'react';
import { useDb, db } from '../db';
import { 
  Folder, Plus, Users, Crown, Shield, Eye, Calendar, 
  ChevronRight, Sparkles, X, PiggyBank, Gift, Handshake, AlertCircle
} from 'lucide-react';
import ProjectDetailView from './ProjectDetailView';

export default function ProjectsView() {
  const { projects = [], user, accounts = [], wishlist = [], debts = [], allUsersMeta = [] } = useDb();
  
  // Selected project ID for detailed view
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // New Project Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find active selected project
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Handle New Project Creation
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newProjId = await db.projects.add({ name: projectName.trim() });
      setProjectName('');
      setIsModalOpen(false);
      if (newProjId) {
        setSelectedProjectId(newProjId);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création du projet : " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to determine user's role badge on card
  const getUserRole = (proj) => {
    if (!user) return 'viewer';
    if (proj.ownerId === user.uid) return 'owner';
    const memberObj = proj.members?.[user.uid];
    return memberObj?.role || 'viewer';
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'owner':
        return (
          <span className="bg-amber-100/90 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
            👑 Propriétaire
          </span>
        );
      case 'editor':
        return (
          <span className="bg-blue-100/90 text-blue-900 border border-blue-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
            ✏️ Éditeur
          </span>
        );
      case 'viewer':
      default:
        return (
          <span className="bg-slate-100/90 text-slate-800 border border-slate-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
            👁️ Spectateur
          </span>
        );
    }
  };

  // If a project is selected, render ProjectDetailView
  if (selectedProjectId && activeProject) {
    return (
      <ProjectDetailView 
        project={activeProject} 
        onBack={() => setSelectedProjectId(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm">
        <div>
          <h2 className="text-2xl font-black text-ac-brown flex items-center gap-2">
            <Folder className="w-6 h-6 text-ac-green" /> Espaces & Projets Collaboratifs
          </h2>
          <p className="text-xs font-semibold text-ac-brown-light mt-0.5">
            Créez des espaces partagés avec vos amis (comptes, souhaits et dettes collectives dédiés).
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-ac-green text-white font-extrabold text-sm px-4 py-3 rounded-2xl border-2 border-ac-brown shadow-ac-sm flex items-center justify-center gap-2 hover:translate-y-[1px] cursor-pointer self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" /> Nouveau Projet
        </button>
      </div>

      {/* Projects Grid / Empty State */}
      {projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border-3 border-ac-brown text-ac-brown-light space-y-4 p-6 shadow-ac-xs">
          <div className="w-16 h-16 bg-ac-cream rounded-full border-2 border-ac-brown/30 flex items-center justify-center mx-auto text-ac-green">
            <Folder className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-extrabold text-base text-ac-brown">Tu ne participes à aucun projet pour l'instant</h3>
            <p className="text-xs text-ac-brown-light">
              Crée un nouvel espace pour organiser des vacances, une colocation, un mariage ou une cagnotte partagée avec tes amis !
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-ac-green text-white font-extrabold text-xs px-5 py-2.5 rounded-xl border-2 border-ac-brown shadow-ac-sm hover:translate-y-[1px] cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Créer mon premier projet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const role = getUserRole(proj);
            const memberCount = (proj.memberUids || []).length;
            const projAccountsCount = accounts.filter(a => a.projectId === proj.id).length;
            const projWishesCount = wishlist.filter(w => w.projectId === proj.id).length;
            const projDebtsCount = debts.filter(d => d.projectId === proj.id && d.status !== 'resolved' && d.status !== 'settled').length;

            const formattedDate = proj.createdAt 
              ? new Date(proj.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Récemment';

            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className="bg-white border-3 border-ac-brown rounded-3xl p-6 shadow-ac-sm hover:shadow-ac-md hover:scale-[1.01] transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top header on card */}
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="w-10 h-10 rounded-2xl bg-ac-cream border-2 border-ac-brown flex items-center justify-center text-lg shrink-0 group-hover:rotate-6 transition-transform">
                      📁
                    </span>
                    {getRoleBadge(role)}
                  </div>

                  <h3 className="font-black text-xl text-ac-brown group-hover:text-ac-green transition-colors leading-snug truncate">
                    {proj.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ac-brown-light mt-1.5">
                    <span>Par <strong>{proj.ownerName || 'Habitant'}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {formattedDate}
                    </span>
                  </div>
                </div>

                {/* Bottom stats & members badge */}
                <div className="mt-6 pt-4 border-t-2 border-ac-brown/10 flex justify-between items-center">
                  <div className="flex items-center gap-3 text-xs font-extrabold text-ac-brown-light">
                    <span className="flex items-center gap-1" title={`${projAccountsCount} compte(s) projet`}>
                      <PiggyBank className="w-3.5 h-3.5 text-ac-gold" /> {projAccountsCount}
                    </span>
                    <span className="flex items-center gap-1" title={`${projWishesCount} souhait(s)`}>
                      <Gift className="w-3.5 h-3.5 text-ac-red" /> {projWishesCount}
                    </span>
                    <span className="flex items-center gap-1" title={`${projDebtsCount} dette(s) active(s)`}>
                      <Handshake className="w-3.5 h-3.5 text-ac-orange" /> {projDebtsCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-black text-ac-green">
                    <Users className="w-4 h-4" />
                    <span>{memberCount}</span>
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL : NOUVEAU PROJET */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl p-6 max-w-md w-full shadow-ac-lg relative animate-bounce-in">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 cursor-pointer transition-transform hover:scale-105"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black mb-1 flex items-center gap-2">
              <Folder className="w-6 h-6 text-ac-green" /> Nouveau Projet Collaboratif
            </h3>
            <p className="text-xs font-semibold text-ac-brown-light mb-4">
              Donne un nom à ton projet. Tu pourras ensuite inviter des amis et créer des comptes, souhaits et dettes dédiés.
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-ac-brown-light mb-1">Nom du projet *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ex: Vacances Grèce 2026, Coloc Nook, Mariage..."
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-3 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white transition-colors"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ac-brown/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-white text-ac-brown rounded-2xl border-2 border-ac-brown font-extrabold text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !projectName.trim()}
                  className={`px-5 py-2.5 bg-ac-green text-white rounded-2xl border-2 border-ac-brown font-extrabold text-xs shadow-ac-sm transition-all flex items-center gap-1.5 ${
                    isSubmitting || !projectName.trim() ? 'opacity-60 cursor-not-allowed' : 'hover:translate-y-[1px] cursor-pointer'
                  }`}
                >
                  <Sparkles className="w-4 h-4 fill-white" />
                  {isSubmitting ? 'Création...' : 'Créer le projet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
