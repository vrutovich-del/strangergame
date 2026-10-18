// Простой издатель событий.
type Fn<T> = (v: T) => void;
export class Emitter<M extends Record<string, any>> {
  private map = new Map<keyof M, Set<Fn<any>>>();
  on<K extends keyof M>(k: K, fn: Fn<M[K]>) {
    if (!this.map.has(k)) this.map.set(k, new Set());
    this.map.get(k)!.add(fn);
    return () => this.off(k, fn);
  }
  off<K extends keyof M>(k: K, fn: Fn<M[K]>) { this.map.get(k)?.delete(fn); }
  emit<K extends keyof M>(k: K, v: M[K]) { this.map.get(k)?.forEach((f) => f(v)); }
}
