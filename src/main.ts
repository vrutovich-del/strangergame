import "./ui/styles.css";
// Временная точка входа каркаса: показывает загрузочный экран.
const tip = document.getElementById('boot-tip');
if (tip) tip.textContent = 'Каркас игры собран. Скоро тут будет бой!';
const fill = document.getElementById('boot-fill');
if (fill) fill.style.width = '100%';
