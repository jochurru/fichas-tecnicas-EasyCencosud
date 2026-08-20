/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        easy: {
          red: '#E30613',     // Rojo Easy Cencosud
          yellow: '#FFED00',  // Amarillo secundario
          dark: '#1F2937',    // Gris oscuro para fuentes y tarjetas
          light: '#F9FAFB'    // Fondo claro
        }
      }
    },
  },
  plugins: [],
}
