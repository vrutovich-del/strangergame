// Текущее сохранение + подписка интерфейса на изменения.
import { loadSave, writeSave, type SaveData } from './save';

type Fn = () => void;
const listeners = new Set<Fn>();

export const store = {
  data: loadSave() as SaveData,
  /** Сохранить на устройство и обновить интерфейс. */
  commit() {
    writeSave(this.data);
    listeners.forEach((f) => f());
  },
  replace(d: SaveData) {
    this.data = d;
    this.commit();
  },
  subscribe(f: Fn) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
};
