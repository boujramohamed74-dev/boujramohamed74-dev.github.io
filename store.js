/* منطق البيانات: بدون أي اعتماد على الواجهة، ويمكن اختباره في Node */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Store = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'mahami.v1';

  var PRIORITIES = [
    { id: 'red', name: 'عاجل', fill: '#EE9A88', acc: '#B5473A' },
    { id: 'orange', name: 'مهم', fill: '#F2B66D', acc: '#A8631A' },
    { id: 'blue', name: 'عادي', fill: '#A5BFD9', acc: '#43688F' },
    { id: 'slate', name: 'مؤجل', fill: '#D3C9BC', acc: '#6F6355' }
  ];

  function priority(id) {
    for (var i = 0; i < PRIORITIES.length; i++) if (PRIORITIES[i].id === id) return PRIORITIES[i];
    return PRIORITIES[2];
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function str(x, max) { return typeof x === 'string' ? x.slice(0, max || 200) : ''; }
  function clamp(n, a, b) { n = Math.round(Number(n)); if (!isFinite(n)) n = a; return Math.min(b, Math.max(a, n)); }
  function isoOk(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function idOk(s) { return typeof s === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(s); }

  /* أول تشغيل: لا مهام إطلاقاً */
  function emptyData() { return { v: 1, tasks: [], settings: { strike: true } }; }

  function cleanSub(x) {
    if (!x || typeof x !== 'object') return null;
    var type = x.type === 'pct' ? 'pct' : 'steps';
    var steps = [];
    if (type === 'steps' && Array.isArray(x.steps)) {
      x.steps.forEach(function (s) {
        if (s && typeof s === 'object' && str(s.t, 80).trim()) steps.push({ t: str(s.t, 80), done: !!s.done });
      });
    }
    return {
      id: idOk(x.id) ? x.id : uid(),
      title: str(x.title, 60),
      type: type,
      pct: type === 'pct' ? clamp(x.pct, 0, 100) : 0,
      steps: steps
    };
  }

  function cleanTask(x) {
    if (!x || typeof x !== 'object') return null;
    var color = priority(x.color).id;
    var subs = [];
    if (Array.isArray(x.subs)) x.subs.forEach(function (s) { var c = cleanSub(s); if (c) subs.push(c); });
    return {
      id: idOk(x.id) ? x.id : uid(),
      title: str(x.title, 60),
      color: color,
      due: isoOk(x.due) ? x.due : '',
      remind: !!x.remind && isoOk(x.due),
      subs: subs
    };
  }

  function clean(d) {
    var out = emptyData();
    if (!d || typeof d !== 'object') return out;
    if (Array.isArray(d.tasks)) d.tasks.forEach(function (t) { var c = cleanTask(t); if (c) out.tasks.push(c); });
    if (d.settings && typeof d.settings === 'object') out.settings.strike = d.settings.strike !== false;
    return out;
  }

  function load(storage) {
    try {
      var raw = storage && storage.getItem(KEY);
      if (!raw) return emptyData();
      return clean(JSON.parse(raw));
    } catch (e) {
      return emptyData();
    }
  }

  function save(storage, data) {
    try { storage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }

  /* ---------- البحث ---------- */
  function findTask(data, id) {
    for (var i = 0; i < data.tasks.length; i++) if (data.tasks[i].id === id) return data.tasks[i];
    return null;
  }
  function findSub(data, taskId, subId) {
    var t = findTask(data, taskId);
    if (!t) return null;
    for (var i = 0; i < t.subs.length; i++) if (t.subs[i].id === subId) return t.subs[i];
    return null;
  }

  /* ---------- المهام ---------- */
  function addTask(data, f) {
    var title = (f.title || '').trim();
    if (!title) return null;
    var t = cleanTask({ id: uid(), title: title, color: f.color, due: f.due, remind: f.remind, subs: [] });
    data.tasks.push(t);
    return t;
  }
  function updateTask(data, id, f) {
    var t = findTask(data, id);
    if (!t) return null;
    var title = (f.title === undefined ? t.title : f.title).trim();
    if (!title) return null;
    t.title = str(title, 60);
    if (f.color !== undefined) t.color = priority(f.color).id;
    if (f.due !== undefined) t.due = isoOk(f.due) ? f.due : '';
    if (f.remind !== undefined) t.remind = !!f.remind;
    if (!t.due) t.remind = false;
    return t;
  }
  function deleteTask(data, id) {
    var n = data.tasks.length;
    data.tasks = data.tasks.filter(function (t) { return t.id !== id; });
    return data.tasks.length !== n;
  }

  /* ---------- المهام الفرعية (نسبة أو مربعات، وليس كلاهما) ---------- */
  function addSub(data, taskId, f) {
    var t = findTask(data, taskId);
    var title = (f.title || '').trim();
    if (!t || !title) return null;
    if (f.type !== 'pct' && f.type !== 'steps') return null;
    var s = cleanSub({ id: uid(), title: title, type: f.type, pct: 0, steps: [] });
    t.subs.push(s);
    return s;
  }
  function updateSub(data, taskId, subId, f) {
    var s = findSub(data, taskId, subId);
    var title = (f.title || '').trim();
    if (!s || !title) return null;
    s.title = str(title, 60);
    return s;
  }
  function deleteSub(data, taskId, subId) {
    var t = findTask(data, taskId);
    if (!t) return false;
    var n = t.subs.length;
    t.subs = t.subs.filter(function (s) { return s.id !== subId; });
    return t.subs.length !== n;
  }
  function addStep(data, taskId, subId, text) {
    var s = findSub(data, taskId, subId);
    text = (text || '').trim();
    if (!s || s.type !== 'steps' || !text) return false;
    s.steps.push({ t: str(text, 80), done: false });
    return true;
  }
  function removeStep(data, taskId, subId, i) {
    var s = findSub(data, taskId, subId);
    if (!s || s.type !== 'steps' || i < 0 || i >= s.steps.length) return false;
    s.steps.splice(i, 1);
    return true;
  }
  function toggleStep(data, taskId, subId, i) {
    var s = findSub(data, taskId, subId);
    if (!s || s.type !== 'steps' || i < 0 || i >= s.steps.length) return false;
    s.steps[i].done = !s.steps[i].done;
    return true;
  }
  function setPct(data, taskId, subId, v) {
    var s = findSub(data, taskId, subId);
    if (!s || s.type !== 'pct') return false;
    s.pct = clamp(v, 0, 100);
    return true;
  }

  /* ---------- الحساب ---------- */
  function subStat(sb) {
    if (sb.type === 'pct') return { complete: sb.pct >= 100, label: sb.pct + '%' };
    var n = sb.steps.length;
    var d = sb.steps.filter(function (x) { return x.done; }).length;
    return { complete: n > 0 && d === n, label: d + '/' + n };
  }
  function taskStat(t) {
    var items = t.subs.length;
    var done = t.subs.filter(function (sb) { return subStat(sb).complete; }).length;
    return { items: items, done: done, complete: items > 0 && done === items };
  }

  /* ---------- التواريخ والتذكير ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daysBetween(fromIso, toIso) {
    var a = fromIso.split('-'), b = toIso.split('-');
    var ta = Date.UTC(+a[0], +a[1] - 1, +a[2]);
    var tb = Date.UTC(+b[0], +b[1] - 1, +b[2]);
    return Math.round((tb - ta) / 86400000);
  }
  /* المهام غير المكتملة المفعّل تنبيهها والتي موعدها غداً أو اليوم أو فات */
  function reminders(data, todayIso) {
    var out = [];
    data.tasks.forEach(function (t) {
      if (!t.remind || !t.due || taskStat(t).complete) return;
      var days = daysBetween(todayIso, t.due);
      if (days <= 1) out.push({ id: t.id, title: t.title, days: days });
    });
    out.sort(function (x, y) { return x.days - y.days; });
    return out;
  }

  return {
    KEY: KEY, PRIORITIES: PRIORITIES, priority: priority,
    emptyData: emptyData, clean: clean, load: load, save: save,
    findTask: findTask, findSub: findSub,
    addTask: addTask, updateTask: updateTask, deleteTask: deleteTask,
    addSub: addSub, updateSub: updateSub, deleteSub: deleteSub,
    addStep: addStep, removeStep: removeStep, toggleStep: toggleStep, setPct: setPct,
    subStat: subStat, taskStat: taskStat,
    todayISO: todayISO, daysBetween: daysBetween, reminders: reminders
  };
});
