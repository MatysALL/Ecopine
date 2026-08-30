import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

function getGitVersion() {
  try {
    // Récupère le message du commit (compatible Vercel et local)
    const commitMsg = process.env.VERCEL_GIT_COMMIT_MESSAGE || execSync('git log -1 --pretty=%B').toString().trim();
    const match = commitMsg.match(/v\d+\.\d+(\.\d+)?/i);
    return match ? match[0].toUpperCase() : 'V1.0.0';
  } catch (error) {
    return 'V1.0.0';
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(getGitVersion()),
  },
})
