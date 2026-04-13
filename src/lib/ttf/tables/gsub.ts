import { identifier } from '../utils';
import ByteBuffer from 'microbuffer';

function createScript() {
  const scriptRecord =
    2 + // Script DefaultLangSys Offset
    2; // Script[0] LangSysCount (0)

  const langSys =
    2 + // Script DefaultLangSys LookupOrder
    2 + // Script DefaultLangSys ReqFeatureIndex
    2 + // Script DefaultLangSys FeatureCount (0?)
    2; // Script Optional Feature Index[0]

  const length = scriptRecord + langSys;

  const buffer = new ByteBuffer(length);

  // Script Record
  // Offset to the start of langSys from the start of scriptRecord
  buffer.writeUint16(scriptRecord); // DefaultLangSys

  // Number of LangSys entries other than the default (none)
  buffer.writeUint16(0);

  // LangSys record (DefaultLangSys)
  // LookupOrder
  buffer.writeUint16(0);
  // ReqFeatureIndex -> only one required feature: all ligatures
  buffer.writeUint16(0);
  // Number of FeatureIndex values for this language system (excludes the required feature)
  buffer.writeUint16(1);
  // FeatureIndex for the first optional feature
  buffer.writeUint16(0);

  return buffer;
}

function createScriptList() {
  const scriptSize =
    4 + // Tag
    2; // Offset

  // tags should be arranged alphabetically
  const scripts: [string, any][] = [
    ['DFLT', createScript()],
    ['latn', createScript()]
  ];

  const header =
    2 + // Script count
    scripts.length * scriptSize;

  const tableLengths = scripts
    .map(function (script) {
      return script[1].length;
    })
    .reduce(function (result: number, count: number) {
      return result + count;
    }, 0);

  const length = header + tableLengths;

  const buffer = new ByteBuffer(length);

  // Script count
  buffer.writeUint16(scripts.length);

  // Write all ScriptRecords
  let offset = header;

  scripts.forEach(function (script) {
    const name = script[0],
      table = script[1];

    // Script identifier (DFLT/latn)
    buffer.writeUint32(identifier(name));
    // Offset to the ScriptRecord from start of the script list
    buffer.writeUint16(offset);
    // Increment offset by script table length
    offset += table.length;
  });

  // Write all ScriptTables
  scripts.forEach(function (script) {
    const table = script[1];

    buffer.writeBytes(table.buffer);
  });

  return buffer;
}

// Write one feature containing all ligatures
function createFeatureList() {
  const header =
    2 + // FeatureCount
    4 + // FeatureTag[0]
    2; // Feature Offset[0]

  const length =
    header +
    2 + // FeatureParams[0]
    2 + // LookupCount[0]
    2; // Lookup[0] LookupListIndex[0]

  const buffer = new ByteBuffer(length);

  // FeatureCount
  buffer.writeUint16(1);
  // FeatureTag[0]
  buffer.writeUint32(identifier('liga'));
  // Feature Offset[0]
  buffer.writeUint16(header);
  // FeatureParams[0]
  buffer.writeUint16(0);
  // LookupCount[0]
  buffer.writeUint16(1);
  // Index into lookup table. Since we only have ligatures, the index is always 0
  buffer.writeUint16(0);

  return buffer;
}

function createLigatureCoverage(font: any, ligatureGroups: any[]) {
  const glyphCount = ligatureGroups.length;

  const length =
    2 + // CoverageFormat
    2 + // GlyphCount
    2 * glyphCount; // GlyphID[i]

  const buffer = new ByteBuffer(length);

  // CoverageFormat
  buffer.writeUint16(1);

  // Length
  buffer.writeUint16(glyphCount);

  ligatureGroups.forEach(function (group) {
    buffer.writeUint16(group.startGlyph.id);
  });

  return buffer;
}

function createLigatureTable(font: any, ligature: any) {
  const allCodePoints = font.codePoints;

  const unicode = ligature.unicode;

  const length =
    2 + // LigGlyph
    2 + // CompCount
    2 * (unicode.length - 1);

  const buffer = new ByteBuffer(length);

  // LigGlyph
  let glyph = ligature.glyph;

  buffer.writeUint16(glyph.id);

  // CompCount
  buffer.writeUint16(unicode.length);

  // Compound glyphs (excluding first as it’s already in the coverage table)
  for (let i = 1; i < unicode.length; i++) {
    glyph = allCodePoints[unicode[i]];
    buffer.writeUint16(glyph.id);
  }

  return buffer;
}

function createLigatureSet(font: any, codePoint: number, ligatures: any[]) {
  const ligatureTables: any[] = [];

  ligatures.forEach(function (ligature) {
    ligatureTables.push(createLigatureTable(font, ligature));
  });

  const tableLengths = ligatureTables
    .map((t) => t.length)
    .reduce(function (result: number, count: number) {
      return result + count;
    }, 0);

  let offset =
    2 + // LigatureCount
    2 * ligatures.length;

  const length = offset + tableLengths;

  const buffer = new ByteBuffer(length);

  // LigatureCount
  buffer.writeUint16(ligatures.length);

  // Ligature offsets
  ligatureTables.forEach(function (table) {
    // The offset to the current set, from SubstFormat
    buffer.writeUint16(offset);
    offset += table.length;
  });

  // Ligatures
  ligatureTables.forEach(function (table) {
    buffer.writeBytes(table.buffer);
  });

  return buffer;
}

function createLigatureList(font: any, ligatureGroups: any[]) {
  const sets: any[] = [];

  ligatureGroups.forEach(function (group) {
    const set = createLigatureSet(font, group.codePoint, group.ligatures);

    sets.push(set);
  });

  const setLengths = sets
    .map((s) => s.length)
    .reduce(function (result: number, count: number) {
      return result + count;
    }, 0);

  const coverage = createLigatureCoverage(font, ligatureGroups);

  const tableOffset =
    2 + // Lookup type
    2 + // Lokup flag
    2 + // SubTableCount
    2; // SubTable[0] Offset

  let setOffset =
    2 + // SubstFormat
    2 + // Coverage offset
    2 + // LigSetCount
    2 * sets.length; // LigSet Offsets

  const coverageOffset = setOffset + setLengths;

  const length = tableOffset + coverageOffset + coverage.length;

  const buffer = new ByteBuffer(length);

  // Lookup type 4 – ligatures
  buffer.writeUint16(4);

  // Lookup flag – empty
  buffer.writeUint16(0);

  // Subtable count
  buffer.writeUint16(1);

  // Subtable[0] offset
  buffer.writeUint16(tableOffset);

  // SubstFormat
  buffer.writeUint16(1);

  // Coverage
  buffer.writeUint16(coverageOffset);

  // LigSetCount
  buffer.writeUint16(sets.length);

  sets.forEach(function (set) {
    // The offset to the current set, from SubstFormat
    buffer.writeUint16(setOffset);
    setOffset += set.length;
  });

  sets.forEach(function (set) {
    buffer.writeBytes(set.buffer);
  });

  buffer.writeBytes(coverage.buffer);

  return buffer;
}

// Add a lookup for each ligature
function createLookupList(font: any) {
  const ligatures = font.ligatures;

  const groupedLigatures: any = {};

  // Group ligatures by first code point
  ligatures.forEach(function (ligature: any) {
    const first = ligature.unicode[0];

    if (!Object.prototype.hasOwnProperty.call(groupedLigatures, first)) {
      groupedLigatures[first] = [];
    }
    groupedLigatures[first].push(ligature);
  });

  const ligatureGroups: any[] = [];

  Object.entries(groupedLigatures).forEach(function ([codePointStr, ligs]: [string, any]) {
    const codePoint = parseInt(codePointStr, 10);
    // Order ligatures by length, descending
    // “Ligatures with more components must be stored ahead of those with fewer components in order to be found”
    // From: http://partners.adobe.com/public/developer/opentype/index_tag7.html#liga
    ligs.sort(function (ligA: any, ligB: any) {
      return ligB.unicode.length - ligA.unicode.length;
    });
    ligatureGroups.push({
      codePoint: codePoint,
      ligatures: ligs,
      startGlyph: font.codePoints[codePoint]
    });
  });

  ligatureGroups.sort(function (a, b) {
    return a.startGlyph.id - b.startGlyph.id;
  });

  const offset =
    2 + // Lookup count
    2; // Lookup[0] offset

  const set = createLigatureList(font, ligatureGroups);

  const length = offset + set.length;

  const buffer = new ByteBuffer(length);

  // Lookup count
  buffer.writeUint16(1);

  // Lookup[0] offset
  buffer.writeUint16(offset);

  // Lookup[0]
  buffer.writeBytes(set.buffer);

  return buffer;
}

export default function createGSUB(font: any) {
  const scriptList: any = createScriptList();
  const featureList: any = createFeatureList();
  const lookupList: any = createLookupList(font);

  const lists = [scriptList, featureList, lookupList];

  let offset =
    4 + // Version
    2 * lists.length; // List offsets

  // Calculate offsets
  lists.forEach(function (list: any) {
    list._listOffset = offset;
    offset += list.length;
  });

  const length = offset;
  const buffer = new ByteBuffer(length);

  // Version
  buffer.writeUint32(0x00010000);

  // Offsets
  lists.forEach(function (list: any) {
    buffer.writeUint16(list._listOffset);
  });

  // List contents
  lists.forEach(function (list: any) {
    buffer.writeBytes(list.buffer);
  });

  return buffer;
}
