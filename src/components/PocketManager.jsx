import React, { useState, useMemo } from 'react';
import { db, useDb, getNextRenewalDate } from '../db';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { 
  Plus, Trash2, Edit2, Sparkles, Coins, Clock, AlertCircle, X, Layers, Tag
} from 'lucide-react';

export default function PocketManager({ accountId }) {
  const { pockets: allPockets, categories } = useDb();
  
  // UI states
  const [formOpen, setFormOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [renewalFrequency, setRenewalFrequency] = useState('monthly'); // 'weekly', 'monthly', 'none'
  const [renewalDay, setRenewalDay] = useState(''); // 1-7 for weekly, 1-31 for monthly
  const [accumulate, setAccumulate] = useState(false);
  const [categoryId, setCategoryId] = useState('');

  // Quick Debit Pop-in state
  const [debitModalOpen, setDebitModalOpen] = useState(false);
  const [debitTargetPocket, setDebitTargetPocket] = useState(null);
  const [debitAmount, setDebitAmount] = useState('');
  const [isDebiting, setIsDebiting] = useState(false);

  // Drag & Drop state
  const [draggablePocketId, setDraggablePocketId] = useState(null);
  let longPressTimer = null;

  // Filter pockets for the current account and pre-sort by order key
  const pockets = useMemo(() => {
    if (!allPockets || !accountId) return [];
    return allPockets
      .filter(p => p.accountId === accountId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
      const rDay = renewalFrequency !== 'none' && renewalDay ? Number(renewalDay) : null;
      const nextDate = renewalFrequency !== 'none' 
        ? getNextRenewalDate(todayStr, renewalFrequency, rDay) 
        : null;

      const pocketData = {
        accountId,
        name: name.trim(),
        allocatedAmount: allocated,
        renewalFrequency,
        nextRenewalDate: nextDate,
        renewalDay: rDay,
        accumulate: renewalFrequency !== 'none' ? accumulate : false,
        categoryId: categoryId || null
      };

      if (editingPocket) {
        const oldAllocated = Number(editingPocket.allocatedAmount) || 0;
        const oldCurrent = Number(editingPocket.currentAmount) || 0;
        const newAllocated = pocketData.allocatedAmount;

        let newCurrentAmount = Number(editingPocket.currentAmount) ?? allocated;
        
        // Logical purchasing power recalculation
        if (oldAllocated !== newAllocated) {
          if (pocketData.accumulate) {
            // Reset accumulation and set currentAmount to new allocated limit
            newCurrentAmount = newAllocated;
          } else {
            // Power calculation: remaining = newMax - (oldMax - oldRemaining)
            newCurrentAmount = newAllocated - (oldAllocated - oldCurrent);
          }
        }

        const freqChanged = editingPocket.renewalFrequency !== renewalFrequency || editingPocket.renewalDay !== rDay;
        const finalNextDate = freqChanged ? nextDate : editingPocket.nextRenewalDate;
        
        await db.pockets.update(editingPocket.id, {
          name: pocketData.name,
          allocatedAmount: pocketData.allocatedAmount,
          renewalFrequency: pocketData.renewalFrequency,
          nextRenewalDate: finalNextDate,
          renewalDay: pocketData.renewalDay,
          accumulate: pocketData.accumulate,
          categoryId: pocketData.categoryId,
          currentAmount: newCurrentAmount
        });
      } else {
        // New pocket gets full initial charge
        await db.pockets.add({
          ...pocketData,
          currentAmount: allocated,
          order: pockets.length
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
    setRenewalDay(pocket.renewalDay !== undefined && pocket.renewalDay !== null ? pocket.renewalDay.toString() : '');
    setAccumulate(pocket.accumulate || false);
    setCategoryId(pocket.categoryId || '');
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

  // Quick Debit handlers
  const openDebitModal = (pocket) => {
    setDebitTargetPocket(pocket);
    setDebitAmount('');
    setDebitModalOpen(true);
  };

  const handleDebitSubmit = async (e) => {
    e.preventDefault();
    if (!debitTargetPocket || !debitAmount || isDebiting) return;

    const amt = parseFloat(debitAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Veuillez entrer un montant valide supérieur à 0.");
      return;
    }

    setIsDebiting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await db.transactions.add({
        accountId,
        pocketId: debitTargetPocket.id,
        name: `Débit : ${debitTargetPocket.name}`,
        description: `Débit rapide de la poche ${debitTargetPocket.name}`,
        amount: amt,
        type: 'debit',
        date: todayStr
      });
      setDebitModalOpen(false);
      setDebitTargetPocket(null);
      setDebitAmount('');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la déduction.");
    } finally {
      setIsDebiting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setAllocatedAmount('');
    setRenewalFrequency('monthly');
    setRenewalDay('');
    setAccumulate(false);
    setCategoryId('');
    setEditingPocket(null);
    setFormOpen(false);
  };

  // Drag & Drop handlers
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, hoverIndex) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    if (dragIndex === hoverIndex || isNaN(dragIndex)) return;

    const reordered = [...pockets];
    const [dragged] = reordered.splice(dragIndex, 1);
    reordered.splice(hoverIndex, 0, dragged);

    // Save order sequence in Firestore
    const batch = writeBatch(firestoreDb);
    reordered.forEach((p, idx) => {
      const ref = doc(firestoreDb, 'pockets', p.id);
      batch.update(ref, { order: idx });
    });
    
    await batch.commit();
    setDraggablePocketId(null);
  };

  const handleDragEnd = () => {
    setDraggablePocketId(null);
  };

  const handleStartLongPress = (id) => {
    longPressTimer = setTimeout(() => {
      setDraggablePocketId(id);
    }, 850);
  };

  const handleCancelLongPress = () => {
    clearTimeout(longPressTimer);
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Nom de la poche</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Alimentation, Transports..."
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
                <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Catégorie associée</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold focus:outline-none focus:bg-white cursor-pointer"
                >
                  <option value="">-- Aucune catégorie --</option>
                  {categories?.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.emoji || '🍃'} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Fréquence de renouvellement</label>
                <select
                  value={renewalFrequency}
                  onChange={(e) => {
                    setRenewalFrequency(e.target.value);
                    setRenewalDay('');
                  }}
                  className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold focus:outline-none focus:bg-white cursor-pointer"
                >
                  <option value="none">Sans renouvellement</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>

              {/* Weekly Day Selector */}
              {renewalFrequency === 'weekly' && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Jour de renouvellement</label>
                  <select
                    value={renewalDay}
                    onChange={(e) => setRenewalDay(e.target.value)}
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold focus:outline-none focus:bg-white cursor-pointer"
                    required
                  >
                    <option value="">-- Choisir un jour --</option>
                    <option value="1">Lundi</option>
                    <option value="2">Mardi</option>
                    <option value="3">Mercredi</option>
                    <option value="4">Jeudi</option>
                    <option value="5">Vendredi</option>
                    <option value="6">Samedi</option>
                    <option value="7">Dimanche</option>
                  </select>
                </div>
              )}

              {/* Monthly Day Selector */}
              {renewalFrequency === 'monthly' && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Jour du mois</label>
                  <select
                    value={renewalDay}
                    onChange={(e) => setRenewalDay(e.target.value)}
                    className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-3 py-2 text-xs font-bold focus:outline-none focus:bg-white cursor-pointer"
                    required
                  >
                    <option value="">-- Choisir un jour --</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>Le {day === 1 ? '1er' : day}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Accumulation checkbox */}
            {renewalFrequency !== 'none' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="accumulate"
                  checked={accumulate}
                  onChange={(e) => setAccumulate(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-ac-brown bg-ac-cream text-ac-green focus:ring-0 focus:outline-none cursor-pointer"
                />
                <label htmlFor="accumulate" className="text-xs font-black text-ac-brown cursor-pointer select-none">
                  Activer l'accumulation / Report de budget
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
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
          {pockets.map((pocket, index) => {
            const current = pocket.currentAmount !== undefined ? Number(pocket.currentAmount) : Number(pocket.allocatedAmount);
            const allocated = Number(pocket.allocatedAmount) || 1;
            const percentage = Math.min(100, Math.max(0, (current / allocated) * 100));
            
            // Choose color base
            let progressBg = 'bg-ac-green';
            if (percentage < 25) progressBg = 'bg-ac-red';
            else if (percentage < 60) progressBg = 'bg-ac-gold';

            // Find associated category to apply dynamic colors
            const cat = categories?.find(c => c.id === pocket.categoryId);
            const cardBgStyle = cat 
              ? { borderColor: cat.color, backgroundColor: cat.color + '12' }
              : {};
            const isDragging = draggablePocketId === pocket.id;

            return (
              <div 
                key={pocket.id} 
                draggable={isDragging}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`border-3 rounded-3xl p-5 shadow-ac-sm transition-all flex flex-col justify-between space-y-4 bg-white border-ac-brown ${
                  isDragging ? 'ring-3 ring-ac-green ring-offset-2 scale-[1.01] border-dashed opacity-75' : ''
                }`}
                style={cardBgStyle}
              >
                {/* Header info */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3">
                    {/* Draggable Icon handle */}
                    <div 
                      onMouseDown={() => handleStartLongPress(pocket.id)}
                      onTouchStart={() => handleStartLongPress(pocket.id)}
                      onMouseUp={handleCancelLongPress}
                      onTouchEnd={handleCancelLongPress}
                      onMouseLeave={handleCancelLongPress}
                      className="w-10 h-10 bg-white/80 rounded-full border border-ac-brown/15 flex items-center justify-center cursor-grab shrink-0 select-none shadow-ac-xs active:cursor-grabbing hover:bg-ac-cream transition-colors"
                      title="Glisser-déposer (clic long)"
                    >
                      <span className="text-lg">{cat?.emoji || '🍃'}</span>
                    </div>

                    <div>
                      <h4 className="font-black text-sm text-ac-brown flex items-center gap-1.5">
                        {pocket.name}
                        {cat && (
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full border border-ac-brown/10 uppercase" style={{ backgroundColor: cat.color + '25', color: cat.color }}>
                            {cat.name}
                          </span>
                        )}
                      </h4>
                      
                      {pocket.renewalFrequency && pocket.renewalFrequency !== 'none' && pocket.nextRenewalDate ? (
                        <span className="text-[9px] font-black text-ac-brown-light/75 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Renouvellement automatique le {new Date(pocket.nextRenewalDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ({
                            pocket.renewalFrequency === 'weekly' ? `hebdomadaire${pocket.renewalDay ? `, jour ${pocket.renewalDay}` : ''}` : `mensuel${pocket.renewalDay ? `, jour ${pocket.renewalDay}` : ''}`
                          })
                          {pocket.accumulate && <span className="text-[8px] text-ac-green font-black"> [Accumulée]</span>}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-ac-brown-light/50 block mt-0.5">
                          Pas de renouvellement automatique
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-1 shrink-0 items-center">
                    {/* Quick Debit Button */}
                    <button
                      onClick={() => openDebitModal(pocket)}
                      className="p-1.5 bg-ac-red/10 hover:bg-ac-red/20 rounded-xl text-ac-red border border-ac-red/20 cursor-pointer font-black text-xs h-7 w-7 flex items-center justify-center transition-all"
                      title="Déduire de l'argent de la poche"
                    >
                      -
                    </button>
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
                      {Math.round(current).toLocaleString('fr-FR')} 🔔
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

      {/* Mini Quick Debit Pop-in Modal */}
      {debitModalOpen && debitTargetPocket && (
        <div className="fixed inset-0 bg-ac-brown/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in text-ac-brown">
          <div className="bg-[#FFFDF9] border-t-4 border-x-4 md:border-4 border-ac-brown rounded-t-3xl md:rounded-3xl p-6 max-w-sm w-full shadow-ac-lg relative animate-slide-up md:animate-bounce-in pb-safe-bottom">
            <button 
              type="button"
              onClick={() => { setDebitModalOpen(false); setDebitTargetPocket(null); setDebitAmount(''); }}
              className="absolute top-4 right-4 bg-ac-cream hover:bg-ac-cream-dark border-2 border-ac-brown rounded-full p-1 transition-all text-ac-brown cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-sm font-black mb-4 flex items-center gap-1.5 border-b border-ac-brown/10 pb-2">
              <Coins className="w-4 h-4 text-ac-gold fill-ac-gold" /> Déduire de la poche : {debitTargetPocket.name}
            </h3>

            <form onSubmit={handleDebitSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Montant à déduire (🔔)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={debitAmount}
                    onChange={(e) => setDebitAmount(e.target.value)}
                    placeholder="Ex: 500"
                    className="w-full h-12 bg-ac-cream border-2 border-ac-brown rounded-2xl pl-7 pr-3 text-xs font-bold focus:outline-none focus:bg-white"
                    required
                  />
                  <span className="absolute left-2.5 top-3.5 text-xs font-black">🔔</span>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setDebitModalOpen(false); setDebitTargetPocket(null); setDebitAmount(''); }}
                  className="h-12 px-4 bg-white border-2 border-ac-brown text-ac-brown font-extrabold text-xs rounded-xl hover:bg-ac-cream cursor-pointer flex items-center justify-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isDebiting}
                  className={`h-12 px-5 bg-ac-red text-white font-extrabold text-xs rounded-xl border-2 border-ac-brown shadow-ac-sm flex items-center justify-center transition-all ${
                    isDebiting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:translate-y-[1px]'
                  }`}
                  style={isDebiting ? { cursor: 'not-allowed' } : {}}
                >
                  {isDebiting ? 'Déduction...' : 'Déduire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
