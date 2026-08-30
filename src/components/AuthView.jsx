/* global __APP_VERSION__ */
import React, { useState } from 'react';
import { useDb } from '../db';
import { Leaf, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

export default function AuthView() {
  const { signUpUser, logInUser, loginWithGoogle } = useDb();
  const [isRegister, setIsRegister] = useState(false);
  
  // Form fields
  const [firstname, setFirstname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Status states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAdblockWarning, setGoogleAdblockWarning] = useState(false);
  const [successToast, setSuccessToast] = useState(() => {
    const msg = sessionStorage.getItem('auth_toast') || localStorage.getItem('auth_toast');
    if (msg) {
      sessionStorage.removeItem('auth_toast');
      localStorage.removeItem('auth_toast');
      return msg;
    }
    return '';
  });

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

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleAdblockWarning(false);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error("Google login error:", err);
      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/network-request-failed' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        setGoogleAdblockWarning(true);
        setError("⚠️ Connexion Google bloquée par votre navigateur/bloqueur. Désactivez le bouclier ou connectez-vous par e-mail.");
      } else {
        switch (err?.code) {
          case 'auth/unauthorized-domain':
            setError("Ce domaine n'est pas autorisé pour l'authentification Google dans la console Firebase.");
            break;
          case 'auth/account-exists-with-different-credential':
            setError("Un compte existe déjà avec cette adresse e-mail via une autre méthode de connexion.");
            break;
          default:
            setError("Échec de la connexion avec Google : " + (err?.message || "Erreur inconnue"));
        }
      }
    } finally {
      setGoogleLoading(false);
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
            VERSION {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__.replace(/^V/i, '') : '1.0.0'} CLOUD
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

        {/* Success toast notification */}
        {successToast && (
          <div className="w-full bg-ac-green-light border-2 border-ac-green rounded-2xl p-3 text-xs font-bold text-ac-green flex items-center gap-2 animate-bounce-in">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-ac-green" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="w-full bg-ac-red-light border-2 border-ac-red rounded-2xl p-3 text-xs font-bold text-ac-red flex items-center gap-2 animate-bounce-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
          className="w-full bg-[#FFFDF9] hover:bg-amber-50/60 active:bg-amber-100/60 text-[#5C3A41] font-extrabold text-sm py-3.5 px-4 rounded-2xl border-2 border-[#5C3A41] shadow-ac-sm active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-3 cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none"
        >
          {googleLoading ? (
            <span className="w-4 h-4 border-2 border-[#5C3A41] border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Se connecter avec Google</span>
            </>
          )}
        </button>

        {googleAdblockWarning && (
          <p className="text-xs font-bold text-amber-900 bg-amber-100/90 border-2 border-amber-300 rounded-xl p-3 text-center w-full leading-snug animate-bounce-in">
            ⚠️ Connexion Google bloquée par votre navigateur/bloqueur. Désactivez le bouclier ou connectez-vous par e-mail.
          </p>
        )}

        {/* Divider */}
        <div className="relative w-full flex items-center justify-center">
          <div className="border-t border-ac-brown/20 w-full"></div>
          <span className="bg-[#FFFDF9] px-3 text-[10px] font-black text-ac-brown-light uppercase tracking-wider absolute">
            ou
          </span>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4 pt-1">
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
            disabled={loading || googleLoading}
            className="w-full bg-ac-green text-white font-extrabold text-sm py-3.5 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
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

