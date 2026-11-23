#!/usr/bin/env python3
"""Đo kho câu hỏi theo chỉ tiêu bàn giao (docs/codex-handoff.md).

  python3 scripts/bank-stats.py                    # bảng tổng hợp mọi lộ trình
  python3 scripts/bank-stats.py data/react.toml    # chi tiết 1 file + danh sách còn thiếu
  python3 scripts/bank-stats.py --check data/x.toml  # exit 1 nếu chưa đạt chỉ tiêu (dùng trong pipeline)
  python3 scripts/bank-stats.py --i18n               # module / câu còn thiếu bản dịch EN

Chỉ tiêu:
- Lộ trình dev (area = dev): mỗi câu có đúng 1 tag level (level:junior|middle|senior|lead),
  difficulty khớp level (junior=1, middle=2, senior/lead=3); tổng ≥ 120 câu;
  junior ≥ 30, middle ≥ 40, senior ≥ 30, lead ≥ 18; code ≥ 12 (≥ 1 ở mỗi level), essay ≥ 8;
  có module `<id lộ trình>-lead`.
- Lộ trình IELTS (id bắt đầu bằng english-ielts-): mỗi câu có đúng 1 tag band (band:5.5|6.5|7),
  difficulty khớp band (5.5=1, 6.5=2, 7=3); tổng ≥ TARGET_IELTS[id]; band:5.5 ≥ 20%,
  band:6.5 ≥ 45%, band:7 ≥ 20%; mỗi module ≥ 10 câu, lesson ≥ 1500 ký tự; có essay (trừ reading/listening).
- Lộ trình khác (CEFR, Tiếng Anh cho IT…): chỉ báo cáo.
"""
import sys
try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    import tomli as tomllib
import glob
import os
from collections import Counter

LEVELS = {"level:junior": 1, "level:middle": 2, "level:senior": 3, "level:lead": 3}
DEV_FLOORS = {"level:junior": 30, "level:middle": 40, "level:senior": 30, "level:lead": 18}
DEV_TOTAL = 120
DEV_CODE = 12
DEV_ESSAY = 8

BANDS = {"band:5.5": 1, "band:6.5": 2, "band:7": 3}
BAND_SHARE = {"band:5.5": 0.20, "band:6.5": 0.45, "band:7": 0.20}
TARGET_IELTS = {
    "english-ielts-grammar": 120,
    "english-ielts-vocab": 160,
    "english-ielts-reading": 120,
    "english-ielts-listening": 80,
    "english-ielts-writing-task1": 80,
    "english-ielts-writing-task2": 100,
    "english-ielts-speaking": 80,
}
NO_ESSAY_OK = {"english-ielts-reading", "english-ielts-listening"}
IELTS_LESSON_MIN = 1500
IELTS_MODULE_MIN_Q = 10


def load(path):
    with open(path, "rb") as f:
        return tomllib.load(f)


def one_tag(q, allowed):
    tags = [t for t in q.get("tags", []) if t in allowed]
    return tags[0] if len(tags) == 1 else None


def dev_gaps(d):
    qs = d.get("questions", [])
    gaps = []
    lv = Counter()
    code_lv = Counter()
    bad_tag, bad_diff = [], []
    for q in qs:
        t = one_tag(q, LEVELS)
        if t is None:
            bad_tag.append(q["id"])
            continue
        lv[t] += 1
        if q["type"] == "code":
            code_lv[t] += 1
        if q.get("difficulty") != LEVELS[t]:
            bad_diff.append(q["id"])
    ty = Counter(q["type"] for q in qs)
    if bad_tag:
        gaps.append(f"{len(bad_tag)} câu thiếu/thừa tag level (vd. {', '.join(bad_tag[:6])})")
    if bad_diff:
        gaps.append(f"{len(bad_diff)} câu difficulty không khớp level (vd. {', '.join(bad_diff[:6])})")
    if len(qs) < DEV_TOTAL:
        gaps.append(f"tổng {len(qs)}/{DEV_TOTAL} câu")
    for t, n in DEV_FLOORS.items():
        if lv[t] < n:
            gaps.append(f"{t} {lv[t]}/{n}")
    if ty["code"] < DEV_CODE:
        gaps.append(f"code {ty['code']}/{DEV_CODE}")
    for t in LEVELS:
        if code_lv[t] < 1:
            gaps.append(f"chưa có bài code {t}")
    if ty["essay"] < DEV_ESSAY:
        gaps.append(f"essay {ty['essay']}/{DEV_ESSAY}")
    if not any(m["id"] == f"{d['id']}-lead" for m in d.get("modules", [])):
        gaps.append(f"thiếu module '{d['id']}-lead'")
    summary = (f"q={len(qs):3} J/M/S/L={lv['level:junior']}/{lv['level:middle']}/"
               f"{lv['level:senior']}/{lv['level:lead']} code={ty['code']} essay={ty['essay']}")
    return summary, gaps


def ielts_gaps(d):
    qs = d.get("questions", [])
    target = TARGET_IELTS.get(d["id"], 100)
    gaps = []
    bd = Counter()
    bad_tag, bad_diff = [], []
    for q in qs:
        t = one_tag(q, BANDS)
        if t is None:
            bad_tag.append(q["id"])
            continue
        bd[t] += 1
        if q.get("difficulty") != BANDS[t]:
            bad_diff.append(q["id"])
    if bad_tag:
        gaps.append(f"{len(bad_tag)} câu thiếu/thừa tag band (vd. {', '.join(bad_tag[:6])})")
    if bad_diff:
        gaps.append(f"{len(bad_diff)} câu difficulty không khớp band (vd. {', '.join(bad_diff[:6])})")
    if len(qs) < target:
        gaps.append(f"tổng {len(qs)}/{target} câu")
    for t, share in BAND_SHARE.items():
        need = int(target * share + 0.999)
        if bd[t] < need:
            gaps.append(f"{t} {bd[t]}/{need}")
    per_mod = Counter(q["module"] for q in qs)
    for m in d.get("modules", []):
        if per_mod[m["id"]] < IELTS_MODULE_MIN_Q:
            gaps.append(f"module {m['id']}: {per_mod[m['id']]}/{IELTS_MODULE_MIN_Q} câu")
        if len(m.get("lesson", "")) < IELTS_LESSON_MIN:
            gaps.append(f"module {m['id']}: lesson {len(m.get('lesson', ''))}/{IELTS_LESSON_MIN} ký tự")
    ty = Counter(q["type"] for q in qs)
    if d["id"] not in NO_ESSAY_OK and ty["essay"] < 6:
        gaps.append(f"essay {ty['essay']}/6")
    summary = (f"q={len(qs):3}/{target} 5.5/6.5/7={bd['band:5.5']}/{bd['band:6.5']}/{bd['band:7']} "
               f"essay={ty['essay']}")
    return summary, gaps


def analyse(path):
    d = load(path)
    tid = d.get("id", os.path.basename(path))
    if d.get("area", "dev") == "dev":
        kind = "dev"
        summary, gaps = dev_gaps(d)
    elif tid.startswith("english-ielts-"):
        kind = "ielts"
        summary, gaps = ielts_gaps(d)
    else:
        qs = d.get("questions", [])
        dc = Counter(q.get("difficulty") for q in qs)
        kind, summary, gaps = "other", f"q={len(qs):3} d1/2/3={dc[1]}/{dc[2]}/{dc[3]}", []
    return tid, kind, summary, gaps


def i18n_report(lang="en"):
    """Đếm module / câu hỏi chưa có bản dịch trong data/i18n/<lang>/."""
    tm = tq = mm = mq = 0
    for f in sorted(glob.glob("data/*.toml")):
        if f.endswith("categories.toml"):
            continue
        d = load(f)
        o = f"data/i18n/{lang}/{os.path.basename(f)}"
        ov = load(o) if os.path.exists(o) else {}
        ms = [m["id"] for m in d.get("modules", [])]
        qs = [q["id"] for q in d.get("questions", [])]
        miss_m = [m for m in ms if m not in ov.get("modules", {})]
        miss_q = [q for q in qs if q not in ov.get("questions", {})]
        tm, tq, mm, mq = tm + len(ms), tq + len(qs), mm + len(miss_m), mq + len(miss_q)
        if miss_m or miss_q:
            print(f"❌ {d['id']:28} thiếu {len(miss_m)} module, {len(miss_q)} câu (vd. {', '.join((miss_m + miss_q)[:4])})")
    print(f"Tổng: chưa dịch {mm}/{tm} module, {mq}/{tq} câu ({lang})")
    return mm + mq == 0


def main(argv):
    if "--i18n" in argv:
        ok = i18n_report()
        sys.exit(0 if ok or "--check" not in argv else 1)
    check = "--check" in argv
    files = [a for a in argv if not a.startswith("--")]
    detailed = bool(files)
    if not files:
        files = sorted(f for f in glob.glob("data/*.toml") if not f.endswith("categories.toml"))
    failed = False
    for f in files:
        if not os.path.exists(f):
            print(f"⚠️  {f}: chưa có file")
            failed = True
            continue
        tid, kind, summary, gaps = analyse(f)
        mark = "—" if kind == "other" else ("✅" if not gaps else "❌")
        print(f"{mark} {tid:28} {kind:5} {summary}")
        if gaps:
            failed = True
            if detailed:
                for g in gaps:
                    print(f"     · {g}")
    if check and failed:
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
