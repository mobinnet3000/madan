"""
موتور محاسبه‌ی فرمول امن.

- یک زبان Expression محدود و ایمن (عدد، متغیر، عملگرها و توابع مجاز).
- بدون `eval`/`exec`؛ با lexer + parser دستی و ارزیابی AST.
- متغیرها به صورت `name` (ورودی اضافه/خروجی) یا `position.input` (ورودی موقعیت) پشتیبانی می‌شوند.
- متد `variables(expr)` متغیرهای استفاده‌شده را برمی‌گرداند (برای Validation).
- خطاها از نوع `FormulaError` هستند.
"""

import math
import re

__all__ = ["FormulaError", "validate_expr", "variables", "evaluate", "FormulaParser"]


class FormulaError(ValueError):
    """خطای مربوط به فرمول (پارس، متغیر، محاسبه)."""


MAX_EXPR_LEN = 2000
MAX_TOKENS = 300
MAX_POWER_EXP = 10000
MAX_POWER_BASE = 1e6


def _round(x, ndigits=None):
    if ndigits is None:
        return round(x)
    return round(x, int(ndigits))


_FUNCTIONS = {
    "abs": abs,
    "sqrt": lambda x: math.sqrt(x) if x >= 0 else _domain(),
    "cbrt": lambda x: math.copysign(abs(x) ** (1 / 3), x),
    "pow": pow,
    "min": min,
    "max": max,
    "round": _round,
    "floor": math.floor,
    "ceil": math.ceil,
    "log": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "atan2": math.atan2,
    "sign": lambda x: (x > 0) - (x < 0),
    "if": lambda cond, a, b: a if cond != 0 else b,
}

_FUNCTION_ARITY = {
    "abs": (1, 1),
    "sqrt": (1, 1),
    "cbrt": (1, 1),
    "pow": (2, 2),
    "min": (1, None),
    "max": (1, None),
    "round": (1, 2),
    "floor": (1, 1),
    "ceil": (1, 1),
    "log": (1, 2),
    "log10": (1, 1),
    "exp": (1, 1),
    "sin": (1, 1),
    "cos": (1, 1),
    "tan": (1, 1),
    "asin": (1, 1),
    "acos": (1, 1),
    "atan": (1, 1),
    "atan2": (2, 2),
    "sign": (1, 1),
    "if": (3, 3),
}


def _domain():
    raise FormulaError("مقدار ورودی تابع خارج از دامنه‌ی تعریف است.")


def _num(value):
    if isinstance(value, bool):
        raise FormulaError("مقدار بولی مجاز نیست.")
    if isinstance(value, (int, float)):
        if math.isinf(value) or math.isnan(value):
            raise FormulaError("نتیجه فرمول نامعتبر است (بی‌نهایت/نامشخص).")
        return float(value)
    raise FormulaError(f"مقدار «{value!r}» عددی نیست.")


def _check_number_token(raw):
    try:
        v = float(raw)
    except ValueError:
        raise FormulaError(f"عدد نامعتبر «{raw}» در فرمول.")
    if math.isinf(v) or math.isnan(v):
        raise FormulaError(f"عدد «{raw}» خارج از محدوده مجاز است.")
    if len(raw) > 30:
        raise FormulaError(f"عدد «{raw[:30]}…» بیش از حد طولانی است.")
    return v


def _safe_pow(a, b):
    if abs(b) > MAX_POWER_EXP:
        raise FormulaError(f"توان «{b:g}» خارج از محدوده مجاز (±{MAX_POWER_EXP}) است.")
    if abs(a) > MAX_POWER_BASE and abs(b) > 100:
        raise FormulaError("پایه و توان هم‌زمان بیش از حد بزرگ هستند.")
    if a == 0 and b < 0:
        raise FormulaError("توان منفی برای پایه صفر مجاز نیست.")
    try:
        r = pow(a, b)
    except OverflowError:
        raise FormulaError("نتیجه توان خارج از محدوده عددی است.")
    except ValueError as e:
        raise FormulaError(f"توان نامعتبر: {e}")
    if math.isinf(r) or math.isnan(r):
        raise FormulaError("نتیجه توان نامعتبر است (بی‌نهایت/نامشخص).")
    return r


_TOKEN_RE = re.compile(
    r"""
        (?P<NUMBER>\d+\.\d+|\d+\.|\.\d+|\d+)
      | (?P<NAME>[A-Za-z_\u0600-\u06FF][A-Za-z0-9_\u0600-\u06FF]*)
      | (?P<OP>[+\-*/%^(),.<>=!])
    """,
    re.VERBOSE,
)


class Token:
    __slots__ = ("kind", "value")

    def __init__(self, kind, value):
        self.kind = kind
        self.value = value


def _tokenize(expr):
    expr = str(expr)
    if len(expr) > MAX_EXPR_LEN:
        raise FormulaError(f"طول فرمول بیش از حد مجاز ({MAX_EXPR_LEN} کاراکتر) است.")
    tokens = []
    pos = 0
    n = len(expr)
    while pos < n:
        ch = expr[pos]
        if ch.isspace():
            pos += 1
            continue
        m = _TOKEN_RE.match(expr, pos)
        if not m or m.end() == pos:
            excerpt = expr[pos : pos + 20].split("\n")[0]
            raise FormulaError(f"کاراکتر نامعتبر در فرمول: «{ch}» (حوالی «{excerpt}…»)")
        kind = m.lastgroup
        if kind == "NUMBER":
            raw = m.group(kind)
            val = _check_number_token(raw)
            after = m.end()
            if after < n and expr[after].isalpha():
                bad = raw + re.match(r"[A-Za-z0-9_\u0600-\u06FF]+", expr[after:]).group(0)
                raise FormulaError(f"عدد و نام به هم چسبیده‌اند: «{bad}» — بین آن‌ها عملگر بگذارید (مثلا «{raw}*{bad[len(raw):]}»).")
            tokens.append(Token("NUM", val))
        elif kind == "NAME":
            tokens.append(Token("NAME", m.group(kind)))
        else:
            tokens.append(Token("OP", m.group(kind)))
        pos = m.end()
        if len(tokens) > MAX_TOKENS:
            raise FormulaError(f"فرمول بیش از حد طولانی است (بیش از {MAX_TOKENS} توکن).")
    tokens.append(Token("EOF", None))
    return tokens


class Node:
    __slots__ = ("kind", "value", "left", "right")

    def __init__(self, kind, value=None, left=None, right=None):
        self.kind = kind
        self.value = value
        self.left = left
        self.right = right


class FormulaParser:
    """تجزیه‌ی عبارت به AST. خروجی متغیرها از طریق `variables()` استخراج می‌شود."""

    def __init__(self, expr):
        expr = str(expr).strip()
        if not expr:
            raise FormulaError("فرمول خالی است.")
        self.expr = expr
        self.tokens = _tokenize(expr)
        self.index = 0

    def _peek(self):
        return self.tokens[self.index]

    def _next(self):
        tok = self.tokens[self.index]
        self.index += 1
        return tok

    def _expect_op(self, op):
        tok = self._next()
        if tok.kind != "OP" or tok.value != op:
            raise FormulaError(
                f"در فرمول عبارت «{op}» مورد انتظار بود اما «{tok.value}» آمده است."
            )

    def _expect_name(self):
        tok = self._next()
        if tok.kind != "NAME":
            raise FormulaError("نام متغیر/تابع مورد انتظار بود.")
        return tok.value

    def parse(self):
        node = self._comparison()
        if self._peek().kind != "EOF":
            tok = self._peek()
            raise FormulaError(f"عبارت اضافی در انتهای فرمول یافت شد: «{tok.value}».")
        return node

    def _comparison(self):
        node = self._additive()
        while True:
            tok = self._peek()
            if tok.kind == "OP" and tok.value in ("<", ">"):
                self._next()
                op = tok.value
                nxt = self._peek()
                if nxt.kind == "OP" and nxt.value == "=":
                    self._next()
                    op += "="
                node = Node("BINOP", op, node, self._additive())
            elif tok.kind == "OP" and tok.value in ("=", "!"):
                self._next()
                nxt = self._peek()
                if not (nxt.kind == "OP" and nxt.value == "="):
                    raise FormulaError("عملگر مقایسه ناقص است — باید «==» یا «!=» باشد.")
                self._next()
                op = "==" if tok.value == "=" else "!="
                node = Node("BINOP", op, node, self._additive())
            else:
                break
        return node

    def _additive(self):
        node = self._multiplicative()
        while True:
            tok = self._peek()
            if tok.kind == "OP" and tok.value in ("+", "-"):
                self._next()
                node = Node("BINOP", tok.value, node, self._multiplicative())
            else:
                break
        return node

    def _multiplicative(self):
        node = self._unary()
        while True:
            tok = self._peek()
            if tok.kind == "OP" and tok.value in ("*", "/", "%"):
                self._next()
                node = Node("BINOP", tok.value, node, self._unary())
            else:
                break
        return node

    def _unary(self):
        tok = self._peek()
        if tok.kind == "OP" and tok.value in ("+", "-"):
            self._next()
            return Node("UNARY", tok.value, self._unary())
        return self._power()

    def _power(self):
        node = self._primary()
        tok = self._peek()
        if tok.kind == "OP" and tok.value == "^":
            self._next()
            node = Node("BINOP", "^", node, self._unary())
        return node

    def _primary(self):
        tok = self._peek()
        if tok.kind == "NUM":
            self._next()
            return Node("NUM", tok.value)
        if tok.kind == "OP" and tok.value == "(":
            self._next()
            if self._peek().kind == "OP" and self._peek().value == ")":
                raise FormulaError("پرانتز خالی «()» مجاز نیست.")
            node = self._comparison()
            self._expect_op(")")
            return node
        if tok.kind == "NAME":
            name = self._expect_name()
            parts = [name]
            while True:
                tok = self._peek()
                if tok.kind == "OP" and tok.value == ".":
                    self._next()
                    nxt = self._peek()
                    if nxt.kind != "NAME":
                        raise FormulaError(f"بعد از نقطه «.» در «{'.'.join(parts)}.» نام متغیر مورد انتظار است.")
                    parts.append(self._expect_name())
                    if len(parts) > 2:
                        raise FormulaError(f"مسیر متغیر «{'.'.join(parts)}» نامعتبر است — حداکثر یک نقطه مجاز است (مثلا «position.input»).")
                else:
                    break
            if self._peek().kind == "OP" and self._peek().value == "(":
                self._next()
                args = []
                if not (self._peek().kind == "OP" and self._peek().value == ")"):
                    args.append(self._comparison())
                    while self._peek().kind == "OP" and self._peek().value == ",":
                        self._next()
                        if self._peek().kind == "OP" and self._peek().value == ")":
                            raise FormulaError(f"ویرگول اضافی قبل از «)» در فراخوانی تابع «{parts[0]}».")
                        args.append(self._comparison())
                self._expect_op(")")
                if len(parts) != 1 or parts[0] not in _FUNCTIONS:
                    raise FormulaError(f"تابع ناشناخته «{parts[0]}» در فرمول — توابع مجاز: {', '.join(sorted(_FUNCTIONS))}.")
                lo, hi = _FUNCTION_ARITY[parts[0]]
                if hi is None:
                    if len(args) < lo:
                        raise FormulaError(f"تابع «{parts[0]}» حداقل {lo} آرگومان می‌خواهد ولی {len(args)} داده شده.")
                elif not (lo <= len(args) <= hi):
                    if lo == hi:
                        raise FormulaError(f"تابع «{parts[0]}» دقیقا {lo} آرگومان می‌خواهد ولی {len(args)} داده شده.")
                    raise FormulaError(f"تابع «{parts[0]}» بین {lo} تا {hi} آرگومان می‌خواهد ولی {len(args)} داده شده.")
                return Node("CALL", parts[0], left=args)
            if len(parts) == 2 and not re.match(r"^[A-Za-z_\u0600-\u06FF][A-Za-z0-9_\u0600-\u06FF]*$", parts[1]):
                raise FormulaError(f"نام متغیر «{parts[1]}» در «{'.'.join(parts)}» نامعتبر است.")
            return Node("VAR", ".".join(parts))
        raise FormulaError(f"عبارت نامعتبر در فرمول: «{tok.value}» — عدد، متغیر یا «(» مورد انتظار بود.")

    def variables(self):
        """متغیرهای استفاده‌شده در فرمول (مسیر کامل) را برمی‌گرداند."""
        found = []

        def walk(node):
            if isinstance(node, list):
                for child in node:
                    walk(child)
                return
            if node is None:
                return
            if node.kind == "VAR":
                found.append(node.value)
            walk(node.left)
            walk(node.right)

        ast = self.parse()
        walk(ast)
        return found

    def evaluate(self, env):
        ast = self.parse()
        return self._eval(ast, env)

    def _eval(self, node, env):
        kind = node.kind
        if kind == "NUM":
            return node.value
        if kind == "VAR":
            if node.value not in env:
                raise FormulaError(f"متغیر «{node.value}» در این آنالیز وجود ندارد — مقدار ورودی آن ثبت نشده است.")
            return _num(env[node.value])
        if kind == "UNARY":
            v = self._eval(node.left, env)
            return -v if node.value == "-" else v
        if kind == "BINOP":
            left = self._eval(node.left, env)
            right = self._eval(node.right, env)
            op = node.value
            if op == "+":
                r = left + right
            elif op == "-":
                r = left - right
            elif op == "*":
                r = left * right
            elif op == "/":
                if right == 0:
                    raise FormulaError("تقسیم بر صفر در فرمول.")
                r = left / right
            elif op == "%":
                if right == 0:
                    raise FormulaError("تقسیم بر صفر در فرمول (باقیمانده).")
                r = left % right
            elif op == "^":
                return _safe_pow(left, right)
            elif op == "==":
                return 1.0 if left == right else 0.0
            elif op == "!=":
                return 1.0 if left != right else 0.0
            elif op == "<":
                return 1.0 if left < right else 0.0
            elif op == "<=":
                return 1.0 if left <= right else 0.0
            elif op == ">":
                return 1.0 if left > right else 0.0
            elif op == ">=":
                return 1.0 if left >= right else 0.0
            else:
                raise FormulaError(f"عملگر ناشناخته «{op}».")
            if math.isinf(r) or math.isnan(r):
                raise FormulaError("نتیجه عمل حسابی نامعتبر است (بی‌نهایت/نامشخص).")
            return r
        if kind == "CALL":
            fn = _FUNCTIONS[node.value]
            args = [self._eval(a, env) for a in node.left]
            try:
                res = fn(*args)
            except FormulaError:
                raise
            except (ValueError, ZeroDivisionError, OverflowError) as e:
                raise FormulaError(f"خطا در محاسبه‌ی تابع «{node.value}»: {e}")
            except Exception as e:
                raise FormulaError(f"خطا در تابع «{node.value}»: {type(e).__name__}: {e}")
            return _num(res)
        raise FormulaError("گره ناشناخته در فرمول.")


def validate_expr(expr):
    """اعتبارسنجی نحوی فرمول؛ در صورت نامعتبر FormulaError پرتاب می‌کند."""
    s = str(expr).strip() if expr is not None else ""
    if not s:
        raise FormulaError("فرمول خالی است.")
    FormulaParser(s).parse()


def variables(expr):
    """متغیرهای استفاده‌شده در فرمول را برمی‌گرداند (لیست مسیر کامل)."""
    return FormulaParser(str(expr).strip()).variables()


def evaluate(expr, env):
    """ارزیابی امن فرمول با محیط مقادیر (dict از نام متغیر به عدد)."""
    return FormulaParser(str(expr).strip()).evaluate(env)
