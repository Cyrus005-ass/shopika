/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palette officielle extraite du logo Shopika
        night: '#10142D',      // Bleu nuit très foncé — texte "shop"
        pink: '#FF2E73',       // Rose vif — roues, "i", début dégradé
        orange: '#FF7A1A',     // Orange — dégradé panier / "k"
        gold: '#FFB71B',       // Jaune doré — haut du panier / "a"
        redorange: '#FF5A36',  // Orange-rouge — milieu dégradé
        paper: '#FFFFFF',      // Blanc — fond du logo
        shadow: '#222222'      // Gris très foncé — ombres légères
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #FF2E73 0%, #FF5A36 45%, #FFB71B 100%)'
      },
      fontFamily: {
        display: ['"Poppins"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif']
      }
    }
  },
  plugins: []
}
