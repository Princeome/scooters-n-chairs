import _ from "lodash";

export class LocalStorage<T> {
  constructor(private readonly key: string, private readonly empty: () => T) {}

  set(value: T): void {
    window.localStorage.setItem(this.key, JSON.stringify(value));
  }

  get(): T {
    const value = window.localStorage.getItem(this.key);
    return value === null ? this.empty() : JSON.parse(value);
  }
}
