import React, { useState } from 'react';
import { useDb } from '../db';
import { Leaf, Mail, Lock, User, Sparkles, AlertCircle } from 'lucide-react';

export default function AuthView() {
  const { signUpUser, logInUser } = useDb();
  const [isRegister, setIsRegister] = useState(false);
  
  // Form fields
  const [firstname, setFirstname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Status states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError("Veuillez remplir tous les champs obligatoires.");
      setLoading(false);
      return;
    }

    if (isRegister && !firstname.trim()) {
      setError("Veuillez renseigner votre prénom.");
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
        await signUpUser(email.trim(), password, firstname.trim());
      } else {
        await logInUser(email.trim(), password);
      }
    } catch (err) {
      console.error(err);
      // Translate firebase errors to French
      switch (err.code) {
        case 'auth/invalid-email':
          setError("Adresse e-mail invalide.");
          break;
        case 'auth/user-disabled':
          setError("Ce compte a été désactivé.");
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError("Identifiants incorrects. Veuillez réessayer.");
          break;
        case 'auth/email-already-in-use':
          setError("Cette adresse e-mail est déjà utilisée par un autre habitant !");
          break;
        case 'auth/weak-password':
          setError("Le mot de passe doit contenir au moins 6 caractères.");
          break;
        default:
          setError("Une erreur inattendue est survenue : " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-ac-cream p-4 text-ac-brown select-none ac-dotted-bg">
      <div className="bg-[#FFFDF9] border-4 border-ac-brown rounded-3xl max-w-md w-full p-8 shadow-ac-lg relative overflow-hidden flex flex-col items-center space-y-6">
        
        {/* Decorative corner patterns */}
        <div className="absolute top-0 right-0 w-12 h-12 bg-ac-green/10 rounded-bl-3xl border-l-2 border-b-2 border-ac-brown/10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 bg-ac-gold/10 rounded-tr-3xl border-r-2 border-t-2 border-ac-brown/10 pointer-events-none"></div>

        {/* Title Leaf Logo */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-16 h-16 bg-ac-green rounded-full flex items-center justify-center border-3 border-ac-brown shadow-ac-sm animate-bounce-in cursor-pointer hover:rotate-12 transition-transform duration-200">
            <Leaf className="w-10 h-10 text-white fill-white" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-ac-brown">Ecopine</h2>
          <span className="text-[10px] font-black text-ac-brown-light bg-ac-cream px-3 py-0.5 rounded-full border border-ac-brown/20 uppercase">
            Version 0.2.0 Cloud
          </span>
        </div>

        {/* Welcome message bubble */}
        <div className="bg-ac-gold-light border-3 border-ac-brown rounded-2xl p-4 shadow-ac-sm relative w-full text-center">
          <p className="text-xs font-bold leading-relaxed text-ac-brown-light">
            {isRegister 
              ? `"Bonjour, oui oui ! Crée ton passeport budgétaire pour commencer à synchroniser tes clochettes sur ton île !"`
              : `"Ravi de te revoir sur ton île budgétaire ! Connecte-toi pour retrouver tes comptes et budgets en direct !"`}
          </p>
          <div className="w-3.5 h-3.5 bg-ac-gold-light border-b-3 border-r-3 border-ac-brown absolute bottom-[-9.5px] left-1/2 transform -translate-x-1/2 rotate-45 hidden md:block"></div>
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full bg-ac-red-light border-2 border-ac-red rounded-2xl p-3 text-xs font-bold text-ac-red flex items-center gap-2 animate-bounce-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {isRegister && (
            <div>
              <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-ac-green" /> Quel est ton prénom ?
              </label>
              <input
                type="text"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                placeholder="Ex: Matys"
                className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
                required={isRegister}
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-ac-sky" /> Adresse e-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="habitant@nookisland.com"
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-ac-brown-light mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-ac-gold" /> Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-ac-cream border-2 border-ac-brown rounded-2xl px-4 py-2.5 text-sm font-bold text-ac-brown focus:outline-none focus:bg-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ac-green text-white font-extrabold text-sm py-3.5 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-transform disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Leaf className="w-4 h-4 text-white fill-white" />
                {isRegister ? "S'inscrire sur l'île" : "Ouvrir ma tente"}
              </>
            )}
          </button>
        </form>

        {/* Toggle Form type link */}
        <div className="pt-2 border-t border-ac-brown/10 w-full text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-xs font-black text-ac-brown-light hover:text-ac-green transition-colors cursor-pointer"
          >
            {isRegister 
              ? "Tu as déjà une tente ? Connecte-toi ici !"
              : "Nouveau sur l'île ? Inscris-toi ici !"}
          </button>
        </div>

      </div>
    </div>
  );
}
