// Bovabon Edu — mini test harness chạy trong Boa (JS engine viết bằng Rust).
// Cung cấp: console, test/describe/expect (giống Jest), fake timers,
// MiniReact (useState/useEffect/useMemo/useRef/useCallback/useReducer + renderHook/act).
// Polyfill base64 (Boa chưa có btoa/atob). Chỉ hỗ trợ chuỗi Latin-1 như trình duyệt.
var __B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function btoa(s) {
  s = String(s);
  var out = '';
  for (var i = 0; i < s.length; i += 3) {
    var a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
    if (a > 255 || b > 255 || c > 255) throw new Error('InvalidCharacterError: btoa chỉ nhận ký tự Latin-1');
    var n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += __B64[(n >> 18) & 63] + __B64[(n >> 12) & 63] +
      (i + 1 < s.length ? __B64[(n >> 6) & 63] : '=') + (i + 2 < s.length ? __B64[n & 63] : '=');
  }
  return out;
}
function atob(s) {
  s = String(s).replace(/[\t\n\f\r ]/g, '');
  if (s.length % 4 === 0) s = s.replace(/==?$/, '');
  if (s.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(s)) throw new Error('InvalidCharacterError: chuỗi base64 không hợp lệ');
  var out = '', bits = 0, acc = 0;
  for (var i = 0; i < s.length; i++) {
    acc = (acc << 6) | __B64.indexOf(s[i]);
    bits += 6;
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((acc >> bits) & 255); }
  }
  return out;
}

var __logs = [];
var __results = [];
var __pending = 0;
var __prefix = [];

function __fmt(v) {
  try {
    if (typeof v === 'string') return v;
    if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
    if (v === undefined) return 'undefined';
    if (typeof v === 'number' && isNaN(v)) return 'NaN';
    var seen = [];
    return JSON.stringify(v, function (k, val) {
      if (val === undefined) return '__undefined__';
      if (typeof val === 'function') return '[Function]';
      if (val && typeof val === 'object') {
        if (seen.indexOf(val) !== -1) return '[Circular]';
        seen.push(val);
        if (val instanceof Map) return { '[Map]': Array.from(val.entries()) };
        if (val instanceof Set) return { '[Set]': Array.from(val.values()) };
      }
      return val;
    }).replace(/"__undefined__"/g, 'undefined');
  } catch (e) { return String(v); }
}

var console = {
  log: function () { __logs.push(Array.prototype.map.call(arguments, __fmt).join(' ')); },
};
console.info = console.log; console.warn = console.log; console.error = console.log; console.debug = console.log;

function __deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    var ok = true;
    a.forEach(function (v, k) { if (!b.has(k) || !__deepEqual(v, b.get(k))) ok = false; });
    return ok;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    var ok2 = true;
    a.forEach(function (v) { if (!b.has(v)) ok2 = false; });
    return ok2;
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  var ka = Object.keys(a).filter(function (k) { return a[k] !== undefined; });
  var kb = Object.keys(b).filter(function (k) { return b[k] !== undefined; });
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
    if (!__deepEqual(a[ka[i]], b[ka[i]])) return false;
  }
  return true;
}

function __AssertionError(msg) { var e = new Error(msg); e.__assert = true; return e; }

function expect(actual) {
  function make(neg) {
    function check(pass, msg) {
      if (neg ? pass : !pass) throw __AssertionError((neg ? 'Expected NOT: ' : '') + msg);
    }
    var m = {
      toBe: function (exp) { check(Object.is(actual, exp), 'expect(' + __fmt(actual) + ').toBe(' + __fmt(exp) + ')'); },
      toEqual: function (exp) { check(__deepEqual(actual, exp), 'expect(' + __fmt(actual) + ').toEqual(' + __fmt(exp) + ')'); },
      toStrictEqual: function (exp) { check(__deepEqual(actual, exp), 'expect(' + __fmt(actual) + ').toStrictEqual(' + __fmt(exp) + ')'); },
      toBeTruthy: function () { check(!!actual, 'expect(' + __fmt(actual) + ').toBeTruthy()'); },
      toBeFalsy: function () { check(!actual, 'expect(' + __fmt(actual) + ').toBeFalsy()'); },
      toBeNull: function () { check(actual === null, 'expect(' + __fmt(actual) + ').toBeNull()'); },
      toBeUndefined: function () { check(actual === undefined, 'expect(' + __fmt(actual) + ').toBeUndefined()'); },
      toBeDefined: function () { check(actual !== undefined, 'expect(' + __fmt(actual) + ').toBeDefined()'); },
      toBeGreaterThan: function (n) { check(actual > n, 'expect(' + __fmt(actual) + ').toBeGreaterThan(' + n + ')'); },
      toBeLessThan: function (n) { check(actual < n, 'expect(' + __fmt(actual) + ').toBeLessThan(' + n + ')'); },
      toBeCloseTo: function (n, digits) {
        var d = digits === undefined ? 2 : digits;
        check(Math.abs(actual - n) < Math.pow(10, -d) / 2, 'expect(' + __fmt(actual) + ').toBeCloseTo(' + n + ')');
      },
      toContain: function (item) {
        var ok = actual != null && typeof actual.indexOf === 'function' && actual.indexOf(item) !== -1;
        check(ok, 'expect(' + __fmt(actual) + ').toContain(' + __fmt(item) + ')');
      },
      toHaveLength: function (n) { check(actual != null && actual.length === n, 'expect(' + __fmt(actual) + ').toHaveLength(' + n + ')'); },
      toHaveProperty: function (k) { check(actual != null && k in Object(actual), 'expect(' + __fmt(actual) + ').toHaveProperty(' + __fmt(k) + ')'); },
      toBeInstanceOf: function (C) { check(actual instanceof C, 'expect(value).toBeInstanceOf(' + (C && C.name) + ')'); },
      toMatch: function (re) {
        var ok = typeof actual === 'string' && (re instanceof RegExp ? re.test(actual) : actual.indexOf(re) !== -1);
        check(ok, 'expect(' + __fmt(actual) + ').toMatch(' + String(re) + ')');
      },
      toThrow: function (msg) {
        var threw = false, err;
        try { actual(); } catch (e) { threw = true; err = e; }
        var ok = threw && (msg === undefined || (err && String(err.message).indexOf(msg) !== -1));
        check(ok, 'expect(fn).toThrow(' + (msg === undefined ? '' : __fmt(msg)) + ')' + (threw ? ' — lỗi nhận được: ' + (err && err.message) : ' — hàm không ném lỗi'));
      },
      toHaveBeenCalled: function () { check(actual && actual.mock && actual.mock.calls.length > 0, 'expect(mockFn).toHaveBeenCalled()'); },
      toHaveBeenCalledTimes: function (n) {
        var c = actual && actual.mock ? actual.mock.calls.length : -1;
        check(c === n, 'expect(mockFn).toHaveBeenCalledTimes(' + n + ') — thực tế: ' + c);
      },
      toHaveBeenCalledWith: function () {
        var args = Array.prototype.slice.call(arguments);
        var ok = actual && actual.mock && actual.mock.calls.some(function (c) { return __deepEqual(c, args); });
        check(ok, 'expect(mockFn).toHaveBeenCalledWith(' + args.map(__fmt).join(', ') + ') — các lần gọi: ' + __fmt(actual && actual.mock && actual.mock.calls));
      },
    };
    return m;
  }
  var api = make(false);
  api.not = make(true);
  return api;
}

function __record(name, ok, err) {
  __results.push({ name: name, passed: ok, error: ok ? null : (err && err.message ? err.message : String(err)) });
}

function describe(name, fn) { __prefix.push(name); try { fn(); } finally { __prefix.pop(); } }

// Test được xếp hàng và chạy TUẦN TỰ (test async xong mới chạy test kế tiếp)
// để fake timers / Date.now không bị chia sẻ giữa các test.
var __queue = [];
var __index = 0;
function test(name, fn) {
  __queue.push({ name: __prefix.concat([name]).join(' › '), fn: fn });
}
function __runAll() {
  while (__index < __queue.length) {
    var t = __queue[__index++];
    __resetTimers();
    __lastHook = null;
    try {
      var r = t.fn();
      if (r && typeof r.then === 'function') {
        __pending++;
        r.then(function () { __pending--; __record(t.name, true); __runAll(); },
               function (e) { __pending--; __record(t.name, false, e); __runAll(); });
        return;
      }
      __record(t.name, true);
    } catch (e) { __record(t.name, false, e); }
  }
}
var it = test;

// ---- jest.fn + fake timers ----
var __timers = [];
var __now = 0;
var __timerId = 0;
function __resetTimers() { __timers = []; __now = 0; }
function setTimeout(fn, ms) {
  var id = ++__timerId;
  __timers.push({ id: id, at: __now + (ms || 0), fn: fn, interval: null });
  return id;
}
function setInterval(fn, ms) {
  var id = ++__timerId;
  __timers.push({ id: id, at: __now + (ms || 0), fn: fn, interval: ms || 1 });
  return id;
}
function clearTimeout(id) { __timers = __timers.filter(function (t) { return t.id !== id; }); }
var clearInterval = clearTimeout;
var jest = {
  fn: function (impl) {
    var f = function () {
      var args = Array.prototype.slice.call(arguments);
      f.mock.calls.push(args);
      var r = f.__impl ? f.__impl.apply(this, args) : undefined;
      f.mock.results.push(r);
      return r;
    };
    f.mock = { calls: [], results: [] };
    f.__impl = impl;
    f.mockReturnValue = function (v) { f.__impl = function () { return v; }; return f; };
    f.mockImplementation = function (g) { f.__impl = g; return f; };
    return f;
  },
  useFakeTimers: function () { __resetTimers(); },
  useRealTimers: function () {},
  advanceTimersByTime: function (ms) {
    var target = __now + ms;
    var guard = 0;
    while (guard++ < 100000) {
      var next = null;
      for (var i = 0; i < __timers.length; i++) {
        if (__timers[i].at <= target && (next === null || __timers[i].at < next.at)) next = __timers[i];
      }
      if (!next) break;
      __now = next.at;
      if (next.interval) next.at = __now + next.interval; else clearTimeout(next.id);
      next.fn();
    }
    __now = target;
  },
  runAllTimers: function () {
    var guard = 0;
    while (__timers.length && guard++ < 10000) {
      var min = __timers.reduce(function (a, t) { return t.at < a.at ? t : a; });
      jest.advanceTimersByTime(min.at - __now);
    }
  },
  now: function () { return __now; },
};
Date.now = function () { return __now; };

// ---- MiniReact: runtime hooks tối giản để luyện custom hooks ----
var React = (function () {
  var current = null;
  function cur() { if (!current) throw new Error('Hooks chỉ được gọi bên trong component/hook đang render'); return current; }
  function depsChanged(a, b) {
    if (!a || !b) return true;
    if (a.length !== b.length) return true;
    for (var i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return true;
    return false;
  }
  function useReducer(reducer, initialArg, init) {
    var c = cur(), i = c.idx++;
    if (!(i in c.hooks)) {
      var initial = init ? init(initialArg) : initialArg;
      var slot = { state: initial };
      slot.dispatch = function (action) {
        var next = reducer(slot.state, action);
        if (!Object.is(next, slot.state)) { slot.state = next; c.scheduleRender(); }
      };
      c.hooks[i] = slot;
    }
    return [c.hooks[i].state, c.hooks[i].dispatch];
  }
  function useState(initial) {
    return useReducer(function (s, a) { return typeof a === 'function' ? a(s) : a; },
      initial, function (v) { return typeof v === 'function' ? v() : v; });
  }
  function useRef(v) {
    var c = cur(), i = c.idx++;
    if (!(i in c.hooks)) c.hooks[i] = { current: v };
    return c.hooks[i];
  }
  function useMemo(fn, deps) {
    var c = cur(), i = c.idx++;
    var h = c.hooks[i];
    if (!h || depsChanged(h.deps, deps)) c.hooks[i] = { value: fn(), deps: deps };
    return c.hooks[i].value;
  }
  function useCallback(fn, deps) { return useMemo(function () { return fn; }, deps); }
  function useEffect(fn, deps) {
    var c = cur(), i = c.idx++;
    var h = c.hooks[i];
    if (!h || depsChanged(h.deps, deps)) {
      c.hooks[i] = { deps: deps, cleanup: h ? h.cleanup : undefined };
      c.effects.push(i, fn);
    }
  }
  var useLayoutEffect = useEffect;
  function createContext(def) { return { _value: def, Provider: null }; }
  function useContext(ctx) { return ctx._value; }

  function renderHook(hookFn, options) {
    var props = options && options.initialProps;
    var c = { hooks: {}, idx: 0, effects: [], batching: 0, dirty: false, unmounted: false };
    var result = { current: undefined, all: [] };
    function render() {
      c.idx = 0; c.effects = [];
      var prev = current; current = c;
      try { result.current = hookFn(props); } finally { current = prev; }
      result.all.push(result.current);
      var eff = c.effects; c.effects = [];
      for (var k = 0; k < eff.length; k += 2) {
        var slot = c.hooks[eff[k]];
        if (typeof slot.cleanup === 'function') slot.cleanup();
        var cl = eff[k + 1]();
        slot.cleanup = cl;
      }
    }
    c.scheduleRender = function () {
      if (c.unmounted) return;
      if (c.batching > 0) { c.dirty = true; return; }
      render();
    };
    render();
    return {
      result: result,
      rerender: function (p) { if (arguments.length) props = p; render(); },
      unmount: function () {
        c.unmounted = true;
        Object.keys(c.hooks).forEach(function (k) {
          var h = c.hooks[k];
          if (h && typeof h.cleanup === 'function') h.cleanup();
        });
      },
      __ctx: c,
    };
  }
  return {
    useState: useState, useReducer: useReducer, useRef: useRef, useMemo: useMemo,
    useCallback: useCallback, useEffect: useEffect, useLayoutEffect: useLayoutEffect,
    createContext: createContext, useContext: useContext, __renderHook: renderHook,
  };
})();
var useState = React.useState, useReducer = React.useReducer, useRef = React.useRef,
  useMemo = React.useMemo, useCallback = React.useCallback, useEffect = React.useEffect,
  useLayoutEffect = React.useLayoutEffect, useContext = React.useContext, createContext = React.createContext;
var __lastHook = null;
function renderHook(fn, opts) { __lastHook = React.__renderHook(fn, opts); return __lastHook; }
function act(fn) {
  // gom các setState trong act thành 1 lần render (batching giống React 18)
  var c = __lastHook && __lastHook.__ctx;
  if (c) c.batching++;
  try { fn(); } finally {
    if (c) {
      c.batching--;
      if (c.batching === 0 && c.dirty) { c.dirty = false; c.scheduleRender(); }
    }
  }
}

function __report() {
  for (var k = __index; k < __queue.length; k++) {
    __results.push({ name: __queue[k].name, passed: false, error: 'Không chạy được vì test trước đó bị treo (Promise không resolve)' });
  }
  return JSON.stringify({ results: __results, logs: __logs.slice(0, 200), pending: __pending });
}
