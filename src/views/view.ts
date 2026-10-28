export interface View {
  canExpand?: boolean;
  /** en pantallas pequeñas la vista prefiere no abrir la ficha sola (el usuario la abre con un botón) */
  noAutoPanel?: () => boolean;
  mount(root: HTMLElement): Promise<void> | void;
  unmount(): void;
  /** la ficha seleccionada cambió (null = ninguna) */
  focus(i: number | null): void;
}
