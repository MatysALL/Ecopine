import React, { useState, useMemo } from 'react';
import { db, useDb, getNextRenewalDate } from '../db';
import { 
  Plus, Trash2, Edit2, Sparkles, Coins, Clock, AlertCircle, X 
} from 'lucide-react';

export default function PocketManager({ accountId }) {
  const { pockets: allPockets } = useDb();
  
  // UI states
  const [formOpen, setFormOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [renewalFrequency, setRenewalFrequency] = useState('monthly'); // 'weekly', 'biweekly', 'monthly', 'annual', 'none'

  // Filter pockets for the current account
  const pockets = useMemo(() => {
    if (!allPockets || !accountId) return [];
    return allPockets.filter(p => p.accountId === accountId);
  }, [allPockets, accountId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !allocatedAmount || isSubmitting) return;

    const allocated = parseFloat(allocatedAmount);
    if (isNaN(allocated) || allocated <= 0) {
      alert("Veuillez entrer un montant alloué valide.");
      return;
    }

    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const nextDate = renewalFrequency !== 'none' 
        ? getNextRenewalDate(todayStr, renewalFrequency) 
        : null;

      const pocketData = {
        accountId,
        name: name.trim(),
        allocatedAmount: allocated,
        renewalFrequency,
        nextRenewalDate: nextDate
      };

      if (editingPocket) {
        // When modifying, let's update nextRenewalDate if frequency changes, but don't overwrite currentAmount unless the user wants to or we just preserve it.
        // If the frequency changed or allocated amount changed, it is standard to keep currentAmount as-is, but update nextRenewalDate.
        const freqChanged = editingPocket.renewalFrequency !== renewalFrequency;
        const finalNextDate = freqChanged ? nextDate : editingPocket.nextRenewalDate;
        
        await db.pockets.update(editingPocket.id, {
          name: pocketData.name,
          allocatedAmount: pocketData.allocatedAmount,
          renewalFrequency: pocketData.renewalFrequency,
          nextRenewalDate: finalNextDate
        });
      } else {
        // New pocket gets full initial charge
        await db.pockets.add({
          ...pocketData,
          currentAmount: allocated
        });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la poche.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (pocket) => {
    setEditingPocket(pocket);
    setName(pocket.name);
    setAllocatedAmount(pocket.allocatedAmount.toString());
    setRenewalFrequency(pocket.renewalFrequency || 'none');
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Es-tu sûr de vouloir supprimer cette poche ? Les transactions liées perdront leur association.")) {
      try {
        await db.pockets.delete(id);
      } catch (err) {
        console.error(err);
        alert("Impossible de supprimer la poche.");
      }
    }
  };

  const resetForm = () => {
    setName('');
    setAllocatedAmount('');
    setRenewalFrequency('monthly');
    setEditingPocket(null);
    setFormOpen(false);
  };

  // Calculations for summary card
  const totalAllocated = pockets.reduce((sum, p) => sum + (Number(p.allocatedAmount) || 0), 0);
  const totalCurrent = pockets.reduce((sum, p) => sum + (Number(p.currentAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary and Actions Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-ac-green-light/20 p-5 rounded-3xl border-2 border-ac-brown">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-ac-brown flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-ac-gold fill-ac-gold" /> Pochettes virtuelles de l'habitant
          </h3>
          <p className="text-[11px] font-bold text-ac-brown-light leading-relaxed">
            Alloué : <strong>{totalAllocated.toLocaleString('fr-FR')} 🔔</strong> | Restant : <strong>{totalCurrent.toLocaleString('fr-FR')} 🔔</strong>
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setFormOpen(true); }}
          className="bg-ac-green hover:bg-ac-green/90 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl border-2 border-ac-brown shadow-ac-sm flex items-center gap-1 cursor-pointer shrink-0 transition-transform active:translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Créer une poche
        </button>
      </div>

      {/* Form Modal / Area */}
      {formOpen && (
        <div className="p-6 bg-white border-3 border-ac-brown rounded-3xl relative shadow-ac-sm animate-fade-in">
          <button 
            onClick={resetForm}
            className="absolute top-4 right-4 text-ac-brown-light hover:text-ac-brown border border-transparent hover:border-ac-brown/15 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <h4 className="text-sm font-black text-ac-brown flex items-center gap-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-ac-gold fill-ac-gold" />
            {editingPocket ? "Modifier la poche" : "Créer une nouvelle poche"}
          </h4>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Nom de la poche</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Prime de navets, Loisirs..."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Montant alloué (🔔)</label>
              <input
                type="number"
                value={allocatedAmount}
                onChange={(e) => setAllocatedAmount(e.target.value)}
                placeholder="Ex: 50000"
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold text-ac-brown focus:outline-none focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Renouvellement</label>
              <select
                value={renewalFrequency}
                onChange={(e) => setRenewalFrequency(e.target.value)}
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="none">Sans renouvellement</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="biweekly">Toutes les 2 semaines</option>
                <option value="monthly">Mensuel</option>
                <option value="annual">Annuel</option>
              </select>
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="bg-white border-2 border-ac-brown text-ac-brown font-extrabold text-xs px-4 py-2 rounded-xl hover:bg-ac-cream cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`bg-ac-green text-white font-extrabold text-xs px-5 py-2 rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center gap-1 transition-all ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:translate-y-[1px]'
                }`}
                style={isSubmitting ? { cursor: 'not-allowed' } : {}}
              >
                {isSubmitting ? 'Enregistrement...' : (editingPocket ? 'Sauvegarder' : 'Créer la poche')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Pocket Cards */}
      {pockets.length === 0 ? (
        <div className="text-center py-10 bg-white border-2 border-dashed border-ac-brown/20 rounded-3xl">
          <AlertCircle className="w-8 h-8 text-ac-brown-light mx-auto mb-2 opacity-55" />
          <p className="text-xs font-bold text-ac-brown-light">
            Aucune poche de clochettes créée sur ce compte.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pockets.map((pocket) => {
            const current = pocket.currentAmount !== undefined ? Number(pocket.currentAmount) : Number(pocket.allocatedAmount);
            const allocated = Number(pocket.allocatedAmount) || 1;
            const percentage = Math.min(100, Math.max(0, (current / allocated) * 100));
            
            // Choose color based on remaining budget
            let progressBg = 'bg-ac-green';
            let cardBg = 'bg-white';
            if (percentage < 25) {
              progressBg = 'bg-ac-red';
              cardBg = 'bg-ac-red-light/5';
            } else if (percentage < 60) {
              progressBg = 'bg-ac-gold';
            }

            return (
              <div 
                key={pocket.id} 
                className={`border-3 border-ac-brown rounded-3xl p-5 shadow-ac-sm transition-all hover:scale-[1.01] ${cardBg} flex flex-col justify-between space-y-4`}
              >
                {/* Header info */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-black text-sm text-ac-brown flex items-center gap-1">
                      🍃 {pocket.name}
                    </h4>
                    
                    {pocket.renewalFrequency && pocket.renewalFrequency !== 'none' && pocket.nextRenewalDate ? (
                      <span className="text-[9px] font-black text-ac-brown-light/75 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Renouvellement : {new Date(pocket.nextRenewalDate).toLocaleDateString('fr-FR')} ({
                          pocket.renewalFrequency === 'weekly' ? 'Hebdo' :
                          pocket.renewalFrequency === 'biweekly' ? 'Bi-hebdo' :
                          pocket.renewalFrequency === 'monthly' ? 'Mensuel' : 'Annuel'
                        })
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-ac-brown-light/50 block mt-0.5">
                        Pas de renouvellement automatique
                      </span>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(pocket)}
                      className="p-1.5 hover:bg-ac-cream rounded-lg text-ac-brown-light hover:text-ac-brown border border-transparent hover:border-ac-brown/15 cursor-pointer"
                      title="Modifier la poche"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(pocket.id)}
                      className="p-1.5 hover:bg-ac-red-light rounded-lg text-ac-brown-light hover:text-ac-red border border-transparent hover:border-ac-red/15 cursor-pointer"
                      title="Supprimer la poche"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar and numeric indicators */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs font-black">
                    <span className="text-ac-brown text-base">
                      {current.toLocaleString('fr-FR')} 🔔
                    </span>
                    <span className="text-ac-brown-light text-[10px]">
                      sur {allocated.toLocaleString('fr-FR')} 🔔
                    </span>
                  </div>

                  <div className="w-full h-4 bg-ac-cream border-2 border-ac-brown rounded-full overflow-hidden p-[2px]">
                    <div 
                      className={`h-full ${progressBg} border border-ac-brown/20 rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  
                  <div className="text-right text-[8px] font-bold text-ac-brown-light/60">
                    {percentage.toFixed(0)}% restant
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
