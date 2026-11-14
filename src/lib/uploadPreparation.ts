/** Bound file reads and hashing so large selections cannot exhaust browser memory. */
export async function prepareUploadFiles<T, R>(
  items: T[],
  prepare: (item: T) => Promise<R>,
  onPrepared?: (result: R, completed: number) => Promise<void> | void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let completed = 0;
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          prepare(items[index]),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Dateiprüfung hat zu lange gedauert. Bitte die betroffene Datei prüfen und erneut auswählen.')), 60_000);
          }),
        ]);
        results[index] = result;
        completed += 1;
        await onPrepared?.(result, completed);
      } finally {
        clearTimeout(timer);
      }
    }
  }));
  return results;
}