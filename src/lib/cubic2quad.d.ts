declare module 'cubic2quad' {
  function cubic2quad(
    p1x: number,
    p1y: number,
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    p2x: number,
    p2y: number,
    errorBound: number
  ): number[];

  export = cubic2quad;
}
