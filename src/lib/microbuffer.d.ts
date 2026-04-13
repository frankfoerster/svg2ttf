declare module 'microbuffer' {
  class MicroBuffer {
    constructor(
      buffer: number | Uint8Array | number[] | MicroBuffer,
      start?: number,
      length?: number
    );

    buffer: Uint8Array | number[];
    start: number;
    length: number;
    offset: number;
    isTyped: boolean;

    getUint8(pos: number): number;
    getUint16(pos: number, littleEndian?: boolean): number;
    getUint32(pos: number, littleEndian?: boolean): number;

    setUint8(pos: number, value: number): void;
    setUint16(pos: number, value: number, littleEndian?: boolean): void;
    setUint32(pos: number, value: number, littleEndian?: boolean): void;

    writeUint8(value: number): void;
    writeInt8(value: number): void;
    writeUint16(value: number, littleEndian?: boolean): void;
    writeInt16(value: number, littleEndian?: boolean): void;
    writeUint32(value: number, littleEndian?: boolean): void;
    writeInt32(value: number, littleEndian?: boolean): void;
    writeUint64(value: number): void;
    writeBytes(data: Uint8Array | number[]): void;

    tell(): number;
    seek(pos: number): void;
    fill(value: number): void;

    toString(offset?: number, length?: number): string;
    toArray(): Uint8Array | number[];
  }

  export = MicroBuffer;
}
