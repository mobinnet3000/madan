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


# ── توابع مجاز ──────────────────────────────────────────────────────────
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


def _domain():
    raise FormulaError("مقدار ورودی تابع خارج از دامنه‌ی تعریف است.")


def _num(value):
    if isinstance(value, bool):
        raise FormulaError("مقدار بولی مجاز نیست.")
    if isinstance(value, (int, float)):
        return float(value)
    raise FormulaError(f"مقدار «{value!r}» عددی نیست.")


# ── Lexer ────────────────────────────────────────────────────────────────
_TOKEN_RE = re.compile(
    r"""
    \s*(?:
        (?P<NUMBER>\d+\.\d+|\d+\.|\.\d+|\d+)
      | (?P<NAME>[A-Za-z_\u0600-\u06FF][A-Za-z0-9_\u0600-\u06FF]*)
      | (?P<OP>[+\-*/%^(),.<>=!])
    )
""",
    re.VERBOSE,
)


class Token:
    __slots__ = ("kind", "value")

    def __init__(self, kind, value):
        self.kind = kind
        self.value = value


def _tokenize(expr):
    tokens = []
    pos = 0
    n = len(expr)
    while pos < n:
        m = _TOKEN_RE.match(expr, pos)
        if not m or m.end() == pos:
            raise FormulaError(f"کاراکتر نامعتبر در فرمول: «{expr[pos]}»")
        pos = m.end()
        kind = m.lastgroup
        if kind == "NUMBER":
            tokens.append(Token("NUM", float(m.group(kind))))
        elif kind == "NAME":
            tokens.append(Token("NAME", m.group(kind)))
        else:
            tokens.append(Token("OP", m.group(kind)))
    tokens.append(Token("EOF", None))
    return tokens


# ── Parser (AST) ─────────────────────────────────────────────────────────
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
        self.expr = expr
        self.tokens = _tokenize(expr)
        self.index = 0

    # helpers
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

    # grammar:
    #   expr      = comparison
    #   comparison= additive (('=='|'!='|'<'|'<='|'>'|'>=') additive)*
    #   additive  = multiplicative (('+'|'-') multiplicative)*
    #   multiplicative = unary (('*'|'/'|'%') unary)*
    def parse(self):
        node = self._comparison()
        if self._peek().kind != "EOF":
            raise FormulaError("عبارت اضافی در انتهای فرمول یافت شد.")
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
                    raise FormulaError("عملگر مقایسه ناقص است.")
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
            node = self._comparison()
            self._expect_op(")")
            return node
        if tok.kind == "NAME":
            name = self._expect_name()
            # مسیر نقطه‌ای: position.input یا output
            parts = [name]
            while True:
                tok = self._peek()
                if tok.kind == "OP" and tok.value == ".":
                    self._next()
                    parts.append(self._expect_name())
                else:
                    break
            # تابع؟
            if self._peek().kind == "OP" and self._peek().value == "(":
                self._next()
                args = []
                if not (self._peek().kind == "OP" and self._peek().value == ")"):
                    args.append(self._comparison())
                    while self._peek().kind == "OP" and self._peek().value == ",":
                        self._next()
                        args.append(self._comparison())
                self._expect_op(")")
                if len(parts) != 1 or parts[0] not in _FUNCTIONS:
                    raise FormulaError(f"تابع ناشناخته «{parts[0]}» در فرمول.")
                return Node("CALL", parts[0], left=args)
            return Node("VAR", ".".join(parts))
        raise FormulaError(f"عبارت نامعتبر در فرمول: «{tok.value}»")

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
                raise FormulaError(f"متغیر «{node.value}» در این آنالیز وجود ندارد.")
            return _num(env[node.value])
        if kind == "UNARY":
            v = self._eval(node.left, env)
            return -v if node.value == "-" else v
        if kind == "BINOP":
            left = self._eval(node.left, env)
            right = self._eval(node.right, env)
            op = node.value
            if op == "+":
                return left + right
            if op == "-":
                return left - right
            if op == "*":
                return left * right
            if op == "/":
                if right == 0:
                    raise FormulaError("تقسیم بر صفر در فرمول.")
                return left / right
            if op == "%":
                if right == 0:
                    raise FormulaError("تقسیم بر صفر در فرمول.")
                return left % right
            if op == "^":
                return left**right
            if op == "==":
                return 1.0 if left == right else 0.0
            if op == "!=":
                return 1.0 if left != right else 0.0
            if op == "<":
                return 1.0 if left < right else 0.0
            if op == "<=":
                return 1.0 if left <= right else 0.0
            if op == ">":
                return 1.0 if left > right else 0.0
            if op == ">=":
                return 1.0 if left >= right else 0.0
        if kind == "CALL":
            fn = _FUNCTIONS[node.value]
            args = [self._eval(a, env) for a in node.left]
            try:
                return _num(fn(*args))
            except FormulaError:
                raise
            except (ValueError, ZeroDivisionError, OverflowError):
                raise FormulaError(f"خطا در محاسبه‌ی تابع «{node.value}».")
        raise FormulaError("گره ناشناخته در فرمول.")


def validate_expr(expr):
    """اعتبارسنجی نحوی فرمول؛ در صورت نامعتبر FormulaError پرتاب می‌کند."""
    if not expr or not str(expr).strip():
        raise FormulaError("فرمول خالی است.")
    FormulaParser(str(expr)).parse()


def variables(expr):
    """متغیرهای استفاده‌شده در فرمول را برمی‌گرداند (لیست مسیر کامل)."""
    return FormulaParser(str(expr)).variables()


def evaluate(expr, env):
    """ارزیابی امن فرمول با محیط مقادیر (dict از نام متغیر به عدد)."""
    return FormulaParser(str(expr)).evaluate(env)
