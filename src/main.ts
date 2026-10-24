// Точка входа «Игры странностей».
// Шрифты лежат в сборке (OFL): Shantell Sans — заголовки и кнопки, Nunito — цифры и мелкий текст. Полная кириллица.
import '@fontsource/shantell-sans/800.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/styles.css';
import './ui/menu.css';
import { App } from './ui/app';
import { installPwa } from './ui/pwa';
import { crashScreen } from './ui/screens/system';

const app = new App();
(window as any).__app = app;
app.boot().catch((e) => {
  console.error(e);
  crashScreen();
});
installPwa();
