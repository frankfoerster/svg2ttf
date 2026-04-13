import cubic2quad from 'cubic2quad';
import svgpath from 'svgpath';
import { DOMParser } from '@xmldom/xmldom';
import * as ucs2 from './ucs2';

export function getGlyph(glyphElem: any, fontInfo: any) {
  const glyph: any = {};

  if (glyphElem.hasAttribute('d')) {
    glyph.d = glyphElem.getAttribute('d').trim();
  } else {
    // try nested <path>
    const pathElem = glyphElem.getElementsByTagName('path')[0];

    if (pathElem && pathElem.hasAttribute('d')) {
      // <path> has reversed Y axis
      glyph.d = svgpath(pathElem.getAttribute('d'))
        .scale(1, -1)
        .translate(0, fontInfo.ascent)
        .toString();
    } else {
      throw new Error("Can't find 'd' attribute of <glyph> tag.");
    }
  }

  glyph.unicode = [];

  if (glyphElem.getAttribute('unicode')) {
    glyph.character = glyphElem.getAttribute('unicode');
    const unicode = ucs2.decode(glyph.character);

    // If more than one code point is involved, the glyph is a ligature glyph
    if (unicode.length > 1) {
      glyph.ligature = glyph.character;
      glyph.ligatureCodes = unicode;
    } else {
      glyph.unicode.push(unicode[0]);
    }
  }

  glyph.name = glyphElem.getAttribute('glyph-name');

  if (glyphElem.getAttribute('horiz-adv-x')) {
    glyph.width = parseInt(glyphElem.getAttribute('horiz-adv-x'), 10);
  }

  return glyph;
}

export function deduplicateGlyps(glyphs: any[], ligatures: any[]) {
  // Result (the list of unique glyphs)
  const result: any[] = [];

  glyphs.forEach(function (glyph) {
    // Search for glyphs with the same properties (width and d)
    const canonical = result.find((r) => r.width === glyph.width && r.d === glyph.d);

    if (canonical) {
      // Add the code points to the unicode array.
      // The fields “name” and “character” are not that important so we leave them how we first enounter them and throw the rest away
      canonical.unicode = canonical.unicode.concat(glyph.unicode);
      glyph.canonical = canonical;
    } else {
      result.push(glyph);
    }
  });

  // Update ligatures to point to the canonical version
  ligatures.forEach(function (ligature) {
    while (ligature.glyph && ligature.glyph.canonical) {
      ligature.glyph = ligature.glyph.canonical;
    }
  });

  return result;
}

export function load(str: string) {
  let attrs: any;

  const doc = new DOMParser().parseFromString(str, 'application/xml');

  let metadata, fontElem, fontFaceElem;

  metadata = doc.getElementsByTagName('metadata')[0];
  fontElem = doc.getElementsByTagName('font')[0];

  if (!fontElem) {
    throw new Error("Can't find <font> tag. Make sure you SVG file is font, not image.");
  }

  fontFaceElem = fontElem.getElementsByTagName('font-face')[0];

  const familyName = fontFaceElem.getAttribute('font-family') || 'fontello';
  const subfamilyName = fontFaceElem.getAttribute('font-style') || 'Regular';
  const id =
    fontElem.getAttribute('id') ||
    // eslint-disable-next-line no-useless-escape
    (familyName + '-' + subfamilyName).replace(/[\s()\[\]<>%/]/g, '').substring(0, 62);

  const font: any = {
    id: id,
    familyName: familyName,
    subfamilyName: subfamilyName,
    stretch: fontFaceElem.getAttribute('font-stretch') || 'normal'
  };

  // Doesn't work with complex content like <strong>Copyright:></strong><em>Fontello</em>
  if (metadata && metadata.textContent) {
    font.metadata = metadata.textContent;
  }

  // Get <font> numeric attributes
  attrs = {
    width: 'horiz-adv-x',
    //height:       'vert-adv-y',
    horizOriginX: 'horiz-origin-x',
    horizOriginY: 'horiz-origin-y',
    vertOriginX: 'vert-origin-x',
    vertOriginY: 'vert-origin-y'
  };
  Object.entries(attrs).forEach(function ([key, val]) {
    if (fontElem.hasAttribute(val as string)) {
      font[key] = parseInt(fontElem.getAttribute(val as string)!, 10);
    }
  });

  // Get <font-face> numeric attributes
  attrs = {
    ascent: 'ascent',
    descent: 'descent',
    unitsPerEm: 'units-per-em',
    capHeight: 'cap-height',
    xHeight: 'x-height',
    underlineThickness: 'underline-thickness',
    underlinePosition: 'underline-position'
  };
  Object.entries(attrs).forEach(function ([key, val]) {
    if (fontFaceElem.hasAttribute(val as string)) {
      font[key] = parseInt(fontFaceElem.getAttribute(val as string)!, 10);
    }
  });

  if (fontFaceElem.hasAttribute('font-weight')) {
    font.weightClass = fontFaceElem.getAttribute('font-weight');
  }

  const missingGlyphElem = fontElem.getElementsByTagName('missing-glyph')[0];

  if (missingGlyphElem) {
    font.missingGlyph = {};
    font.missingGlyph.d = missingGlyphElem.getAttribute('d') || '';

    const horizAdvX = missingGlyphElem.getAttribute('horiz-adv-x');
    if (horizAdvX) {
      font.missingGlyph.width = parseInt(horizAdvX, 10);
    }
  }

  let glyphs: any[] = [];
  const ligatures: any[] = [];

  Array.from(fontElem.getElementsByTagName('glyph')).forEach(function (glyphElem: any) {
    const glyph = getGlyph(glyphElem, font);

    if (glyph.ligature) {
      ligatures.push({
        ligature: glyph.ligature,
        unicode: glyph.ligatureCodes,
        glyph: glyph
      });
    }

    glyphs.push(glyph);
  });

  glyphs = deduplicateGlyps(glyphs, ligatures);

  font.glyphs = glyphs;
  font.ligatures = ligatures;

  return font;
}

export function cubicToQuad(segment: any[], index: number, x: number, y: number, accuracy: number) {
  if (segment[0] === 'C') {
    const quadCurves = cubic2quad(
      x,
      y,
      segment[1],
      segment[2],
      segment[3],
      segment[4],
      segment[5],
      segment[6],
      accuracy
    );

    const res = [];

    for (let i = 2; i < quadCurves.length; i += 4) {
      res.push(['Q', quadCurves[i], quadCurves[i + 1], quadCurves[i + 2], quadCurves[i + 3]]);
    }
    return res;
  }
}

// Converts svg points to contours.  All points must be converted
// to relative ones, smooth curves must be converted to generic ones
// before this conversion.
//
export function toSfntCoutours(svgPath: any) {
  const resContours: any[] = [];
  let resContour: any[] = [];

  svgPath.iterate(function (segment: any[], index: number, x: number, y: number) {
    //start new contour
    if (index === 0 || segment[0] === 'M') {
      resContour = [];
      resContours.push(resContour);
    }

    const name = segment[0];

    if (name === 'Q') {
      //add control point of quad spline, it is not on curve
      resContour.push({ x: segment[1], y: segment[2], onCurve: false });
    }

    // add on-curve point
    if (name === 'H') {
      // vertical line has Y coordinate only, X remains the same
      resContour.push({ x: segment[1], y: y, onCurve: true });
    } else if (name === 'V') {
      // horizontal line has X coordinate only, Y remains the same
      resContour.push({ x: x, y: segment[1], onCurve: true });
    } else if (name !== 'Z') {
      // for all commands (except H and V) X and Y are placed in the end of the segment
      resContour.push({
        x: segment[segment.length - 2],
        y: segment[segment.length - 1],
        onCurve: true
      });
    }
  });
  return resContours;
}
