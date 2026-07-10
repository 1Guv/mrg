export function normalisePlate(plate: string): string {
  return plate.replace(/\s/g, '').toUpperCase();
}
