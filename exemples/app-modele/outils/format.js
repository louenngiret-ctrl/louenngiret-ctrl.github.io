// Un module importé par app.js : les imports entre fichiers de l'app fonctionnent comme sur un vrai site.
export const formater = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
