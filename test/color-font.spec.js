import { describe, expect, it } from 'vitest';
import svg2ttf from '../src/index.ts';

const fixture = `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg">
<defs>
<font id="color-font" horiz-adv-x="1000">
<font-face font-family="color-font" units-per-em="1000" ascent="850" descent="-150" />
<missing-glyph horiz-adv-x="1000" />
<glyph glyph-name="base" unicode="&#xe001;" d="M0 0H100V100H0Z" />
<glyph glyph-name="layer-red" d="M0 0H50V50H0Z" />
<glyph glyph-name="layer-current" d="M50 50H100V100H50Z" />
<glyph glyph-name="base-two" unicode="&#xe002;" d="M100 100H200V200H100Z" />
</font>
</defs>
</svg>`;

const colorFont = {
  baseGlyphs: [
    {
      glyphName: 'base',
      layers: [
        { glyphName: 'layer-red', paletteIndex: 1 },
        { glyphName: 'layer-current', paletteIndex: 0xffff }
      ]
    }
  ],
  palettes: [
    [
      { red: 1, green: 2, blue: 3, alpha: 4 },
      { red: 10, green: 20, blue: 30, alpha: 40 }
    ],
    [
      { red: 101, green: 102, blue: 103, alpha: 104 },
      { red: 110, green: 120, blue: 130, alpha: 140 }
    ]
  ]
};

function getTable(ttf, tag) {
  const view = new DataView(ttf.buffer.buffer, ttf.buffer.byteOffset, ttf.buffer.byteLength);
  const tableCount = view.getUint16(4);

  for (let index = 0; index < tableCount; index++) {
    const recordOffset = 12 + index * 16;
    const recordTag = String.fromCharCode(
      view.getUint8(recordOffset),
      view.getUint8(recordOffset + 1),
      view.getUint8(recordOffset + 2),
      view.getUint8(recordOffset + 3)
    );

    if (recordTag === tag) {
      const offset = view.getUint32(recordOffset + 8);
      const length = view.getUint32(recordOffset + 12);
      return new DataView(ttf.buffer.buffer, ttf.buffer.byteOffset + offset, length);
    }
  }
}

function checksum(ttf) {
  const bytes = ttf.buffer;
  const paddedLength = bytes.length + ((4 - (bytes.length % 4)) % 4);
  let sum = 0;

  for (let offset = 0; offset < paddedLength; offset += 4) {
    const value =
      ((bytes[offset] || 0) << 24) |
      ((bytes[offset + 1] || 0) << 16) |
      ((bytes[offset + 2] || 0) << 8) |
      (bytes[offset + 3] || 0);
    sum = (sum + value) >>> 0;
  }

  return sum;
}

describe('color fonts', () => {
  it('does not emit color tables when color metadata is omitted', () => {
    const ttf = svg2ttf(fixture, { ts: 1457357570 });

    expect(getTable(ttf, 'COLR')).toBeUndefined();
    expect(getTable(ttf, 'CPAL')).toBeUndefined();
  });

  it('emits COLR v0 with resolved glyph IDs and ordered layers', () => {
    const ttf = svg2ttf(fixture, { colorFont, ts: 1457357570 });
    const colr = getTable(ttf, 'COLR');

    expect(colr.getUint16(0)).toBe(0);
    expect(colr.getUint16(2)).toBe(1);
    expect(colr.getUint32(4)).toBe(14);
    expect(colr.getUint32(8)).toBe(20);
    expect(colr.getUint16(12)).toBe(2);
    expect(Array.from({ length: 3 }, (_, index) => colr.getUint16(14 + index * 2))).toEqual([
      1, 0, 2
    ]);
    expect(Array.from({ length: 4 }, (_, index) => colr.getUint16(20 + index * 2))).toEqual([
      2, 1, 3, 0xffff
    ]);
  });

  it('sorts COLR base records by resolved glyph ID', () => {
    const secondBase = {
      glyphName: 'base-two',
      layers: [{ glyphName: 'layer-current', paletteIndex: 0 }]
    };
    const ttf = svg2ttf(fixture, {
      colorFont: { ...colorFont, baseGlyphs: [secondBase, colorFont.baseGlyphs[0]] },
      ts: 1457357570
    });
    const colr = getTable(ttf, 'COLR');

    expect(colr.getUint16(2)).toBe(2);
    expect([colr.getUint16(14), colr.getUint16(20)]).toEqual([1, 4]);
    expect([colr.getUint16(16), colr.getUint16(22)]).toEqual([0, 2]);
    expect([colr.getUint16(18), colr.getUint16(24)]).toEqual([2, 1]);
  });

  it('emits CPAL v0 with multiple palettes and BGRA color records', () => {
    const ttf = svg2ttf(fixture, { colorFont, ts: 1457357570 });
    const cpal = getTable(ttf, 'CPAL');

    expect(cpal.getUint16(0)).toBe(0);
    expect(cpal.getUint16(2)).toBe(2);
    expect(cpal.getUint16(4)).toBe(2);
    expect(cpal.getUint16(6)).toBe(4);
    expect(cpal.getUint32(8)).toBe(16);
    expect([cpal.getUint16(12), cpal.getUint16(14)]).toEqual([0, 2]);
    expect(
      Array.from({ length: 16 }, (_, index) => cpal.getUint8(16 + index))
    ).toEqual([3, 2, 1, 4, 30, 20, 10, 40, 103, 102, 101, 104, 130, 120, 110, 140]);
  });

  it('keeps the complete TTF checksum valid', () => {
    expect(checksum(svg2ttf(fixture, { colorFont, ts: 1457357570 }))).toBe(0xb1b0afba);
  });
});

describe('color font validation', () => {
  it('rejects unknown glyph names', () => {
    expect(() =>
      svg2ttf(fixture, {
        colorFont: {
          ...colorFont,
          baseGlyphs: [{ glyphName: 'unknown', layers: colorFont.baseGlyphs[0].layers }]
        }
      })
    ).toThrow(/unknown glyph name "unknown"/);
  });

  it('rejects ambiguous duplicate glyph names', () => {
    const duplicateFixture = fixture.replace(
      '</font>',
      '<glyph glyph-name="layer-red" d="M200 200H250V250H200Z" /></font>'
    );

    expect(() => svg2ttf(duplicateFixture, { colorFont })).toThrow(
      /glyph name "layer-red" matches multiple generated glyphs/
    );
  });

  it('rejects duplicate base records', () => {
    expect(() =>
      svg2ttf(fixture, {
        colorFont: { ...colorFont, baseGlyphs: [colorFont.baseGlyphs[0], colorFont.baseGlyphs[0]] }
      })
    ).toThrow(/duplicate base glyph "base"/);
  });

  it.each([
    [[], /at least one palette/],
    [[[]], /at least one color/],
    [[colorFont.palettes[0], [colorFont.palettes[1][0]]], /same number of colors/]
  ])('rejects invalid palette dimensions', (palettes, message) => {
    expect(() => svg2ttf(fixture, { colorFont: { ...colorFont, palettes } })).toThrow(message);
  });

  it.each([-1, 256, 1.5, Number.NaN])('rejects invalid RGBA channel values', (red) => {
    const palettes = [[{ red, green: 0, blue: 0, alpha: 255 }]];

    expect(() => svg2ttf(fixture, { colorFont: { ...colorFont, palettes } })).toThrow(
      /red channel.*integer from 0 to 255/
    );
  });

  it.each([-1, 2, 1.5, 0x10000])('rejects invalid palette indices', (paletteIndex) => {
    const baseGlyphs = [
      {
        glyphName: 'base',
        layers: [{ glyphName: 'layer-red', paletteIndex }]
      }
    ];

    expect(() => svg2ttf(fixture, { colorFont: { ...colorFont, baseGlyphs } })).toThrow(
      /palette index.*0xFFFF/
    );
  });

  it('rejects color data that exceeds uint16 limits', () => {
    const layers = Array.from({ length: 0x10000 }, () => ({
      glyphName: 'layer-red',
      paletteIndex: 0
    }));

    expect(() =>
      svg2ttf(fixture, {
        colorFont: {
          baseGlyphs: [{ glyphName: 'base', layers }],
          palettes: [[{ red: 0, green: 0, blue: 0, alpha: 255 }]]
        }
      })
    ).toThrow(/layer records.*uint16/);
  });
});
