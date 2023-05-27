export function unwrap<T>(value?: T | null): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected a value, but got ${value}`);
  }

  return value;
}

export function safeParseInt(str: string): number {
  const n = Number.parseInt(str);
  if (Number.isNaN(n)) {
    throw new Error(`Expected a valid integer, but got ${str}`);
  }
  return n;
}

export function safeParseFloat(str: string): number {
  const n = Number.parseFloat(str);
  if (Number.isNaN(n)) {
    throw new Error(`Expected a valid float, but got ${str}`);
  }
  return n;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function arrayOr<T>(
  first: readonly T[] | undefined,
  alternative: readonly T[]
): readonly T[] {
  return first !== undefined && first.length > 0 ? first : alternative;
}

export function dbg<T>(value: T): T {
  console.log("Debug", JSON.stringify(value, undefined, 2));
  return value;
}
