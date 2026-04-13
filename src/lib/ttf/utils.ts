import * as math from '../math';

// Remove points, that looks like straight line
export function simplify(contours: any[][], accuracy: number): any[][] {
  return contours.map(function (contour) {
    let i, curr, prev, next;
    let p, pPrev, pNext;

    // run from the end, to simplify array elements removal
    for (i = contour.length - 2; i > 1; i--) {
      prev = contour[i - 1];
      next = contour[i + 1];
      curr = contour[i];

      // skip point (both oncurve & offcurve),
      // if [prev,next] is straight line
      if (prev.onCurve && next.onCurve) {
        p = new math.Point(curr.x, curr.y);
        pPrev = new math.Point(prev.x, prev.y);
        pNext = new math.Point(next.x, next.y);
        if (math.isInLine(pPrev, p, pNext, accuracy)) {
          contour.splice(i, 1);
        }
      }
    }
    return contour;
  });
}

// Remove interpolateable oncurve points
// Those should be in the middle of nebor offcurve points
export function interpolate(contours: any[][], accuracy: number): any[][] {
  return contours.map(function (contour) {
    const resContour: any[] = [];

    contour.forEach(function (point, idx) {
      // Never skip first and last points
      if (idx === 0 || idx === contour.length - 1) {
        resContour.push(point);
        return;
      }

      const prev = contour[idx - 1];
      const next = contour[idx + 1];

      let p, pPrev, pNext;

      // skip interpolateable oncurve points (if exactly between previous and next offcurves)
      if (!prev.onCurve && point.onCurve && !next.onCurve) {
        p = new math.Point(point.x, point.y);
        pPrev = new math.Point(prev.x, prev.y);
        pNext = new math.Point(next.x, next.y);
        if (pPrev.add(pNext).div(2).sub(p).dist() < accuracy) {
          return;
        }
      }
      // keep the rest
      resContour.push(point);
    });
    return resContour;
  });
}

export function roundPoints(contours: any[][]): any[][] {
  return contours.map(function (contour) {
    return contour.map(function (point) {
      return { x: Math.round(point.x), y: Math.round(point.y), onCurve: point.onCurve };
    });
  });
}

// Remove closing point if it is the same as first point of contour.
// TTF doesn't need this point when drawing contours.
export function removeClosingReturnPoints(contours: any[][]): any[][] {
  return contours.map(function (contour) {
    const length = contour.length;

    if (
      length > 1 &&
      contour[0].x === contour[length - 1].x &&
      contour[0].y === contour[length - 1].y
    ) {
      contour.splice(length - 1);
    }
    return contour;
  });
}

export function toRelative(contours: any[][]): any[][] {
  let prevPoint = { x: 0, y: 0 };
  const resContours: any[][] = [];
  let resContour: any[];

  contours.forEach(function (contour) {
    resContour = [];
    resContours.push(resContour);
    contour.forEach(function (point) {
      resContour.push({
        x: point.x - prevPoint.x,
        y: point.y - prevPoint.y,
        onCurve: point.onCurve
      });
      prevPoint = point;
    });
  });
  return resContours;
}

export function identifier(string: string, littleEndian?: boolean): number {
  let result = 0;

  for (let i = 0; i < string.length; i++) {
    result = result << 8;
    const index = littleEndian ? string.length - i - 1 : i;

    result += string.charCodeAt(index);
  }

  return result;
}
