const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('src/features/schedules/home-place-model.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context);
const { homePlaceFocus } = context.exports;
const schedule = {
  experience_phase: 'today',
  places: [
    { id: 3, name: '서점', sortOrder: 2, visited: false, latitude: '37.5', longitude: '127' },
    { id: 1, name: '카페', sortOrder: 0, visited: true, latitude: '37.5', longitude: '127' },
    { id: 2, name: '좌표 없는 산책 장소', sortOrder: 1, visited: false, latitude: null, longitude: null },
  ],
};
const focus = homePlaceFocus(schedule);
assert.equal(focus.place.id, 2, '좌표가 없어도 사용자 순서의 다음 장소를 표시한다');
assert.equal(focus.ordinal, 2);
assert.equal(focus.visitedCount, 1);
assert.deepEqual(Array.from(focus.places, place => place.id), [1, 2, 3]);
assert.deepEqual(schedule.places.map(place => place.id), [3, 1, 2], '원본 캐시 배열을 변경하지 않는다');
assert.equal(homePlaceFocus(schedule, 1).label, '선택한 장소');
assert.equal(homePlaceFocus(schedule, 1).place.id, 1, '방문한 마커도 선택할 수 있다');
assert.equal(homePlaceFocus(schedule, 999).place.id, 2, '삭제되거나 다른 일정의 선택은 다음 장소로 복구한다');
const done = homePlaceFocus({ ...schedule, places: schedule.places.map(place => ({ ...place, visited: true })) });
assert.equal(done.label, '모든 장소 방문 완료');
assert.equal(done.place.id, 3, '모두 방문한 뒤 첫 장소를 다시 제안하지 않는다');
for (const phase of ['recorded', 'record_pending', 'canceled']) {
  assert.notEqual(homePlaceFocus({ ...schedule, experience_phase: phase }).label, '다음 장소');
}
const empty = homePlaceFocus({ ...schedule, places: [] });
assert.equal(empty.place, undefined);
assert.equal(empty.ordinal, 0);
assert.equal(empty.visitedCount, 0);
console.log('Home place order, progress, selection recovery and empty/completed-state checks passed.');
