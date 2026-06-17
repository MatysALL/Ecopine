import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary a attrapé une erreur :", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleWipeDatabase = () => {
    if (window.confirm("Cela effacera tes préférences locales et rechargera l'application. Continuer ?")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  handleCopyError = () => {
    const errorDetails = `Error: ${this.state.error?.message}\n\nStack:\n${this.state.error?.stack}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorDetails)
      .then(() => alert("Détails de l'erreur copiés dans le presse-papiers !"))
      .catch(() => alert("Impossible de copier l'erreur."));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-ac-cream p-4 text-ac-brown select-none font-sans">
          <div className="bg-white border-4 border-ac-brown rounded-3xl p-8 max-w-xl w-full shadow-ac-lg text-center space-y-6 animate-bounce-in">
            <div className="text-5xl animate-bounce">🛠️</div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black">Méli-Mélo a rencontré un problème !</h2>
              <p className="text-xs font-semibold text-ac-brown-light leading-relaxed">
                Une erreur inattendue est survenue dans l'affichage ou le calcul. Ne t'inquiète pas, tes données d'épargne ne sont pas perdues !
              </p>
            </div>

            {this.state.error && (
              <div className="bg-ac-red-light/30 border border-ac-red/20 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-bold text-ac-red font-mono break-words">
                  {this.state.error.toString()}
                </p>
                {this.state.error.stack && (
                  <pre className="text-[9px] font-mono text-ac-brown-light max-h-32 overflow-y-auto whitespace-pre-wrap leading-tight border-t border-ac-brown/10 pt-2">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={this.handleReload}
                className="bg-ac-green text-white font-extrabold text-xs py-3 px-4 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-0.5 active:shadow-none hover:bg-ac-green-dark cursor-pointer transition-all"
              >
                Recharger l'application
              </button>
              
              <button
                onClick={this.handleCopyError}
                className="bg-ac-gold text-white font-extrabold text-xs py-3 px-4 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-0.5 active:shadow-none hover:bg-ac-gold-dark cursor-pointer transition-all"
              >
                Copier l'erreur
              </button>

              <button
                onClick={this.handleWipeDatabase}
                className="bg-ac-red text-white font-extrabold text-xs py-3 px-4 rounded-2xl border-3 border-ac-brown shadow-ac-sm active:translate-y-0.5 active:shadow-none hover:bg-ac-red/80 cursor-pointer transition-all"
              >
                Réinitialiser la base
              </button>
            </div>

            <p className="text-[10px] text-ac-brown-light font-bold">
              💡 Si l'erreur persiste après rechargement, la base de données locale est peut-être corrompue. Tu peux la réinitialiser.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
