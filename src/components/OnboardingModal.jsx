import React, { useState } from 'react';
import { db } from '../db';
import { Leaf, Sparkles, User, Coins, Home } from 'lucide-react';

export default function OnboardingModal({ onComplete }) {
  const [username, setUsername] = useState('');
  const [accountName, setAccountName] = useState('Poche');
  const [initialBalance, setInitialBalance] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Veuillez entrer votre prénom.');
      return;
    }
    if (!accountName.trim()) {
      alert('Veuillez entrer le nom de votre premier compte.');
      return;
    }
    const balance = parseFloat(initialBalance);
    if (isNaN(balance) || balance < 0) {
      alert('Veuillez entrer un solde initial valide (supérieur ou égal à 0).');
      return;
    }

    try {
      // 1. Add user metadata
      await db.user_meta.add({ key: 'username', value: username.trim() });
      
      // 2. Add first current account
      await db.accounts.add({
        name: accountName.trim(),
        type: 'Courant',
        initialBalance: balance,
        rate: 0
      });

      // 3. Callback to app
      onComplete(username.trim());
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de votre profil.");
    }
  };

  return (
    <div className="fixed inset-0 bg-ac-brown/65 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl max-w-lg w-full p-8 shadow-ac-lg relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
        {/* Decorative corner patterns */}
        <div className="absolute top-0 right-0 w-12 h-12 bg-ac-green/10 rounded-bl-3xl border-l-2 border-b-2 border-ac-brown/10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 bg-ac-gold/10 rounded-tr-3xl border-r-2 border-t-2 border-ac-brown/10 pointer-events-none"></div>

        {/* Nook Icon Column */}
        <div className="flex flex-col items-center shrink-0">
          <div className="w-20 h-20 bg-ac-gold rounded-full flex items-center justify-center border-4 border-ac-brown shadow-ac-sm animate-pulse mb-3">
            <span className="text-4xl">🦝</span>
          </div>
          <span className="text-xs font-black text-white bg-ac-brown px-3 py-1 rounded-full border border-ac-brown shadow-ac-sm">
            Tom Nook
          </span>
        </div>

        {/* Dialog & Form Content */}
        <div className="flex-1 space-y-4 w-full">
          {/* Dialog Bubble */}
          <div className="bg-ac-gold-light border-3 border-ac-brown rounded-2xl p-4 shadow-ac-sm relative mb-4">
            <h3 className="font-black text-sm text-ac-brown mb-1 flex items-center gap-1.5">
              Bonjour, nouvel habitant ! <Sparkles className="w-4 h-4 text-ac-gold fill-ac-gold" />
            </h3>
            <p className="text-xs font-bold leading-relaxed text-ac-brown-light">
              "Oui, oui ! Bienvenue sur ton île budgétaire. Commençons par configurer ton carnet de clochettes pour que tu puisses suivre tes économies."
            </p>
            {/* Dialogue Bubble Left Arrow */}
            <div className="w-3.5 h-3.5 bg-ac-gold-light border-l-3 border-t-3 border-ac-brown absolute left-[-8.5px] top-10 transform -translate-y-1/2 -rotate-45 hidden md:block"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Prénom (username) */}
            <div>
              <label className="block text-xs font-black uppercase text-ac-brown-light mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-ac-green" /> Comment t'appelles-tu ?
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ton prénom (ex: Matys)"
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                required
              />
            </div>

            {/* First Account Details */}
            <div className="bg-ac-cream-dark/20 border-2 border-ac-brown/60 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-black uppercase text-ac-brown-light block border-b border-ac-brown/10 pb-1.5">
                Configuration de ton 1er Compte Courant
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1 flex items-center gap-1">
                    <Home className="w-3 h-3 text-ac-gold" /> Nom du compte
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Poche"
                    className="w-full bg-white border border-ac-brown rounded-xl px-3 py-1.5 text-xs font-bold text-ac-brown focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1 flex items-center gap-1">
                    <Coins className="w-3 h-3 text-ac-gold" /> Solde Initial
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-ac-brown rounded-xl pl-6 pr-2 py-1.5 text-xs font-bold text-ac-brown focus:outline-none"
                      required
                    />
                    <span className="absolute left-2 top-2 text-[10px]">🔔</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-ac-green text-white font-extrabold text-sm py-3.5 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-transform"
            >
              <Leaf className="w-4 h-4 text-white fill-white" /> Installer ma tente budgétaire !
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
