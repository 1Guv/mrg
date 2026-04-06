# List Now from Valuation Results — Design

**Goal:** Add a "List Now" button to both valuation results pages that navigates to `/list-plate` with the plate and valuation pre-filled.

**Architecture:** The button passes data via query parameters (`?plate=AB12CDE&price=1200&min=900&max=1500`). `ListPlateComponent` reads these on init and pre-fills the form, showing min/max as a hint under the asking price field.

**Tech Stack:** Angular Router query params, `ActivatedRoute`, existing `ListPlateComponent` reactive form.

---

## Button Placement

The "List Now" button appears in **three positions** in both `reg-plate-valuation-results` and `current-plate-valuation`:

1. Above `<app-share-buttons>`
2. Below the min/max plate card (in `reg-plate-valuation-results` this is the same location as above — share buttons immediately follow the min/max card)
3. After the Start Over button

## Data Passed as Query Params

| Param | Source (reg-plate-valuation-results) | Source (current-plate-valuation) |
|-------|--------------------------------------|----------------------------------|
| `plate` | `currentPlate` | `registration` |
| `price` | `totalPoints * multiplier` (mid-point) | `totalPrice` |
| `min` | `minPrice` | `minPrice` |
| `max` | `maxPrice` | `maxPrice` |

All values are rounded to 2 decimal places before passing.

## ListPlateComponent Changes

**On init**, read query params:
```
plate → pre-fill plateCharacters (uppercase)
price → pre-fill askingPrice
min, max → stored as component properties for hint display only
```

**Hint UI** — shown below the asking price field only when `min` and `max` params are present:
> *Valuation range: £900.00 – £1,500.00. You can adjust the price above.*

The user can freely edit the asking price; the hint is informational only.

## Files Modified

- `src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.html` — add 3 buttons
- `src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.ts` — add `Router` inject and `listNow()` method
- `src/app/core/current-plate-valuation/current-plate-valuation.component.html` — add 3 buttons
- `src/app/core/current-plate-valuation/current-plate-valuation.component.ts` — add `Router` inject and `listNow()` method
- `src/app/core/list-plate/list-plate.component.ts` — read query params on init, store min/max
- `src/app/core/list-plate/list-plate.component.html` — show valuation range hint

## Button Style

Green raised Material button, consistent with the "Plates for sale" button already on the valuation page:
```html
<button mat-raised-button type="button" class="list-now-btn" (click)="listNow()">
  List Now
</button>
```
```scss
.list-now-btn {
  margin: 0.5rem;
  background-color: #2e7d32;
  color: white;
}
```
