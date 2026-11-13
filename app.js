/* واجهة التطبيق. تعتمد على store.js فقط. */
(function () {
  'use strict';

  var S = window.Store;
  var GOLD = '#E0A100';

  /* عدّل هذين النصين قبل النشر */
  var CONFIG = {
    aboutText: '[اكتب هنا نبذة عن التطبيق وفكرته وهدفه]',
    contactText: '[اكتب هنا وسيلة التواصل مع المطور: بريد إلكتروني أو واتساب]'
  };

  function getStorage() {
    try {
      var s = window.localStorage;
      s.setItem('__t', '1'); s.removeItem('__t');
      return s;
    } catch (e) {
      var mem = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  }

  var storage = getStorage();
  var data = S.load(storage); /* أول تشغيل: فارغ تماماً */
  var ui = { screen: 'list', selId: null, sheet: null, draft: {}, focus: null, expectPop: null };
  var app = document.getElementById('app');

  function persist() { S.save(storage, data); }
  function today() { return S.todayISO(new Date()); }

  /* ---------- أدوات العرض ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var P = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    sliders: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
    list: '<path d="M4 7l2 2 3-3.5"/><path d="M4 16l2 2 3-3.5"/><path d="M13 8h7M13 17h7"/>'
  };
  function ico(name, size, sw, color) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') +
      '" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[name] + '</svg>';
  }

  function fmt(iso) { var p = iso.split('-'); return p[2] + '/' + p[1]; }
  function dueLabel(t, complete) {
    if (!t.due) return '';
    if (!complete) {
      var d = S.daysBetween(today(), t.due);
      if (d < 0) return 'متأخرة';
      if (d === 0) return 'اليوم';
      if (d === 1) return 'غدًا';
    }
    return fmt(t.due);
  }

  /* ---------- المكونات ---------- */
  function topbar() {
    return '<header class="topbar">' +
      '<button class="pill" data-action="info" data-k="about">من نحن</button>' +
      '<button class="pill wide" data-action="info" data-k="contact">تواصل مع المطور</button>' +
      '</header>';
  }

  function remindersHtml() {
    var list = S.reminders(data, today()).slice(0, 3);
    if (!list.length) return '';
    return '<div class="remind" role="status"><b>تذكير</b>' + list.map(function (r) {
      var when = r.days < 0 ? 'فات موعد' : (r.days === 0 ? 'موعد اليوم:' : 'موعد غدًا:');
      return '<span>' + when + ' «' + esc(r.title) + '»</span>';
    }).join('') + '</div>';
  }

  function card(t) {
    var p = S.priority(t.color), st = S.taskStat(t), g = st.complete;
    var due = dueLabel(t, g);
    var name = esc(t.title);
    return '<div class="tag" style="--fill:' + p.fill + ';--h:96px"><span class="tip"></span><span class="tbody"></span>' +
      '<div class="tcontent"><div class="side">' +
      '<button class="circ" data-action="recolor" data-id="' + t.id + '" aria-label="تغيير لون ' + name + '">' +
      '<span class="dot' + (g ? ' gold' : '') + '">' + (g ? ico('check', 14, 3.4, '#FFFDF9') : '') + '</span></button>' +
      '<button class="ico" data-action="edit-task" data-id="' + t.id + '" aria-label="تعديل ' + name + '">' + ico('pencil', 18) + '</button>' +
      '</div>' +
      '<button class="main" data-action="open" data-id="' + t.id + '" aria-label="فتح ' + name + '">' +
      '<span class="ttitle">' + name + '</span>' +
      '<span class="meta"><span class="metal"><span class="chip">' + (g ? 'مكتملة' : p.name) + '</span>' +
      (due ? '<span>' + due + '</span>' : '') +
      (t.remind && t.due && !g ? ico('bell', 14) : '') +
      '</span><span class="count">' + st.done + '/' + st.items + '</span></span>' +
      '</button></div></div>';
  }

  function listView() {
    var n = data.tasks.length;
    var done = data.tasks.filter(function (t) { return S.taskStat(t).complete; }).length;
    var h = '<main class="scroll">' + remindersHtml();
    h += '<div class="titlerow"><h1>مهامي</h1>' + (n ? '<span class="muted">أنجزت ' + done + ' من ' + n + '</span>' : '') + '</div>';
    if (!n) {
      h += '<div class="empty"><strong>ابدأ بأول مهمة</strong>' +
        'اضغط زر + في الأسفل لإنشاء مهمة، واختر لها اسماً ولوناً يدل على أولويتها.<br>' +
        'ثم ادخل إليها وأضف مهام فرعية بنسبة مئوية أو بمربعات.</div>';
    } else {
      h += data.tasks.map(card).join('');
    }
    h += '<p class="offline">' + ico('check', 14) + '<span>يعمل بدون إنترنت، وبياناتك محفوظة على هاتفك</span></p></main>';
    return h;
  }

  function subPanel(t, sb) {
    var p = S.priority(t.color), st = S.subStat(sb);
    var ring = st.complete ? GOLD : p.acc, bgc = st.complete ? GOLD : '#FFFDF9';
    var badge = st.complete ? ico('check', 16, 3.4, '#FFFDF9') : ico(sb.type === 'pct' ? 'sliders' : 'list', 16, 2.2);
    var h = '<section class="sub"><div class="subhead">' +
      '<span class="sbadge" style="--ring:' + ring + ';--bgc:' + bgc + '">' + badge + '</span>' +
      '<span class="subtitle">' + esc(sb.title) + '</span>' +
      '<span class="sublabel" data-label="' + sb.id + '">' + st.label + '</span>' +
      '<button class="ico" data-action="edit-sub" data-sub="' + sb.id + '" aria-label="تعديل ' + esc(sb.title) + '">' + ico('pencil', 18) + '</button>' +
      '</div>';
    if (sb.type === 'pct') {
      h += '<div class="pctbox"><input type="range" min="0" max="100" step="1" value="' + sb.pct + '" data-role="pct" data-sub="' + sb.id +
        '" style="accent-color:' + p.acc + '" aria-label="نسبة إنجاز ' + esc(sb.title) + '">' +
        '<div class="scale"><span>0%</span><span>100%</span></div></div>';
    } else {
      h += '<div class="steps">' + sb.steps.map(function (x, i) {
        return '<button class="step' + (x.done ? ' done' : '') + (data.settings.strike ? ' strike' : '') + '" style="--acc:' + p.acc +
          '" data-action="toggle-step" data-sub="' + sb.id + '" data-i="' + i + '" aria-pressed="' + x.done + '">' +
          '<span class="box">' + (x.done ? ico('check', 15, 3.4, '#FFFDF9') : '') + '</span>' +
          '<span class="steptext">' + esc(x.t) + '</span></button>';
      }).join('') +
        '<button class="addstep" data-action="add-step" data-sub="' + sb.id + '">' + ico('plus', 18, 2.4) + '<span>إضافة خطوة</span></button></div>';
    }
    return h + '</section>';
  }

  function detailView(t) {
    var p = S.priority(t.color), st = S.taskStat(t), g = st.complete;
    var hasSteps = t.subs.some(function (s) { return s.type === 'steps'; });
    var due = dueLabel(t, g);
    var h = '<main class="scroll"><div class="headrow">' +
      '<button class="back" data-action="back" aria-label="رجوع">' + ico('back', 20, 2.2) + '</button>' +
      '<div class="tag" style="--fill:' + p.fill + ';--h:80px"><span class="tip"></span><span class="tbody"></span>' +
      '<div class="tcontent"><div class="side"><span class="dot big' + (g ? ' gold' : '') + '">' + (g ? ico('check', 16, 3.4, '#FFFDF9') : '') + '</span></div>' +
      '<div class="htext"><h1>' + esc(t.title) + '</h1><span class="metal"><span class="chip">' + (g ? 'مكتملة' : p.name) + '</span>' +
      (due ? '<span>' + due + '</span>' : '') + '</span></div>' +
      '<span class="count hc">' + st.done + '/' + st.items + '</span></div></div></div>';
    if (g) h += '<div class="banner" role="status">' + ico('check', 20, 2.6) + '<span>أحسنت! اكتملت المهمة وصارت دائرتها ذهبية.</span></div>';
    if (hasSteps) {
      h += '<div class="rowtool"><span>شكل الخطوة المنجزة</span><button class="toggle' + (data.settings.strike ? ' on' : '') +
        '" data-action="toggle-strike" aria-pressed="' + data.settings.strike + '">' +
        (data.settings.strike ? 'مشطوبة مع علامة ✔' : 'علامة ✔ فقط') + '</button></div>';
    }
    h += t.subs.map(function (sb) { return subPanel(t, sb); }).join('');
    if (!t.subs.length) {
      h += '<div class="empty"><strong>لا توجد مهام داخل هذه المهمة بعد</strong>' +
        'اضغط + لإضافة مهمة فرعية، وتختار لها نسبة مئوية أو مربعات.</div>';
    }
    return h + '</main>';
  }

  /* ---------- النوافذ السفلية ---------- */
  function colorOpts(selected, action) {
    return '<div class="opts">' + S.PRIORITIES.map(function (o) {
      return '<button class="opt' + (o.id === selected ? ' sel' : '') + '" style="--fill:' + o.fill + '" data-action="' + action +
        '" data-c="' + o.id + '" aria-pressed="' + (o.id === selected) + '">' + o.name + '</button>';
    }).join('') + '</div>';
  }

  function sheetInner() {
    var d = ui.draft, h = '';
    if (ui.sheet === 'form') {
      h += '<h2>' + (d.editingId ? 'تعديل المهمة' : 'مهمة جديدة') + '</h2>' +
        '<label class="field">اسم المهمة<input type="text" data-field="title" data-enter="save-task" maxlength="60" placeholder="مثال: المراجعة" value="' + esc(d.title) + '"></label>' +
        (d.error ? '<p class="err" role="alert">' + esc(d.error) + '</p>' : '') +
        '<label class="field">الموعد النهائي (اختياري)<input type="date" data-field="due" value="' + esc(d.due) + '"></label>' +
        '<div class="field"><span>الأولوية (اللون)</span>' + colorOpts(d.color, 'pick-color') + '</div>';
      if (d.due) {
        h += '<button class="row" data-action="toggle-remind" aria-pressed="' + !!d.remind + '">' + ico('bell', 20) +
          '<span>تنبيه داخل التطبيق قبل الموعد بيوم</span><span class="switch' + (d.remind ? ' on' : '') + '"><i></i></span></button>';
      }
      h += '<div class="btns"><button class="btn" data-action="save-task">حفظ</button>' +
        (d.editingId ? '<button class="btn danger" data-action="delete-task">حذف</button>' : '') + '</div>';
    } else if (ui.sheet === 'color') {
      var t = S.findTask(data, d.id);
      h += '<h2>اختر لون المهمة</h2>' + colorOpts(t ? t.color : '', 'quick-color') +
        '<p class="hint">اللون يدل على الأولوية. وعند اكتمال المهمة تتحول دائرتها إلى الذهبي.</p>';
    } else if (ui.sheet === 'sub') {
      var isNew = !d.editingId;
      h += '<h2>' + (isNew ? 'مهمة فرعية جديدة' : 'تعديل المهمة الفرعية') + '</h2>' +
        '<label class="field">اسم المهمة الفرعية<input type="text" data-field="title" data-enter="save-sub" maxlength="60" placeholder="مثال: الفيزياء" value="' + esc(d.title) + '"></label>' +
        (d.error ? '<p class="err" role="alert">' + esc(d.error) + '</p>' : '');
      if (isNew) {
        h += '<div class="field"><span>كيف تتابع إنجازها؟ (اختر واحدة)</span><div class="opts">' +
          ['pct', 'steps'].map(function (ty) {
            var sel = d.type === ty;
            return '<button class="topt' + (sel ? ' sel' : '') + '" data-action="pick-type" data-ty="' + ty + '" aria-pressed="' + sel + '">' +
              ico(ty === 'pct' ? 'sliders' : 'list', 26, 2) +
              '<b>' + (ty === 'pct' ? 'نسبة مئوية' : 'مربعات') + '</b><small>' + (ty === 'pct' ? 'شريط تسحبه' : 'خطوات تضغط عليها') + '</small></button>';
          }).join('') + '</div></div>';
      } else {
        h += '<p class="hint">طريقة المتابعة: ' + (d.type === 'pct' ? 'نسبة مئوية' : 'مربعات') + ' (لا تتغير بعد الإنشاء)</p>';
        var sb = S.findSub(data, ui.selId, d.editingId);
        if (sb && sb.type === 'steps' && sb.steps.length) {
          h += '<div class="slist">' + sb.steps.map(function (x, i) {
            return '<div class="sitem"><span>' + esc(x.t) + '</span><button data-action="rm-step" data-i="' + i + '" aria-label="حذف الخطوة ' + esc(x.t) + '">حذف</button></div>';
          }).join('') + '</div>';
        }
      }
      h += '<div class="btns"><button class="btn" data-action="save-sub">' + (isNew ? 'إنشاء' : 'حفظ') + '</button>' +
        (!isNew ? '<button class="btn danger" data-action="delete-sub">حذف</button>' : '') + '</div>';
    } else if (ui.sheet === 'step') {
      var s2 = S.findSub(data, ui.selId, d.subId);
      h += '<h2>خطوات: ' + esc(s2 ? s2.title : '') + '</h2>' +
        '<div class="field">خطوة جديدة<div class="inline"><input type="text" data-field="text" data-enter="do-add-step" maxlength="80" placeholder="مثال: الهندسة" value="' + esc(d.text) + '" aria-label="خطوة جديدة">' +
        '<button class="btn" data-action="do-add-step">إضافة</button></div></div>';
      if (s2 && s2.steps.length) {
        h += '<div class="slist">' + s2.steps.map(function (x) { return '<div class="sitem"><span>' + esc(x.t) + '</span></div>'; }).join('') + '</div>';
      }
      h += '<button class="btn ghost" data-action="close">تم</button>';
    } else if (ui.sheet === 'info') {
      var about = d.k === 'about';
      h += '<h2>' + (about ? 'من نحن' : 'تواصل مع المطور') + '</h2><p class="hint" style="font-size:15px">' +
        esc(about ? CONFIG.aboutText : CONFIG.contactText) + '</p><button class="btn ghost" data-action="close">إغلاق</button>';
    }
    return h;
  }

  /* ---------- الرسم ---------- */
  function render() {
    var task = ui.screen === 'detail' ? S.findTask(data, ui.selId) : null;
    if (ui.screen === 'detail' && !task) { ui.screen = 'list'; ui.selId = null; }
    var html = topbar() + (task ? detailView(task) : listView()) +
      '<button class="fab" data-action="fab" aria-label="' + (task ? 'إضافة مهمة فرعية' : 'إضافة مهمة') + '">' + ico('plus', 26, 2.6) + '</button>';
    if (ui.sheet) {
      html += '<button class="overlay" data-action="close" aria-label="إغلاق"></button>' +
        '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + sheetInner() + '</div>';
    }
    app.innerHTML = html;
    if (ui.focus) {
      var f = app.querySelector('[data-field="' + ui.focus + '"]');
      if (f && f.focus) f.focus();
      ui.focus = null;
    }
  }

  /* ---------- التنقل (زر الرجوع في أندرويد) ---------- */
  function push(state) { try { history.pushState(state, ''); } catch (e) { /* تجاهل */ } }
  function replace(state) { try { history.replaceState(state, ''); } catch (e) { /* تجاهل */ } }

  function openSheet(kind, draft, focus) {
    if (ui.sheet) replace({ s: 1 }); else push({ s: 1 });
    ui.sheet = kind; ui.draft = draft || {}; ui.focus = focus || null;
    render();
  }
  function closeSheet() {
    if (!ui.sheet) return;
    ui.sheet = null; ui.draft = {};
    if (history.state && history.state.s) { ui.expectPop = 'sheet'; history.back(); }
    render();
  }
  function openDetail(id) {
    ui.selId = id; ui.screen = 'detail';
    push({ d: 1 });
    render();
    var sc = app.querySelector('.scroll'); if (sc) sc.scrollTop = 0;
  }
  function goBack() {
    if (history.state && history.state.d) { ui.expectPop = 'detail'; history.back(); }
    ui.screen = 'list'; ui.selId = null;
    render();
  }
  window.addEventListener('popstate', function () {
    var ex = ui.expectPop; ui.expectPop = null;
    if (ex === 'detail') { ui.screen = 'list'; ui.selId = null; }
    else if (ex === 'sheet') { /* أُغلقت مسبقاً */ }
    else if (ui.sheet) { ui.sheet = null; ui.draft = {}; }
    else if (ui.screen === 'detail') { ui.screen = 'list'; ui.selId = null; }
    render();
  });

  /* ---------- الأحداث ---------- */
  function act(a, el) {
    var ds = (el && el.dataset) || {};
    var d = ui.draft;
    switch (a) {
      case 'open': openDetail(ds.id); return;
      case 'back': goBack(); return;
      case 'close': closeSheet(); return;
      case 'fab':
        if (ui.screen === 'detail') openSheet('sub', { editingId: null, title: '', type: 'steps' }, 'title');
        else openSheet('form', { editingId: null, title: '', due: '', color: 'blue', remind: false }, 'title');
        return;
      case 'info': openSheet('info', { k: ds.k }); return;
      case 'recolor': openSheet('color', { id: ds.id }); return;
      case 'edit-task': {
        var t = S.findTask(data, ds.id); if (!t) return;
        openSheet('form', { editingId: t.id, title: t.title, due: t.due, color: t.color, remind: t.remind });
        return;
      }
      case 'pick-color': d.color = ds.c; break;
      case 'quick-color':
        S.updateTask(data, d.id, { color: ds.c }); persist(); closeSheet(); return;
      case 'toggle-remind': d.remind = !d.remind; break;
      case 'save-task': {
        if (!(d.title || '').trim()) { d.error = 'اكتب اسم المهمة أولاً'; ui.focus = 'title'; break; }
        var f = { title: d.title, due: d.due, color: d.color, remind: !!d.remind && !!d.due };
        if (d.editingId) S.updateTask(data, d.editingId, f); else S.addTask(data, f);
        persist(); closeSheet(); return;
      }
      case 'delete-task': {
        var dt = S.findTask(data, d.editingId);
        if (dt && window.confirm('حذف المهمة «' + dt.title + '» وكل ما بداخلها نهائياً؟')) {
          S.deleteTask(data, d.editingId); persist(); closeSheet();
        }
        return;
      }
      case 'edit-sub': {
        var sb = S.findSub(data, ui.selId, ds.sub); if (!sb) return;
        openSheet('sub', { editingId: sb.id, title: sb.title, type: sb.type });
        return;
      }
      case 'pick-type': d.type = ds.ty; break;
      case 'save-sub': {
        if (!(d.title || '').trim()) { d.error = 'اكتب اسم المهمة الفرعية أولاً'; ui.focus = 'title'; break; }
        if (d.editingId) {
          S.updateSub(data, ui.selId, d.editingId, { title: d.title }); persist(); closeSheet(); return;
        }
        var ns = S.addSub(data, ui.selId, { title: d.title, type: d.type });
        persist();
        if (ns && ns.type === 'steps') { openSheet('step', { subId: ns.id, text: '' }, 'text'); return; }
        closeSheet(); return;
      }
      case 'delete-sub': {
        var ds2 = S.findSub(data, ui.selId, d.editingId);
        if (ds2 && window.confirm('حذف «' + ds2.title + '» نهائياً؟')) {
          S.deleteSub(data, ui.selId, d.editingId); persist(); closeSheet();
        }
        return;
      }
      case 'rm-step': S.removeStep(data, ui.selId, d.editingId, +ds.i); persist(); break;
      case 'add-step': openSheet('step', { subId: ds.sub, text: '' }, 'text'); return;
      case 'do-add-step':
        if (S.addStep(data, ui.selId, d.subId, d.text)) { persist(); d.text = ''; }
        ui.focus = 'text'; break;
      case 'toggle-step': S.toggleStep(data, ui.selId, ds.sub, +ds.i); persist(); break;
      case 'toggle-strike': data.settings.strike = !data.settings.strike; persist(); break;
      default: return;
    }
    render();
  }

  app.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (el) act(el.dataset.action, el);
  });
  app.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.role === 'pct') {
      S.setPct(data, ui.selId, t.dataset.sub, t.value);
      var l = app.querySelector('[data-label="' + t.dataset.sub + '"]');
      if (l) l.textContent = Math.round(Number(t.value)) + '%';
      return;
    }
    if (t.dataset && t.dataset.field && t.type !== 'date') ui.draft[t.dataset.field] = t.value;
  });
  app.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.role === 'pct') { persist(); render(); return; }
    if (t.dataset && t.dataset.field && t.type === 'date') {
      ui.draft.due = t.value;
      if (!t.value) ui.draft.remind = false;
      render();
    }
  });
  app.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter) {
      e.preventDefault();
      act(e.target.dataset.enter, e.target);
    }
  });

  /* ---------- العمل بدون إنترنت ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* تجاهل */ });
    });
  }

  window.__mahami = { ui: ui, act: act, render: render, getData: function () { return data; } };
  render();
})();
