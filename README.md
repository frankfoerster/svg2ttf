# svg2ttf

[![Tests](https://github.com/frankfoerster/svg2ttf/actions/workflows/test.yml/badge.svg)](https://github.com/frankfoerster/svg2ttf/actions/workflows/test.yml)
[![NPM version](https://img.shields.io/npm/v/@frankfoerster/svg2ttf.svg?style=flat)](https://www.npmjs.com/package/@frankfoerster/svg2ttf)

> Converts SVG fonts to TTF format. It was initially written for
> [Fontello](http://fontello.com), but you can find it useful for your projects.

**For developers:**

Internal API is similar to FontForge's one. Since primary goal
is generating iconic fonts, sources can lack some specific TTF/OTF features,
like kerning and so on. Anyway, current code is a good base for development,
because it will save you tons of hours to implement correct writing & optimizing
TTF tables.

## Using from CLI

Install:

```bash
npm install -g @frankfoerster/svg2ttf
```

Usage example:

```bash
svg2ttf fontello.svg fontello.ttf
```

## API

### svg2ttf(svgFontString, options) -> buf

- `svgFontString` - SVG font content
- `options`
  - `copyright` - copyright string (optional)
  - `description` - description string (optional)
  - `ts` - Unix timestamp (in seconds) to override creation time (optional)
  - `url` - manufacturer url (optional)
  - `version` - font version string, can be `Version x.y` or `x.y`.
- `buf` - internal [byte buffer](https://github.com/fontello/microbuffer)
  object, similar to DataView. It's `buffer` property is `Uin8Array` or `Array`
  with ttf content.

Example:

```javascript
import fs from 'node:fs';
import svg2ttf from '@frankfoerster/svg2ttf';

const ttf = svg2ttf(fs.readFileSync('myfont.svg', 'utf8'), {});
fs.writeFileSync('myfont.ttf', new Buffer(ttf.buffer));
```

### Color fonts

The optional `colorFont` setting creates OpenType `COLR` version 0 and `CPAL` version 0 tables.
The SVG font must already contain every base and layer glyph referenced by name:

```javascript
const ttf = svg2ttf(svgFont, {
  colorFont: {
    baseGlyphs: [
      {
        glyphName: 'weather',
        layers: [
          { glyphName: 'weather-sun', paletteIndex: 0 },
          { glyphName: 'weather-cloud', paletteIndex: 1 },
          { glyphName: 'weather-outline', paletteIndex: 0xffff }
        ]
      }
    ],
    palettes: [
      [
        { red: 255, green: 204, blue: 0, alpha: 255 },
        { red: 210, green: 220, blue: 230, alpha: 255 }
      ],
      [
        { red: 255, green: 128, blue: 0, alpha: 255 },
        { red: 80, green: 90, blue: 100, alpha: 255 }
      ]
    ]
  }
});
```

All palettes must be non-empty and contain the same number of RGBA entries. Each channel is an
integer from 0 to 255. Layer palette indices select an entry in every palette; `0xFFFF` uses the
foreground color (`currentColor`) instead.

`svg2ttf` resolves existing glyph names to their final IDs, validates the manifest, and writes the
color tables. It does not parse source icon artwork or split paths into layers; upstream SVG tooling
is responsible for preparing the base and layer glyph geometry.

## svg2ttf for enterprise

Available as part of the Tidelift Subscription.

The maintainers of `svg2ttf` and thousands of other packages are working with Tidelift to deliver commercial support and maintenance for the open source dependencies you use to build your applications. Save time, reduce risk, and improve code health, while paying the maintainers of the exact dependencies you use. [Learn more.](https://tidelift.com/subscription/pkg/npm-svg2ttf?utm_source=npm-svg2ttf&utm_medium=referral&utm_campaign=enterprise&utm_term=repo)
