// Точка входа «Игры странностей».
import './ui/styles.css';
import './ui/menu.css';
import { App } from './ui/app';
import { installPwa } from './ui/pwa';

const app = new App();
(window as any).__app = app;
app.boot().catch((e) => {
  console.error(e);
  const tip = document.getElementById('boot-tip');
  if (tip) tip.textContent = 'Ой! Что-то сломалось при загрузке. Обнови страницу.';
});
installPwa();
