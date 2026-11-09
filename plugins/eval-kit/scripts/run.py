#!/usr/bin/env python3
"""eval-kit runner. Python 3.9+, standard library only.

Usage:
  python run.py --dir evals                 # golden set only, writes report.md + runs/<ts>.json
  python run.py --dir evals --gate          # golden + sealed holdout, writes gate.md, exit 0 (PASS) / 1 (FAIL)
Options:
  --pass-threshold <0..1>     override config pass_threshold (gate + report)
  --holdout-threshold <0..1>  override config holdout_threshold (gate)
  --quiet                     less console output
Exit codes: 0 ok / gate PASS, 1 gate FAIL, 2 configuration or usage error.
"""
# Port of run.mjs. Report, gate and runs/<ts>.json formats are identical, so run history
# can be shared between the two runners. JS semantics (Number(), String(), JSON.stringify,
# toFixed) are emulated where they affect output.

import datetime
import importlib.util
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from decimal import ROUND_HALF_UP, Decimal


class _Undefined:
    """Stand-in for JavaScript `undefined` (distinct from JSON null / None)."""

    def __repr__(self):
        return "undefined"

    def __bool__(self):
        return False


UNDEF = _Undefined()


def die(msg):
    sys.stderr.write("eval-kit: %s\n" % msg)
    sys.exit(2)


# ---------- JS-compatible helpers ----------
def js_num_str(x):
    """Number.prototype.toString()"""
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, int):
        return str(x)
    if math.isnan(x):
        return "NaN"
    if math.isinf(x):
        return "Infinity" if x > 0 else "-Infinity"
    if x == 0:
        return "0"
    sign = "-" if x < 0 else ""
    _, digits, exp = Decimal(repr(abs(x))).as_tuple()
    d = "".join(map(str, digits)).rstrip("0") or "0"
    # repr gives the shortest round-tripping digits; re-normalize exponent after stripping zeros
    exp += len("".join(map(str, digits))) - len(d)
    k = len(d)
    n = exp + k
    if k <= n <= 21:
        s = d + "0" * (n - k)
    elif 0 < n <= 21:
        s = d[:n] + "." + d[n:]
    elif -6 < n <= 0:
        s = "0." + "0" * (-n) + d
    else:
        e = n - 1
        es = ("+" if e >= 0 else "-") + str(abs(e))
        s = (d if k == 1 else d[0] + "." + d[1:]) + "e" + es
    return sign + s


def js_to_fixed(x, digits):
    """Number.prototype.toFixed(digits)"""
    if isinstance(x, float) and math.isnan(x):
        return "NaN"
    if isinstance(x, float) and math.isinf(x):
        return "Infinity" if x > 0 else "-Infinity"
    if abs(x) >= 1e21:
        return js_num_str(x)
    q = Decimal(x).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP)
    s = format(q, "f")
    if x < 0 and not s.startswith("-"):
        s = "-" + s
    return s


def js_stringify(v, indent=None, _level=0):
    """JSON.stringify(v) / JSON.stringify(v, null, indent). Returns UNDEF for undefined."""
    if v is UNDEF:
        return UNDEF
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, (int, float)):
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return "null"
        return js_num_str(v)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    pad = "\n" + " " * (indent * (_level + 1)) if indent else ""
    end = "\n" + " " * (indent * _level) if indent else ""
    if isinstance(v, (list, tuple)):
        if not v:
            return "[]"
        items = []
        for x in v:
            s = js_stringify(x, indent, _level + 1)
            items.append("null" if s is UNDEF else s)
        return "[" + pad + ("," + pad).join(items) + end + "]"
    if isinstance(v, dict):
        items = []
        for k, x in v.items():
            s = js_stringify(x, indent, _level + 1)
            if s is UNDEF:
                continue
            items.append(json.dumps(str(k), ensure_ascii=False) + (": " if indent else ":") + s)
        if not items:
            return "{}"
        return "{" + pad + ("," + pad).join(items) + end + "}"
    return json.dumps(str(v), ensure_ascii=False)


def js_string(v):
    """String(v) / template-literal interpolation."""
    if v is UNDEF:
        return "undefined"
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return js_num_str(v)
    if isinstance(v, str):
        return v
    if isinstance(v, (list, tuple)):
        return ",".join("" if x is None or x is UNDEF else js_string(x) for x in v)
    return "[object Object]"


_JS_NUM_RE = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$")


def js_number(v):
    """Number(v)"""
    if v is UNDEF:
        return float("nan")
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, (list, tuple)):
        return js_number(js_string(v))
    if isinstance(v, dict):
        return float("nan")
    s = str(v).strip()
    if s == "":
        return 0.0
    if _JS_NUM_RE.match(s):
        return float(s)
    m = re.match(r"^0([xXoObB])([0-9a-fA-F]+)$", s)
    if m:
        try:
            return float(int(m.group(2), {"x": 16, "o": 8, "b": 2}[m.group(1).lower()]))
        except ValueError:
            return float("nan")
    if s in ("Infinity", "+Infinity"):
        return float("inf")
    if s == "-Infinity":
        return float("-inf")
    return float("nan")


def nullish(v, default):
    """v ?? default"""
    return default if v is None or v is UNDEF else v


def get(obj, key):
    """obj?.key"""
    if isinstance(obj, dict):
        return obj.get(key, UNDEF)
    return UNDEF


def is_object(v):
    """typeof v === 'object' && v !== null"""
    return isinstance(v, (dict, list))


# ---------- args ----------
def parse_args(argv):
    a = {"dir": "evals", "gate": False, "quiet": False, "pass_threshold": None,
         "holdout_threshold": None, "help": False}
    i = 0

    def value(k):
        nonlocal i
        i += 1
        if i >= len(argv):
            die("missing value for %s" % k)
        return argv[i]

    while i < len(argv):
        k = argv[i]
        if k == "--dir":
            a["dir"] = value(k)
        elif k == "--gate":
            a["gate"] = True
        elif k == "--quiet":
            a["quiet"] = True
        elif k in ("--pass-threshold", "--holdout-threshold"):
            n = js_number(value(k))
            if math.isnan(n):
                die("%s needs a number between 0 and 1, got %s" % (k, argv[i]))
            a["pass_threshold" if k == "--pass-threshold" else "holdout_threshold"] = n
        elif k in ("--help", "-h"):
            a["help"] = True
        else:
            die("Unknown argument: %s" % k)
        i += 1
    return a


# ---------- minimal YAML subset parser ----------
# Supports: `key: value` maps nested by indentation (spaces only), `#` comments,
# scalars: numbers, true/false, null/~, "double" or 'single' quoted strings, bare strings.
# NOT supported: lists, multi-line strings (| >), anchors, flow maps/arrays, tabs.
_KEY_RE = re.compile(r"^([A-Za-z0-9_.-]+)\s*:\s*(.*)$")


def parse_yaml_subset(text):
    root = {}
    stack = [(-1, root)]
    lines = re.sub(r"\r\n?", "\n", text).split("\n")
    for n, raw_line in enumerate(lines):
        line = re.sub(r"\s+$", "", strip_comment(raw_line))
        if not line.strip():
            continue
        if raw_line.startswith("\t"):
            raise ValueError("config.yaml line %d: tabs are not allowed, use spaces" % (n + 1))
        indent = len(line) - len(line.lstrip(" "))
        m = _KEY_RE.match(line.strip())
        if not m:
            raise ValueError('config.yaml line %d: expected "key: value" (lists and multi-line values are not supported)' % (n + 1))
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        key, raw_val = m.group(1), m.group(2)
        if raw_val == "":
            parent[key] = {}
            stack.append((indent, parent[key]))
        else:
            parent[key] = scalar(raw_val)
    return root


def strip_comment(s):
    q = None
    for i, c in enumerate(s):
        if q:
            if c == q:
                q = None
            continue
        if c in ('"', "'"):
            q = c
        elif c == "#" and (i == 0 or s[i - 1].isspace()):
            return s[:i]
    return s


def scalar(v):
    v = v.strip()
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        inner = v[1:-1]
        if v[0] == '"':
            return inner.replace('\\"', '"').replace("\\\\", "\\")
        return inner.replace("''", "'")
    if re.match(r"^(true|false)$", v, re.I):
        return v.lower() == "true"
    if re.match(r"^(null|~)$", v, re.I):
        return None
    if re.match(r"^-?[0-9]+(\.[0-9]+)?$", v):
        f = float(v)
        return int(f) if f.is_integer() and abs(f) < 2 ** 53 else f
    return v


# ---------- data loading ----------
def _no_nan(c):
    raise ValueError("unexpected token %s" % c)


def json_loads(s):
    return json.loads(s, parse_constant=_no_nan)


def read_jsonl(file):
    if not os.path.exists(file):
        return None
    out = []
    with open(file, "r", encoding="utf-8-sig") as f:
        text = f.read()
    for i, l in enumerate(re.split(r"\r?\n", text)):
        if not l.strip() or l.strip().startswith("//"):
            continue
        try:
            out.append(json_loads(l))
        except ValueError as e:
            die("%s line %d: invalid JSON (%s)" % (file, i + 1, e))
    for i, c in enumerate(out):
        if isinstance(c, dict) and c.get("id") is None:
            c["id"] = "case-%d" % (i + 1)
    return out


# ---------- target invocation ----------
def split_command(cmd):
    out, cur, q, has = [], "", None, False
    for c in cmd:
        if q:
            if c == q:
                q = None
            else:
                cur += c
            continue
        if c in ('"', "'"):
            q = c
            has = True
            continue
        if c.isspace():
            if cur or has:
                out.append(cur)
                cur, has = "", False
            continue
        cur += c
    if cur or has:
        out.append(cur)
    return out


def resolve_exe(argv):
    """`node` -> node on PATH, `python`/`python3`/`py` -> this interpreter (avoids Windows Store stubs)."""
    if not argv:
        return argv
    argv = list(argv)
    if argv[0] in ("python", "python3", "py") and sys.executable:
        argv[0] = sys.executable
    else:
        found = shutil.which(argv[0])
        if found:
            argv[0] = found
    return argv


def input_to_string(inp):
    if isinstance(inp, str):
        return inp
    s = js_stringify(inp)
    return "" if s is UNDEF else s


def run_process(argv, stdin=None, cwd=None, timeout_ms=30000, shell=False):
    started = time.perf_counter()

    def ms():
        return int((time.perf_counter() - started) * 1000)

    try:
        if shell:
            p = subprocess.Popen(" ".join(argv), shell=True, cwd=cwd, stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        else:
            p = subprocess.Popen(resolve_exe(argv), cwd=cwd, stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        return {"error": "spawn %s ENOENT" % (argv[0] if argv else ""), "ms": ms()}
    except OSError as e:
        return {"error": str(e), "ms": ms()}
    data = (stdin if stdin is not None else "").encode("utf-8")
    try:
        out, err = p.communicate(input=data, timeout=timeout_ms / 1000.0)
    except subprocess.TimeoutExpired:
        p.kill()
        try:
            p.communicate(timeout=5)
        except Exception:
            pass
        return {"error": "timeout after %s ms" % js_num_str(timeout_ms), "ms": ms()}
    stdout = out.decode("utf-8", errors="replace")
    stderr = err.decode("utf-8", errors="replace")
    if p.returncode != 0:
        return {"error": "exit code %d: %s" % (p.returncode, stderr.strip()[:300]), "stdout": stdout, "ms": ms()}
    return {"stdout": stdout, "ms": ms()}


def timeout_of(cfg):
    t = js_number(nullish(get(cfg, "timeout_ms"), 30000))
    return int(t) if not math.isnan(t) and t.is_integer() else t


def call_target(cfg, inp, ctx):
    t = get(cfg, "target")
    t = t if isinstance(t, dict) else {}
    typ = t.get("type") or "command"
    timeout_ms = timeout_of(cfg)
    if typ == "http":
        if not t.get("url"):
            die("target.url is required for target.type: http")
        started = time.perf_counter()
        body = js_stringify({"input": inp}).encode("utf-8")
        req = urllib.request.Request(str(t["url"]), data=body, method="POST",
                                     headers={"content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout_ms / 1000.0) as res:
                text = res.read().decode("utf-8", errors="replace")
            return {"stdout": text, "ms": int((time.perf_counter() - started) * 1000)}
        except urllib.error.HTTPError as e:
            text = e.read().decode("utf-8", errors="replace")
            return {"error": "HTTP %d: %s" % (e.code, text[:300]), "ms": int((time.perf_counter() - started) * 1000)}
        except Exception as e:  # URLError, timeout, connection reset
            reason = getattr(e, "reason", e)
            msg = "timeout after %s ms" % js_num_str(timeout_ms) if "timed out" in str(reason) else str(reason)
            return {"error": msg, "ms": int((time.perf_counter() - started) * 1000)}
    if typ == "script":
        if not t.get("script"):
            die("target.script is required for target.type: script")
        script = str(t["script"])
        argv = [sys.executable, script] if script.lower().endswith(".py") else ["node", script]
    elif typ == "command":
        if not t.get("command"):
            die("target.command is required for target.type: command")
        argv = split_command(js_string(t["command"]))
    else:
        die('unknown target.type "%s" (use command | script | http)' % js_string(typ))
    mode = t.get("input_mode") or "stdin"
    s = input_to_string(inp)
    if mode == "arg":
        argv = argv + [s]
    return run_process(argv, stdin=s if mode == "stdin" else None, cwd=ctx["project_dir"],
                       timeout_ms=timeout_ms, shell=t.get("shell") is True)


# ---------- graders ----------
def get_path(obj, p):
    if not p:
        return obj
    o = obj
    for k in js_string(p).split("."):
        if o is None or o is UNDEF:
            return UNDEF
        if isinstance(o, dict):
            o = o.get(k, UNDEF)
        elif isinstance(o, (list, str)):
            if k == "length":
                o = len(o)
            elif re.match(r"^(0|[1-9][0-9]*)$", k) and int(k) < len(o):
                o = o[int(k)]
            else:
                o = UNDEF
        else:
            o = UNDEF
    return o


def js_str(v):
    """str() helper from run.mjs: '' for null/undefined, strings as-is, JSON otherwise."""
    if v is None or v is UNDEF:
        return ""
    if isinstance(v, str):
        return v
    s = js_stringify(v)
    return "" if s is UNDEF else s


def norm(s, g):
    x = js_str(s).strip()
    if g.get("ignore_case"):
        x = x.lower()
    return x


def _json_list(items):
    return ", ".join("" if js_stringify(m) is UNDEF else js_stringify(m) for m in items)


def g_exact(actual, expected, g):
    if is_object(expected):
        return {"pass": js_stringify(actual) == js_stringify(expected)}
    return {"pass": norm(actual, g) == norm(expected, g)}


def g_contains(actual, expected, g):
    needles = expected if isinstance(expected, list) else [expected]
    hay = norm(actual, g)
    missing = [n for n in needles if norm(n, g) not in hay]
    return {"pass": not missing, "detail": "missing: " + _json_list(missing) if missing else UNDEF}


def g_not_contains(actual, expected, g):
    needles = expected if isinstance(expected, list) else [expected]
    hay = norm(actual, g)
    found = [n for n in needles if norm(n, g) in hay]
    return {"pass": not found, "detail": "found forbidden: " + _json_list(found) if found else UNDEF}


def js_regex(pattern, flags):
    """Compile a JavaScript-style regex with Python's re (common syntax only)."""
    f = 0
    sticky = False
    for c in flags:
        if c == "i":
            f |= re.IGNORECASE
        elif c == "m":
            f |= re.MULTILINE
        elif c == "s":
            f |= re.DOTALL
        elif c == "y":
            sticky = True
        elif c in "gud":
            pass
        else:
            raise re.error("Invalid flags supplied to RegExp constructor '%s'" % flags)
    pattern = re.sub(r"\(\?<(?![=!])([A-Za-z_][A-Za-z0-9_]*)>", r"(?P<\1>", pattern)
    pattern = re.sub(r"\\k<([A-Za-z_][A-Za-z0-9_]*)>", r"(?P=\1)", pattern)
    return re.compile(pattern, f), sticky


def g_regex(actual, expected, g):
    flags = g.get("flags")
    flags = ("i" if g.get("ignore_case") else "") if flags is None else js_string(flags)
    try:
        rx, sticky = js_regex(js_string(expected), flags)
    except re.error as e:
        return {"pass": False, "detail": "bad regex: %s" % e}
    s = js_str(actual)
    return {"pass": bool(rx.match(s) if sticky else rx.search(s))}


def g_numeric(actual, expected, g):
    a = js_number(actual.strip() if isinstance(actual, str) else actual)
    e = js_number(expected)
    tol = js_number(nullish(g.get("tolerance", UNDEF), 0))
    if math.isnan(a):
        return {"pass": False, "detail": "actual is not a number"}
    diff = abs(a - e)
    diff_r = js_number(js_to_fixed(diff, 6)) if not math.isnan(diff) else diff
    return {"pass": diff <= tol + 1e-12,
            "detail": "|%s - %s| = %s (tolerance %s)" % (js_num_str(a), js_num_str(e), js_num_str(diff_r), js_num_str(tol))}


BUILTINS = {"exact": g_exact, "contains": g_contains, "not_contains": g_not_contains,
            "regex": g_regex, "numeric": g_numeric}

_py_graders = {}

_NODE_GRADER_SHIM = r"""
import { pathToFileURL } from 'node:url';
let s = ''; process.stdin.setEncoding('utf8');
for await (const d of process.stdin) s += d;
const { file, actual, expected, options } = JSON.parse(s);
const mod = await import(pathToFileURL(file).href);
const r = await mod.default(actual, expected, options);
process.stdout.write(JSON.stringify({ pass: !!r.pass, detail: r.detail }));
"""


def run_custom_grader(name, c, actual, raw, g, ctx):
    gdir = os.path.join(ctx["evals_dir"], "graders")
    py_file = os.path.join(gdir, name + ".py")
    mjs_file = os.path.join(gdir, name + ".mjs")
    if os.path.exists(py_file):
        mod = _py_graders.get(py_file)
        if mod is None:
            spec = importlib.util.spec_from_file_location("eval_kit_grader_" + re.sub(r"\W", "_", name), py_file)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            _py_graders[py_file] = mod
        if not hasattr(mod, "grade"):
            raise RuntimeError("graders/%s.py has no grade(case, actual) function" % name)
        r = mod.grade(c, None if actual is UNDEF else actual)
        if isinstance(r, dict):
            return bool(r.get("pass")), r.get("detail", UNDEF)
        if isinstance(r, (tuple, list)):
            return bool(r[0]), (r[1] if len(r) > 1 else UNDEF)
        return bool(r), UNDEF
    if os.path.exists(mjs_file):
        node = shutil.which("node")
        if not node:
            return None, "custom grader graders/%s.mjs needs Node.js on PATH (or port it to graders/%s.py)" % (name, name)
        opts = dict(g)
        opts["case"] = c
        opts["raw"] = raw
        payload = {"file": mjs_file, "actual": actual, "expected": c.get("expected", UNDEF), "options": opts}
        r = run_process([node, "--input-type=module", "-e", _NODE_GRADER_SHIM], stdin=js_stringify(payload),
                        cwd=ctx["project_dir"], timeout_ms=timeout_of(ctx["cfg"]))
        if "error" in r:
            raise RuntimeError("custom grader graders/%s.mjs failed: %s" % (name, r["error"]))
        res = json_loads(r["stdout"])
        return bool(res.get("pass")), res.get("detail", UNDEF)
    return None, "custom grader not found: graders/%s.py or graders/%s.mjs" % (name, name)


def grade(c, out, cfg, ctx):
    cg = c.get("grader")
    if isinstance(cg, str):
        g = {"type": cg}
    else:
        g = {"type": "exact"}
        if isinstance(cg, dict):
            g.update(cg)
    gtype = js_string(g.get("type"))
    expected = c.get("expected", UNDEF)
    if "error" in out:
        return {"status": "fail", "grader": gtype, "detail": "target error: %s" % out["error"], "actual": nullish(out.get("stdout"), "")}
    raw = js_string(nullish(out.get("stdout"), "")).strip()
    try:
        parsed = json_loads(raw)
    except ValueError:
        parsed = UNDEF
    field = g.get("field")
    if field:
        actual = get_path(parsed, field)
    elif is_object(expected) and parsed is not UNDEF:
        actual = parsed
    else:
        actual = raw
    if field and parsed is UNDEF:
        return {"status": "fail", "grader": gtype, "detail": 'grader wants field "%s" but output is not JSON' % js_string(field), "actual": raw}

    if gtype == "llm_judge":
        judge = get(get(cfg, "judge"), "command")
        if not judge:
            return {"status": "skipped", "grader": gtype, "detail": "no judge.command configured", "actual": actual}
        rubric_file = os.path.join(ctx["evals_dir"], g.get("rubric") or "graders/rubric.md")
        rubric = ""
        if os.path.exists(rubric_file):
            with open(rubric_file, "r", encoding="utf-8") as f:
                rubric = f.read()
        argv = split_command(js_string(judge))
        payload = {"rubric": rubric, "input": c.get("input", UNDEF), "expected": expected, "actual": actual}
        to = timeout_of(cfg)
        r = run_process(argv, stdin=js_stringify(payload), cwd=ctx["project_dir"],
                        timeout_ms=to * 2, shell=get(get(cfg, "judge"), "shell") is True)
        if "error" in r:
            return {"status": "fail", "grader": gtype, "detail": "judge error: %s" % r["error"], "actual": actual}
        verdict = r["stdout"].strip()
        try:
            v = json_loads(verdict)
            p = get(v, "pass")
            ok = bool(p) or (isinstance(p, (dict, list)))
        except ValueError:
            ok = bool(re.match(r"^\s*PASS\b", verdict, re.I))
        return {"status": "pass" if ok else "fail", "grader": gtype, "detail": verdict[:300], "actual": actual}

    if gtype.startswith("custom:"):
        ok, detail = run_custom_grader(gtype[7:], c, actual, raw, g, ctx)
        if ok is None:
            return {"status": "fail", "grader": gtype, "detail": detail, "actual": actual}
        return {"status": "pass" if ok else "fail", "grader": gtype, "detail": detail, "actual": actual}

    fn = BUILTINS.get(gtype)
    if not fn:
        return {"status": "fail", "grader": gtype, "detail": 'unknown grader "%s"' % gtype, "actual": actual}
    r = fn(actual, expected, g)
    return {"status": "pass" if r["pass"] else "fail", "grader": gtype, "detail": r.get("detail", UNDEF), "actual": actual}


# ---------- running a set ----------
def run_set(name, cases, cfg, ctx, quiet):
    results = []
    for c in cases:
        out = call_target(cfg, c.get("input", UNDEF), ctx)
        g = grade(c, out, cfg, ctx)
        results.append({"id": c.get("id"), "set": name, "tags": c.get("tags") or [], "input": c.get("input", UNDEF),
                        "expected": c.get("expected", UNDEF), "actual": g["actual"], "grader": g["grader"],
                        "status": g["status"], "detail": g.get("detail", UNDEF), "ms": out.get("ms", UNDEF)})
        if not quiet:
            label = "PASS" if g["status"] == "pass" else "SKIP" if g["status"] == "skipped" else "FAIL"
            print("  %s  [%s] %s" % (label, name, js_string(c.get("id"))), flush=True)
    return results


def summarize(results):
    graded = [r for r in results if r["status"] != "skipped"]
    passed = len([r for r in graded if r["status"] == "pass"])
    return {"total": len(results), "graded": len(graded), "passed": passed, "failed": len(graded) - passed,
            "skipped": len(results) - len(graded), "rate": passed / len(graded) if graded else 0}


def by_tag(results):
    m = {}
    for r in results:
        for t in (r["tags"] if len(r["tags"]) else ["(untagged)"]):
            m.setdefault(js_string(t), []).append(r)
    return [(t, summarize(rs)) for t, rs in sorted(m.items(), key=lambda kv: kv[0] + ",")]


# ---------- report helpers ----------
def pct(x):
    return "%s%%" % js_to_fixed(x * 100, 1)


def fence(s):
    t = js_str(s)
    return "```\n" + t.replace("```", "`​``") + "\n```"


def diff_block(expected, actual):
    e = js_str(expected)
    a = js_str(actual)
    i = 0
    while i < len(e) and i < len(a) and e[i] == a[i]:
        i += 1
    lines = ["```diff"] + ["- " + l for l in e.split("\n")] + ["+ " + l for l in a.split("\n")] + ["```"]
    where = "values are identical as strings (check grader settings)" if e == a else "first difference at character %d" % i
    return "%s\n_%s_" % ("\n".join(lines), where)


def timestamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    return now.strftime("%Y-%m-%dT%H-%M-%S-") + "%03dZ" % (now.microsecond // 1000)


def latest_run(runs_dir):
    if not os.path.isdir(runs_dir):
        return None
    files = sorted(f for f in os.listdir(runs_dir) if f.endswith(".json"))
    if not files:
        return None
    try:
        with open(os.path.join(runs_dir, files[-1]), "r", encoding="utf-8") as f:
            return {"file": files[-1], "data": json_loads(f.read())}
    except (ValueError, OSError):
        return None


def target_line(cfg):
    t = get(cfg, "target")
    what = get(t, "command") or get(t, "script") or get(t, "url") or ""
    return ("- Target: `%s` %s" % (js_string(get(t, "type") or "command"), js_string(what))).rstrip()


def ids(xs):
    return ", ".join("`%s`" % js_string(x) for x in xs) if xs else "none"


def render_report(cfg, s, results, prev, ts):
    L = []
    L += ["# Eval report", "", "- Run: `%s`" % ts, target_line(cfg),
          "- Set: golden (holdout is sealed; only `--gate` uses it)", ""]
    thr = js_number(nullish(get(cfg, "pass_threshold"), 0))
    L += ["## Summary", "", "| Metric | Value |", "|---|---|",
          "| Pass rate | **%s** (%d/%d) |" % (pct(s["rate"]), s["passed"], s["graded"]),
          "| Failed | %d |" % s["failed"], "| Skipped (e.g. LLM judge not configured) | %d |" % s["skipped"],
          "| pass_threshold | %s -> %s |" % (pct(thr), "meets threshold" if s["rate"] >= thr else "BELOW threshold"), ""]
    L += ["## Comparison with previous run", ""]
    if not prev:
        L += ["_No previous run found in `runs/`. This run is the baseline._", ""]
    else:
        ps = prev["data"]["summary"]
        delta = s["rate"] - ps["rate"]
        prev_map = {}
        for r in prev["data"]["results"]:
            prev_map[r["id"]] = r.get("status")
        result_ids = set(r["id"] for r in results)
        newly_failing = [r["id"] for r in results if r["status"] == "fail" and prev_map.get(r["id"]) == "pass"]
        fixed = [r["id"] for r in results if r["status"] == "pass" and prev_map.get(r["id"]) == "fail"]
        added = [r["id"] for r in results if r["id"] not in prev_map]
        removed = [i for i in prev_map if i not in result_ids]
        L += ["Previous run: `%s`" % prev["file"], "", "| | Previous | Now | Delta |", "|---|---|---|---|",
              "| Pass rate | %s | %s | %s%s pts |" % (pct(ps["rate"]), pct(s["rate"]), "+" if delta >= 0 else "", js_to_fixed(delta * 100, 1)),
              "| Passed / graded | %s/%s | %d/%d | |" % (js_string(ps["passed"]), js_string(ps["graded"]), s["passed"], s["graded"]), "",
              "- Regressions (passed before, fail now): %s" % ids(newly_failing),
              "- Fixed (failed before, pass now): %s" % ids(fixed),
              "- New cases: %s" % ids(added),
              "- Removed cases: %s" % ids(removed), ""]
    L += ["## By tag", "", "| Tag | Pass rate | Passed/graded |", "|---|---|---|"]
    for t, ts2 in by_tag(results):
        L.append("| %s | %s | %d/%d |" % (t, pct(ts2["rate"]), ts2["passed"], ts2["graded"]))
    L.append("")
    fails = [r for r in results if r["status"] == "fail"]
    L += ["## Failures (%d)" % len(fails), ""]
    if not fails:
        L += ["_None._", ""]
    for r in fails:
        tags = ", tags: %s" % ", ".join(js_string(t) for t in r["tags"]) if len(r["tags"]) else ""
        L += ["### `%s` (grader: %s%s)" % (js_string(r["id"]), r["grader"], tags), "", "**Input**", "", fence(r["input"]), "",
              "**Expected vs actual**", "", diff_block(r["expected"], r["actual"]), ""]
        if r["detail"]:
            L += ["Detail: %s" % js_string(r["detail"]), ""]
    skipped = [r for r in results if r["status"] == "skipped"]
    if skipped:
        L += ["## Skipped (%d)" % len(skipped), ""]
        for r in skipped:
            L.append("- `%s`: %s" % (js_string(r["id"]), js_string(r["detail"])))
        L.append("")
    L += ["## All cases", "", "| Case | Grader | Result | ms |", "|---|---|---|---|"]
    for r in results:
        L.append("| `%s` | %s | %s | %s |" % (js_string(r["id"]), r["grader"], r["status"].upper(), js_str(r["ms"])))
    L.append("")
    return "\n".join(L)


def render_gate(cfg, gs, hs, golden, holdout, thr, hthr, verdict, ts):
    L = []
    L += ["# Release gate: %s" % verdict, "", "- Run: `%s`" % ts, target_line(cfg), ""]
    L += ["| Set | Pass rate | Passed/graded | Skipped | Threshold | Result |", "|---|---|---|---|---|---|",
          "| golden | %s | %d/%d | %d | %s | %s |" % (pct(gs["rate"]), gs["passed"], gs["graded"], gs["skipped"], pct(thr),
                                                    "PASS" if gs["rate"] >= thr and gs["graded"] else "FAIL"),
          "| holdout (sealed) | %s | %d/%d | %d | %s | %s |" % (pct(hs["rate"]) if hs["graded"] else "n/a", hs["passed"], hs["graded"],
                                                              hs["skipped"], pct(hthr), "PASS" if hs["graded"] and hs["rate"] >= hthr else "FAIL"), ""]
    gap = gs["rate"] - hs["rate"]
    if hs["graded"] and gap > 0.1:
        L += ["> Warning: golden beats holdout by %s pts. The feature may be overfit to the golden set." % js_to_fixed(gap * 100, 1), ""]
    gf = [r for r in golden if r["status"] == "fail"]
    L += ["## Golden failures (%d)" % len(gf), ""]
    if not gf:
        L.append("_None._")
    for r in gf:
        L.append("- `%s` (%s): expected `%s`, got `%s`" % (js_string(r["id"]), r["grader"], js_str(r["expected"]),
                                                          js_str(r["actual"]).replace("\n", " ")[:200]))
    hf = [r for r in holdout if r["status"] == "fail"]
    L += ["", "## Holdout failures (%d)" % len(hf), "",
          "_Holdout inputs and expected outputs are intentionally not printed, so they do not leak into prompt or code tuning. Only IDs and tags are shown._", ""]
    for r in hf:
        tags = " (tags: %s)" % ", ".join(js_string(t) for t in r["tags"]) if len(r["tags"]) else ""
        L.append("- `%s`%s" % (js_string(r["id"]), tags))
    L += ["", "Exit code: %d" % (0 if verdict == "PASS" else 1), ""]
    return "\n".join(L)


def write_text(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


# ---------- main ----------
def main():
    args = parse_args(sys.argv[1:])
    if args["help"]:
        print(__doc__.strip())
        return 0
    evals_dir = os.path.abspath(args["dir"])
    project_dir = os.path.dirname(evals_dir)
    cfg_file = os.path.join(evals_dir, "config.yaml")
    if not os.path.exists(cfg_file):
        die("no config.yaml in %s. Run /eval-kit:init first." % evals_dir)
    try:
        with open(cfg_file, "r", encoding="utf-8-sig") as f:
            cfg = parse_yaml_subset(f.read())
    except ValueError as e:
        die(str(e))
    thr = args["pass_threshold"] if args["pass_threshold"] is not None else js_number(nullish(get(cfg, "pass_threshold"), 0.8))
    hthr = args["holdout_threshold"] if args["holdout_threshold"] is not None else js_number(nullish(get(cfg, "holdout_threshold"), thr))
    golden = read_jsonl(os.path.join(evals_dir, "golden.jsonl"))
    if not golden:
        die("golden.jsonl missing or empty in %s" % evals_dir)
    ctx = {"evals_dir": evals_dir, "project_dir": project_dir, "cfg": cfg}
    ts = timestamp()

    if not args["gate"]:
        if not args["quiet"]:
            print("eval-kit: running %d golden cases" % len(golden), flush=True)
        results = run_set("golden", golden, cfg, ctx, args["quiet"])
        s = summarize(results)
        runs_dir = os.path.join(evals_dir, "runs")
        prev = latest_run(runs_dir)
        os.makedirs(runs_dir, exist_ok=True)
        rcfg = dict(cfg)
        rcfg["pass_threshold"] = thr
        write_text(os.path.join(evals_dir, "report.md"), render_report(rcfg, s, results, prev, ts))
        write_text(os.path.join(runs_dir, ts + ".json"),
                   js_stringify({"timestamp": ts, "set": "golden", "summary": s, "results": results}, indent=2))
        print("eval-kit: golden pass rate %s (%d/%d, %d skipped)" % (pct(s["rate"]), s["passed"], s["graded"], s["skipped"])
              + (", previous %s" % pct(prev["data"]["summary"]["rate"]) if prev else ", no previous run"))
        print("eval-kit: wrote %s and runs/%s.json" % (os.path.join(evals_dir, "report.md"), ts))
        return 0

    holdout = read_jsonl(os.path.join(evals_dir, "holdout.jsonl")) or []
    if not args["quiet"]:
        print("eval-kit gate: %d golden + %d holdout cases" % (len(golden), len(holdout)), flush=True)
    gr = run_set("golden", golden, cfg, ctx, args["quiet"])
    hr = run_set("holdout", holdout, cfg, ctx, args["quiet"])
    gs = summarize(gr)
    hs = summarize(hr)
    ok = gs["graded"] > 0 and gs["rate"] >= thr and hs["graded"] > 0 and hs["rate"] >= hthr
    verdict = "PASS" if ok else "FAIL"
    write_text(os.path.join(evals_dir, "gate.md"), render_gate(cfg, gs, hs, gr, hr, thr, hthr, verdict, ts))
    print("eval-kit gate: %s  golden %s (>= %s?)  holdout %s (>= %s?)" % (
        verdict, pct(gs["rate"]), pct(thr), pct(hs["rate"]) if hs["graded"] else "n/a", pct(hthr)))
    print("eval-kit: wrote %s" % os.path.join(evals_dir, "gate.md"))
    return 0 if ok else 1


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    try:
        code = main()
    except SystemExit:
        raise
    except Exception as e:  # mirror run.mjs: unexpected errors exit 2
        import traceback
        sys.stderr.write("eval-kit: %s\n" % "".join(traceback.format_exception(type(e), e, e.__traceback__)).strip())
        sys.exit(2)
    sys.exit(code)
