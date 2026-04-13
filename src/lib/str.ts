export class Str {
  str: string;

  constructor(str: string) {
    this.str = str;
  }

  toUTF8Bytes(): number[] {
    const byteArray: number[] = [];

    for (let i = 0; i < this.str.length; i++) {
      if (this.str.charCodeAt(i) <= 0x7f) {
        byteArray.push(this.str.charCodeAt(i));
      } else {
        const h = encodeURIComponent(this.str.charAt(i)).substring(1).split('%');

        for (let j = 0; j < h.length; j++) {
          byteArray.push(parseInt(h[j], 16));
        }
      }
    }
    return byteArray;
  }

  toUCS2Bytes(): number[] {
    const byteArray: number[] = [];
    let ch: number;

    for (let i = 0; i < this.str.length; ++i) {
      ch = this.str.charCodeAt(i);
      byteArray.push(ch >> 8);
      byteArray.push(ch & 0xff);
    }
    return byteArray;
  }
}
