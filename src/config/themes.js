export const APP_THEMES = {
  default: {
    id: "default",
    name: "Éco & Finances",
    avatar: "/utilisateur.png",
    colors: {
      primary: "#86efac",     // Vert clair finances
      secondary: "#dcfce7",   // Vert pastel doux
      text: "#111827"         // Noir profond
    }
  },
  jour: {
    id: "jour",
    name: "Jour Pur",
    avatar: "/corbeau.png",
    colors: {
      primary: "#e2e8f0",     // Argenté clair
      secondary: "#f8fafc",   // Blanc pur
      text: "#0f172a"         // Noir ardoise
    }
  },
  nuit: {
    id: "nuit",
    name: "Nuit Profonde",
    avatar: "/chouette.png",
    colors: {
      primary: "#0f172a",     // Bleu nuit / presque noir
      secondary: "#1e293b",   // Bleu nuit sombre
      text: "#f8fafc"         // Blanc pur
    }
  },
  feu: {
    id: "feu",
    name: "Feu & Automne",
    avatar: "/renard.png",
    colors: {
      primary: "#ea580c",     // Rouge orangé feu
      secondary: "#ffedd5",   // Teinte chaude claire
      text: "#fef08a"         // Jaune clair lumineux (ou #ffffff si contraste insuffisant)
    }
  },
  neige: {
    id: "neige",
    name: "Toundra Enneigée",
    avatar: "/loup.png",
    colors: {
      primary: "#e0f2fe",     // Blanc bleuté glacé
      secondary: "#bae6fd",   // Bleu givre clair
      text: "#0c4a6e"         // Bleu toundra très foncé
    }
  },
  chat: {
    id: "chat",
    name: "Bêtises & Fun",
    avatar: "/chat.png",
    colors: {
      primary: "#f43f5e",     // Rose vif décalé
      secondary: "#a7f3d0",   // Vert menthe contrastant / espiègle
      text: "#18181b"         // Noir texturé
    }
  },
  panda: {
    id: "panda",
    name: "Néon Moderne",
    avatar: "/panda.png",
    colors: {
      primary: "#10b981",     // Vert émeraude moderne
      secondary: "#050505",   // Base sombre moderne
      text: "#00ff88"         // Vert néon éclatant
    }
  }
};

export const AVAILABLE_AVATARS = [
  { id: "utilisateur", name: "Habitant", src: "/utilisateur.png" },
  { id: "corbeau", name: "Corbeau", src: "/corbeau.png" },
  { id: "chouette", name: "Chouette", src: "/chouette.png" },
  { id: "renard", name: "Renard", src: "/renard.png" },
  { id: "loup", name: "Loup", src: "/loup.png" },
  { id: "chat", name: "Chat", src: "/chat.png" },
  { id: "panda", name: "Panda", src: "/panda.png" }
];

export const DEFAULT_THEME_ID = "default";
export const DEFAULT_AVATAR_SRC = "/utilisateur.png";
export const DEFAULT_AVATAR_ID = "utilisateur";
