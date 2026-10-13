import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentTracker, contains, convexHull, distanceToRect, facingSide, inPolygon, isRect, safeCorridor } from '../dist/core/index.js';

const source = { left: 0, top: 0, right: 100, bottom: 40 };
const target = { left: 150, top: -40, right: 300, bottom: 240 };
const origin = { x: 50, y: 20 };
const next = (tracker, point, time, overrides = {}) => tracker.sample({ point, source, target, time, ...overrides });
const prime = options => { const tracker = new IntentTracker(options); next(tracker, origin, 0); return tracker; };
const rotate = (p, n) => n === 0 ? p : rotate({ x: -p.y, y: p.x }, n - 1);
const rotateRect = (r, n) => {
  const points = [{ x: r.left, y: r.top }, { x: r.right, y: r.bottom }].map(p => rotate(p, n));
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
};

for (const [turns, side] of ['right', 'bottom', 'left', 'top'].entries()) {
  const s = rotateRect(source, turns), t = rotateRect(target, turns);
  test(`${side}: a diagonal crossing stays with the original panel`, () => {
    const tracker = new IntentTracker();
    const step = (point, time) => tracker.sample({ point: rotate(point, turns), source: s, target: t, time });
    assert.equal(step(origin, 0).reason, 'source');
    for (const [index, point] of [{ x: 70, y: 45 }, { x: 95, y: 70 }, { x: 115, y: 100 }, { x: 140, y: 130 }].entries()) {
      assert.equal(step(point, 30 * (index + 1)).reason, 'corridor');
    }
    assert.equal(step({ x: 170, y: 150 }, 200).reason, 'target');
  });
  test(`${side}: moving straight into a sibling releases immediately`, () => {
    const tracker = new IntentTracker();
    tracker.sample({ point: rotate(origin, turns), source: s, target: t, time: 0 });
    assert.equal(tracker.sample({ point: rotate({ x: 50, y: 80 }, turns), source: s, target: t, time: 20 }).hold, false);
  });
  test(`${side}: a return crossing works without a separate configuration`, () => {
    const tracker = new IntentTracker();
    for (const [index, point] of [{ x: 160, y: 150 }, { x: 140, y: 120 }, { x: 120, y: 90 }, { x: 100, y: 60 }, { x: 90, y: 35 }].entries()) {
      const result = tracker.sample({ point: rotate(point, turns), source: s, target: t, time: index * 25 });
      assert.equal(result.hold, true, `${side} step ${index}: ${result.reason}`);
    }
  });
  test(`${side}: floating-point edges belong to the corridor`, () => {
    const polygon = safeCorridor(rotate(origin, turns), t, 0);
    for (const point of polygon) assert.equal(inPolygon(point, polygon), true);
    assert.equal(inPolygon(rotate({ x: 100, y: 70.5 }, turns), polygon), true);
  });
}

test('source and target never expire while actually hovered', () => {
  const tracker = prime({ maxTransitMs: 1, restMs: 1 });
  assert.equal(next(tracker, origin, 1e6).reason, 'source');
  assert.equal(next(tracker, { x: 160, y: 10 }, 2e6).reason, 'target');
});
test('a stationary corridor expires at restMs', () => {
  const tracker = prime({ restMs: 100 });
  assert.equal(next(tracker, { x: 110, y: 70 }, 10).reason, 'corridor');
  assert.equal(next(tracker, { x: 110, y: 70 }, 109).hold, true);
  assert.equal(next(tracker, { x: 110, y: 70 }, 110).reason, 'rest');
  assert.equal(next(tracker, { x: 130, y: 70 }, 120).hold, false);
});
test('meaningful progress extends rest, but not the hard transit limit', () => {
  const tracker = prime({ restMs: 150, maxTransitMs: 300 });
  assert.equal(next(tracker, { x: 105, y: 70 }, 10).hold, true);
  assert.equal(next(tracker, { x: 110, y: 70 }, 100).hold, true);
  assert.equal(next(tracker, { x: 115, y: 70 }, 200).hold, true);
  assert.equal(next(tracker, { x: 120, y: 70 }, 300).hold, true);
  assert.equal(next(tracker, { x: 125, y: 70 }, 310).reason, 'timeout');
});
test('small jitter is tolerated without renewing the progress clock', () => {
  const tracker = prime({ restMs: 100, retreatTolerance: 4 });
  next(tracker, { x: 110, y: 70 }, 10);
  assert.equal(next(tracker, { x: 107, y: 70 }, 30).hold, true);
  assert.equal(next(tracker, { x: 110, y: 70 }, 110).reason, 'rest');
});
test('a deliberate retreat releases even while inside the polygon', () => {
  const tracker = prime({ retreatTolerance: 5 });
  next(tracker, { x: 130, y: 70 }, 10);
  assert.equal(next(tracker, { x: 115, y: 70 }, 20).reason, 'retreat');
});
test('source re-entry re-arms a released corridor', () => {
  const tracker = prime();
  next(tracker, { x: 30, y: 100 }, 10);
  assert.equal(next(tracker, { x: 110, y: 70 }, 20).hold, false);
  next(tracker, origin, 30);
  assert.equal(next(tracker, { x: 110, y: 70 }, 40).hold, true);
});
test('an unprimed tracker cannot invent pointer intent', () => {
  assert.equal(next(new IntentTracker(), { x: 110, y: 70 }, 0).reason, 'unprimed');
});
test('reset discards all previous intent', () => {
  const tracker = prime(); tracker.reset();
  assert.equal(next(tracker, { x: 110, y: 70 }, 0).hold, false);
});
test('a layout change is not counted as a pointer retreat', () => {
  const tracker = prime();
  next(tracker, { x: 110, y: 70 }, 10);
  const moved = { ...target, left: 200, right: 350 };
  assert.equal(next(tracker, { x: 111, y: 70 }, 20, { target: moved }).hold, true);
});
test('a moved target recomputes the polygon rather than trusting the old one', () => {
  const tracker = prime();
  next(tracker, { x: 110, y: 70 }, 10);
  const moved = { left: -300, right: -150, top: -40, bottom: 240 };
  assert.equal(next(tracker, { x: 120, y: 70 }, 20, { target: moved }).hold, false);
});
for (const [name, value] of [['NaN', NaN], ['infinity', Infinity], ['negative infinity', -Infinity]]) {
  test(`invalid point (${name}) releases and clears the tracker`, () => {
    const tracker = prime();
    assert.equal(next(tracker, { x: value, y: 0 }, 20).reason, 'invalid');
    assert.equal(next(tracker, { x: 110, y: 70 }, 21).reason, 'unprimed');
  });
}
for (const [name, rect] of Object.entries({ zero: { left: 0, top: 0, right: 0, bottom: 1 },
  inverted: { left: 10, top: 0, right: 0, bottom: 1 }, nan: { ...target, bottom: NaN } })) {
  test(`invalid ${name} rectangle is never protected`, () => {
    assert.equal(isRect(rect), false);
    assert.equal(next(prime(), { x: 110, y: 70 }, 20, { target: rect }).reason, 'invalid');
  });
}
test('a backwards clock invalidates stale intent', () => {
  const tracker = prime(); next(tracker, { x: 110, y: 70 }, 100);
  assert.equal(next(tracker, { x: 115, y: 70 }, 99).reason, 'invalid');
});
for (const [key, bad] of [['buffer', -1], ['buffer', Infinity], ['buffer', 129], ['restMs', 0],
  ['restMs', NaN], ['maxTransitMs', -1], ['retreatTolerance', 257]]) {
  test(`reject invalid option ${key}=${bad}`, () => assert.throws(() => new IntentTracker({ [key]: bad }), RangeError));
}
test('the deadline uses the caller clock, not Date.now()', () => {
  const tracker = prime({ restMs: 100 });
  assert.equal(next(tracker, { x: 110, y: 70 }, 10).deadline, 110);
});
test('rectangles include exact boundaries and subpixels', () => {
  assert.equal(contains(source, { x: 100, y: 40 }), true);
  assert.equal(contains(source, { x: 100.1, y: 40 }), false);
  assert.equal(contains(source, { x: 100.1, y: 40 }, 0.2), true);
});
test('distance is zero inside, axis distance beside, Euclidean at a corner', () => {
  assert.equal(distanceToRect(origin, source), 0);
  assert.equal(distanceToRect({ x: 110, y: 20 }, source), 10);
  assert.equal(distanceToRect({ x: 103, y: 44 }, source), 5);
});
test('hull removes repeated and collinear interior points', () => {
  const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 0 }, { x: 0, y: 0 }];
  assert.equal(convexHull(points).length, 4);
});
test('polygon membership supports both windings', () => {
  const p = safeCorridor(origin, target);
  assert.equal(inPolygon({ x: 110, y: 70 }, p), true);
  assert.equal(inPolygon({ x: 110, y: 70 }, [...p].reverse()), true);
});
test('empty, line and invalid polygons contain nothing', () => {
  for (const p of [[], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], [{ x: NaN, y: 0 }, origin, { x: 0, y: 0 }]]) {
    assert.equal(inPolygon(origin, p), false);
  }
});
test('invalid corridor inputs return an empty polygon', () => {
  assert.deepEqual(safeCorridor(origin, target, -1), []);
  assert.deepEqual(safeCorridor({ x: NaN, y: 0 }, target), []);
  assert.deepEqual(convexHull([{ x: NaN, y: 0 }]), []);
});
test('placement reports the actual side for all four rotations', () => {
  for (const [index, side] of ['right', 'bottom', 'left', 'top'].entries()) {
    const t = { left: 150, top: -20, right: 250, bottom: 80 };
    assert.equal(facingSide(rotateRect(source, index), rotateRect(t, index)), side);
  }
});
test('20,000 seeded hull invariants: endpoints and every linear crossing stay inside', () => {
  let seed = 0x51A7;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let i = 0; i < 20000; i++) {
    const a = { x: random() * 2000 - 1000, y: random() * 2000 - 1000 };
    const r = { left: random() * 2000 - 1000, top: random() * 2000 - 1000 };
    r.right = r.left + 1 + random() * 400; r.bottom = r.top + 1 + random() * 400;
    const b = { x: r.left + random() * (r.right - r.left), y: r.top + random() * (r.bottom - r.top) };
    const t = random();
    const hull = safeCorridor(a, r);
    assert.equal(inPolygon(a, hull), true, `origin ${i}`);
    assert.equal(inPolygon(b, hull), true, `destination ${i}`);
    assert.equal(inPolygon({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, hull), true, `crossing ${i}`);
  }
});

// Timer starvation is common in background tabs and embedded UI runtimes.
test('progress after a missed rest deadline cannot revive a corridor', () => {
  const tracker = prime({ restMs: 100 });
  next(tracker, { x: 110, y: 70 }, 10);
  assert.equal(next(tracker, { x: 125, y: 70 }, 120).reason, 'rest');
});
test('actual endpoint entry after a missed deadline still wins', () => {
  const tracker = prime({ restMs: 100 });
  next(tracker, { x: 110, y: 70 }, 10);
  assert.equal(next(tracker, { x: 180, y: 70 }, 1200).reason, 'target');
});
