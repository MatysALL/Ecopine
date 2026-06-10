import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getEnvelopeStatus } from '../db';
import { Mail, Plus, Trash2, Edit2, Shield, HelpCircle, ArrowRight } from 'lucide-react';

export default function EnvelopeManager({ accountId }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState(null);
  const [name, setName] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [carryOver, setCarryOver] = useState(true);
  const [blockBalance, setBlockBalance] = useState(false);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // 1. Fetch envelopes for the account
  const envelopes = useLiveQuery(() => 
    db.envelopes.where('accountId').equals(Number(accountId)).toArray()
  , [accountId]);

  // 2. Fetch envelope status (spent, carryOver, limits) for current month
  const envelopeStatuses = useLiveQuery(async () => {
    if (!envelopes) return [];
    const statuses = await Promise.all(
      envelopes.map(async (env) => {
        const status = await getEnvelopeStatus(env, currentYear, currentMonth);
        return { ...env, ...status };
      })
    );
    return statuses;
  }, [envelopes, currentYear, currentMonth]);

  useEffect(() => {
    if (editingEnvelope) {
      setName(editingEnvelope.name);
      setMonthlyLimit(editingEnvelope.monthlyLimit.toString());
      setCarryOver(editingEnvelope.carryOver);
      setBlockBalance(editingEnvelope.blockBalance);
    } else {
      setName('');
      setMonthlyLimit('');
      setCarryOver(true);
      setBlockBalance(false);
    }
  }, [editingEnvelope]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !monthlyLimit) return;
    
    const limit = parseFloat(monthlyLimit);
    if (isNaN(limit) || limit <= 0) return;

    const envData = {
      accountId: Number(accountId),
      name,
      monthlyLimit: limit,
      carryOver,
      blockBalance
    };

    if (editingEnvelope) {
      await db.envelopes.update(editingEnvelope.id, envData);
      setEditingEnvelope(null);
    } else {
      await db.envelopes.add(envData);
    }

    setFormOpen(false);
    setName('');
    setMonthlyLimit('');
    setCarryOver(true);
    setBlockBalance(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Es-tu sûr de vouloir supprimer cette enveloppe ? Les transactions liées perdront leur catégorie d\'enveloppe.')) {
      await db.envelopes.delete(id);
    }
  };

  return (
    <div className="bg-ac-cream-light border-3 border-ac-brown rounded-3xl p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black text-ac-brown flex items-center gap-2">
            <Mail className="w-5 h-5 text-ac-green" /> Système d'Enveloppes Budgétaires
          </h3>
          <p className="text-xs font-semibold text-ac-brown-light mt-1">
            Isole des sommes mensuelles pour mieux contrôler tes dépenses.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingEnvelope(null);
            setFormOpen(!formOpen);
          }}
          className="bg-ac-green text-white font-extrabold text-xs px-3 py-2 rounded-full border-2 border-ac-brown shadow-ac-sm flex items-center gap-1 hover:translate-y-[1px] cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nouvelle Enveloppe
        </button>
      </div>

      {/* Form to Add/Edit Envelope */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="bg-white border-2 border-ac-brown rounded-2xl p-4 space-y-4 animate-bounce-in">
          <h4 className="font-extrabold text-sm text-ac-brown border-b border-ac-brown/15 pb-2">
            {editingEnvelope ? 'Modifier l\'enveloppe' : 'Créer une nouvelle enveloppe'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Nom de l'Enveloppe (ex: Courses) *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Courses, Loisirs, etc."
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold text-ac-brown focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1">Limite Mensuelle (Clochettes) *</label>
              <input
                type="number"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="100"
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold text-ac-brown focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 pt-2">
            {/* CarryOver toggle */}
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={carryOver}
                  onChange={(e) => setCarryOver(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-ac-cream-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ac-brown after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-ac-green border border-ac-brown"></div>
              </label>
              <div>
                <span className="text-xs font-black text-ac-brown block">Option Report de Solde</span>
                <span className="text-[10px] text-ac-brown-light block">Reporte l'argent non dépensé le mois prochain.</span>
              </div>
            </div>

            {/* BlockBalance toggle */}
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={blockBalance}
                  onChange={(e) => setBlockBalance(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-ac-cream-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ac-brown after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-ac-green border border-ac-brown"></div>
              </label>
              <div>
                <span className="text-xs font-black text-ac-brown block flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-ac-gold" /> Option Coffre-fort
                </span>
                <span className="text-[10px] text-ac-brown-light block">Soustrait cette enveloppe du solde de l'accueil.</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditingEnvelope(null);
                setFormOpen(false);
              }}
              className="bg-white text-ac-brown font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown hover:bg-ac-cream"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="bg-ac-green text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-ac-brown shadow-ac-sm active:translate-y-[1px]"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Envelopes list */}
      {!envelopeStatuses ? (
        <div className="text-center text-xs font-bold text-ac-brown-light">Recalcul des enveloppes...</div>
      ) : envelopeStatuses.length === 0 ? (
        <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-ac-brown/15 text-xs font-semibold text-ac-brown-light">
          Aucune enveloppe créée pour ce compte. Crée-en une pour automatiser ton épargne !
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {envelopeStatuses.map((env) => {
            const pct = env.limit > 0 ? Math.min(100, (env.spent / env.limit) * 100) : 0;
            return (
              <div 
                key={env.id} 
                className="bg-white border-2 border-ac-brown rounded-2xl p-4 shadow-ac-sm flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Visual indicator envelope decoration */}
                <div className="absolute top-0 right-0 w-8 h-8 bg-ac-cream border-l-2 border-b-2 border-ac-brown rounded-bl-xl flex items-center justify-center">
                  <span className="text-xs">✉️</span>
                </div>

                <div>
                  <div className="flex justify-between items-start pr-6">
                    <div>
                      <h4 className="font-extrabold text-sm text-ac-brown flex items-center gap-1.5">
                        {env.name}
                        {env.blockBalance && (
                          <span title="Coffre-fort (soustrait de l'accueil)">
                            <Shield className="w-3.5 h-3.5 text-ac-gold fill-ac-gold" />
                          </span>
                        )}
                      </h4>
                      <div className="flex flex-wrap gap-1 items-center mt-1">
                        {env.carryOver && (
                          <span className="text-[9px] font-bold bg-ac-green-light text-ac-green px-1.5 rounded border border-ac-green/20">
                            Report: +{env.carryOver.toFixed(0)} 🔔
                          </span>
                        )}
                        <span className="text-[9px] font-bold bg-ac-cream-dark/50 text-ac-brown-light px-1.5 rounded">
                          Base: {env.monthlyLimit} 🔔
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="w-full bg-ac-cream border border-ac-brown h-3 rounded-full overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct > 95 ? 'bg-ac-red' : pct > 75 ? 'bg-ac-gold' : 'bg-ac-green'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-ac-brown-light mt-1">
                      <span>Dépensé: {env.spent.toLocaleString('fr-FR')} 🔔</span>
                      <span>Reste: {env.remaining.toLocaleString('fr-FR')} 🔔</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-ac-brown/10 flex justify-end gap-2">
                  <button
                    onClick={() => setEditingEnvelope(env)}
                    className="p-1 hover:bg-ac-cream rounded border border-ac-brown/25 text-ac-brown-light hover:text-ac-brown"
                    title="Modifier"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(env.id)}
                    className="p-1 hover:bg-ac-red-light rounded border border-ac-brown/25 text-ac-brown-light hover:text-ac-red"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
