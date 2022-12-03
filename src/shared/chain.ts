export class Chain<T> {
  constructor(public readonly value: T) {}

  map<X, A extends unknown[]>(
    mapper: (value: T, ...parameters: A) => X,
    ...parameters: A
  ): Chain<X> {
    return new Chain(mapper(this.value, ...parameters));
  }

  tap(effect: (value: T) => void): Chain<T> {
    effect(this.value);
    return this;
  }
}

