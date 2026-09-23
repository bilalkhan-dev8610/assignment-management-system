/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b2a41', // deep exercise-book blue: text, buttons, side panel
        paper: '#f2f4f8', // cool off-white page background
        line: '#d3d9e3', // input and divider borders
        margin: '#d64545', // the red margin rule of a school notebook
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        serif: ['"IBM Plex Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
