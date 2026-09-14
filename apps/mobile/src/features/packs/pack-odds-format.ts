export function formatBaseRarityPercentage(percentage: number, locale: string) {
  const formatter = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  });

  if (percentage > 0 && percentage < 0.01) {
    return `<${formatter.format(0.0001)}`;
  }

  if (percentage < 100 && percentage > 99.99) {
    return `>${formatter.format(0.9999)}`;
  }

  return formatter.format(percentage / 100);
}
