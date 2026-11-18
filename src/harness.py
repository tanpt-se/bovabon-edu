# Bovabon Edu — mini test harness cho Python (cú pháp gần giống Jest/pytest).
# Đọc {"code", "tests"} từ stdin, chạy code + test trong cùng namespace, in kết quả JSON.
import asyncio
import contextlib
import inspect
import io
import json
import sys
import traceback

_MARK = "@@BOVABON@@"
_tests = []


def test(name):
    """@test("mô tả") — đăng ký 1 test case (hỗ trợ cả async def)."""
    def deco(fn):
        _tests.append((name, fn))
        return fn
    return deco


class _Expect:
    def __init__(self, v):
        self.v = v
        self._neg = False

    @property
    def not_(self):
        e = _Expect(self.v)
        e._neg = not self._neg
        return e

    def _check(self, ok, msg):
        if self._neg:
            ok, msg = not ok, "Expected NOT: " + msg
        if not ok:
            raise AssertionError(msg)

    def to_be(self, e):
        self._check(self.v is e or (type(self.v) is type(e) and self.v == e), f"expect({self.v!r}).to_be({e!r})")

    def to_equal(self, e):
        self._check(self.v == e, f"expect({self.v!r}).to_equal({e!r})")

    def to_be_true(self):
        self._check(bool(self.v), f"expect({self.v!r}).to_be_true()")

    def to_be_false(self):
        self._check(not self.v, f"expect({self.v!r}).to_be_false()")

    def to_be_none(self):
        self._check(self.v is None, f"expect({self.v!r}).to_be_none()")

    def to_contain(self, item):
        self._check(item in self.v, f"expect({self.v!r}).to_contain({item!r})")

    def to_have_length(self, n):
        self._check(len(self.v) == n, f"expect({self.v!r}).to_have_length({n})")

    def to_be_instance_of(self, cls):
        self._check(isinstance(self.v, cls), f"expect({self.v!r}).to_be_instance_of({cls.__name__})")

    def to_be_close_to(self, n, digits=2):
        self._check(abs(self.v - n) < 10 ** -digits / 2, f"expect({self.v!r}).to_be_close_to({n})")

    def to_raise(self, exc=Exception, match=None):
        try:
            self.v()
        except exc as e:  # noqa: PERF203
            if match is not None and match not in str(e):
                raise AssertionError(f"lỗi {type(e).__name__} nhưng message {str(e)!r} không chứa {match!r}")
            return
        except Exception as e:
            raise AssertionError(f"ném {type(e).__name__} thay vì {exc.__name__}: {e}")
        raise AssertionError(f"hàm không ném {exc.__name__}")


def expect(v):
    return _Expect(v)


def _err(e):
    if isinstance(e, AssertionError):
        msg = str(e)
        if msg:
            return msg
        tb = traceback.extract_tb(e.__traceback__)
        line = tb[-1].line if tb else ""
        return "assert thất bại: " + (line or "")
    return f"{type(e).__name__}: {e}"


def _main():
    payload = json.loads(sys.stdin.read())
    out = {"results": [], "logs": [], "pending": 0, "error": None}
    buf = io.StringIO()
    ns = {"__name__": "__solution__", "test": test, "expect": expect}
    with contextlib.redirect_stdout(buf):
        try:
            exec(compile(payload["code"], "solution.py", "exec"), ns)
        except BaseException as e:  # noqa: BLE001
            tb = traceback.format_exception_only(type(e), e)
            out["error"] = "Lỗi trong code của bạn: " + "".join(tb).strip()
        if out["error"] is None:
            try:
                exec(compile(payload["tests"], "tests.py", "exec"), ns)
            except BaseException as e:  # noqa: BLE001
                out["error"] = "Lỗi khi nạp bộ test: " + _err(e)
            for name, fn in _tests:
                try:
                    if inspect.iscoroutinefunction(fn):
                        asyncio.run(fn())
                    else:
                        fn()
                    out["results"].append({"name": name, "passed": True, "error": None})
                except BaseException as e:  # noqa: BLE001
                    out["results"].append({"name": name, "passed": False, "error": _err(e)})
    out["logs"] = buf.getvalue().splitlines()[:200]
    sys.__stdout__.write("\n" + _MARK + json.dumps(out, ensure_ascii=False) + "\n")


_main()
