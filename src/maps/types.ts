export type ModeId = 'gemgrab' | 'showdown' | 'knockout' | 'training';
export type MapTheme = 'grass' | 'sand';

export interface MapDef {
  id: string;
  mode: ModeId;
  name: string;
  theme: MapTheme;
  ascii: string;
}
