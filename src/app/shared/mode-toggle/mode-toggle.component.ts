import { Component, input, output } from '@angular/core';

export type HomeMode = 'valuations' | 'plates';

interface ModeOption {
  value: HomeMode;
  label: string;
}

/**
 * Two-segment slider for switching the homepage between the valuation tools
 * and a preview of plates for sale. Presentational only — the parent owns
 * the mode and decides what each one renders.
 */
@Component({
  selector: 'app-mode-toggle',
  standalone: true,
  templateUrl: './mode-toggle.component.html',
  styleUrl: './mode-toggle.component.scss',
})
export class ModeToggleComponent {
  readonly mode = input.required<HomeMode>();
  readonly modeChange = output<HomeMode>();

  readonly options: ModeOption[] = [
    { value: 'valuations', label: 'Valuations' },
    { value: 'plates', label: 'Plates for Sale' },
  ];

  select(mode: HomeMode): void {
    if (mode === this.mode()) return;
    this.modeChange.emit(mode);
  }

  /** Left/right arrows move between segments, as for a native radiogroup. */
  onKeydown(event: KeyboardEvent): void {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;

    event.preventDefault();
    const index = this.options.findIndex(o => o.value === this.mode());
    const next = (index + (forward ? 1 : -1) + this.options.length)
      % this.options.length;
    this.select(this.options[next].value);
  }
}
