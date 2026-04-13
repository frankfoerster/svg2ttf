import ByteBuffer from 'microbuffer';
import { Str } from '../../str';

const TTF_NAMES = {
  COPYRIGHT: 0,
  FONT_FAMILY: 1,
  ID: 3,
  DESCRIPTION: 10,
  URL_VENDOR: 11
};

function tableSize(names: any[]) {
  let result = 6; // table header

  names.forEach(function (name) {
    result += 12 + name.data.length; //name header and data
  });
  return result;
}

function getStrings(name: string, id: number) {
  const result = [];
  const str = new Str(name);

  result.push({ data: str.toUTF8Bytes(), id: id, platformID: 1, encodingID: 0, languageID: 0 }); //mac standard
  result.push({ data: str.toUCS2Bytes(), id: id, platformID: 3, encodingID: 1, languageID: 0x409 }); //windows standard
  return result;
}

// Collect font names
function getNames(font: any) {
  const result: any[] = [];

  if (font.copyright) {
    result.push(...getStrings(font.copyright, TTF_NAMES.COPYRIGHT));
  }
  if (font.familyName) {
    result.push(...getStrings(font.familyName, TTF_NAMES.FONT_FAMILY));
  }
  if (font.id) {
    result.push(...getStrings(font.id, TTF_NAMES.ID));
  }
  result.push(...getStrings(font.description, TTF_NAMES.DESCRIPTION));
  result.push(...getStrings(font.url, TTF_NAMES.URL_VENDOR));

  font.sfntNames.forEach(function (sfntName: any) {
    result.push(...getStrings(sfntName.value, sfntName.id));
  });

  result.sort(function (a, b) {
    const orderFields: (keyof typeof a)[] = ['platformID', 'encodingID', 'languageID', 'id'];
    let i;

    for (i = 0; i < orderFields.length; i++) {
      if (a[orderFields[i]] !== b[orderFields[i]]) {
        return a[orderFields[i]] < b[orderFields[i]] ? -1 : 1;
      }
    }
    return 0;
  });

  return result;
}

export default function createNameTable(font: any) {
  const names = getNames(font);

  const buf = new ByteBuffer(tableSize(names));

  buf.writeUint16(0); // formatSelector
  buf.writeUint16(names.length); // nameRecordsCount
  const offsetPosition = buf.tell();

  buf.writeUint16(0); // offset, will be filled later
  let nameOffset = 0;

  names.forEach(function (name) {
    buf.writeUint16(name.platformID); // platformID
    buf.writeUint16(name.encodingID); // platEncID
    buf.writeUint16(name.languageID); // languageID, English (USA)
    buf.writeUint16(name.id); // nameID
    buf.writeUint16(name.data.length); // reclength
    buf.writeUint16(nameOffset); // offset
    nameOffset += name.data.length;
  });
  const actualStringDataOffset = buf.tell();

  //Array of bytes with actual string data
  names.forEach(function (name) {
    buf.writeBytes(name.data);
  });

  //write actual string data offset
  buf.seek(offsetPosition);
  buf.writeUint16(actualStringDataOffset); // offset

  return buf;
}
