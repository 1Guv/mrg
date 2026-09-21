import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModeToggleComponent, HomeMode } from './mode-toggle.component';

describe('ModeToggleComponent', () => {
  let fixture: ComponentFixture<ModeToggleComponent>;
  let component: ModeToggleComponent;

  const options = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[role="radio"]'));

  const setMode = (mode: HomeMode) => {
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModeToggleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModeToggleComponent);
    component = fixture.componentInstance;
    setMode('valuations');
  });

  it('renders both options with their labels', () => {
    const labels = options().map(o => o.textContent?.trim());
    expect(labels).toEqual(['Valuations', 'Plates for Sale']);
  });

  it('marks the active option via aria-checked', () => {
    expect(options().map(o => o.getAttribute('aria-checked')))
      .toEqual(['true', 'false']);

    setMode('plates');
    expect(options().map(o => o.getAttribute('aria-checked')))
      .toEqual(['false', 'true']);
  });

  it('emits modeChange when the inactive option is clicked', () => {
    const emitted: HomeMode[] = [];
    component.modeChange.subscribe(m => emitted.push(m));

    options()[1].click();
    expect(emitted).toEqual(['plates']);
  });

  it('does not re-emit when the active option is clicked', () => {
    const emitted: HomeMode[] = [];
    component.modeChange.subscribe(m => emitted.push(m));

    options()[0].click();
    expect(emitted).toEqual([]);
  });

  it('moves selection with arrow keys', () => {
    const emitted: HomeMode[] = [];
    component.modeChange.subscribe(m => emitted.push(m));

    const group: HTMLElement =
      fixture.nativeElement.querySelector('[role="radiogroup"]');
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(emitted).toEqual(['plates']);

    setMode('plates');
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(emitted).toEqual(['plates', 'valuations']);
  });

  it('exposes the group as a labelled radiogroup', () => {
    const group: HTMLElement =
      fixture.nativeElement.querySelector('[role="radiogroup"]');
    expect(group).toBeTruthy();
    expect(group.getAttribute('aria-label')).toBeTruthy();
  });
});
