"""Regression checks for hardened formula validation (whitespace, overflow, arity)."""

from django.test import TestCase

from .formula import FormulaError, evaluate, validate_expr, variables


class FormulaValidationTests(TestCase):
    def test_trailing_whitespace_accepted(self):
        for c in ["1 + 2 ", "1 + 2\n", " 1 + 2\t"]:
            validate_expr(c)
        self.assertAlmostEqual(evaluate("1 + 2 ", {}), 3.0)

    def test_overflow_never_leaks_raw_exception(self):
        for c in ["2 ^ 10000000000", "10 ^ 400", "0 ^ -1", "9999999999999999999999999999999 * 9999999999999999999999999999999"]:
            with self.assertRaises(FormulaError, msg=c):
                evaluate(c, {})

    def test_function_arity_checked(self):
        for c in ["sin()", "min()", "if(1,2)", "pow(2)", "foo(1)", "max(1,)"]:
            with self.assertRaises(FormulaError, msg=c):
                validate_expr(c)

    def test_malformed_tokens_rejected(self):
        # «a.b.c» معتبر است: مسیر سه‌بخشی = ارجاع بین‌تبی (key.in.key)
        for c in ["2foo", "()", "a.b.c.d", "1 = 2", "a.", "1 $ 2"]:
            with self.assertRaises(FormulaError, msg=c):
                validate_expr(c)

    def test_three_part_path_allowed(self):
        validate_expr("a.b.c")
        self.assertEqual(set(variables("tonnage_delivery.in.tonnage + feed")), {"tonnage_delivery.in.tonnage", "feed"})

    def test_valid_still_works(self):
        self.assertAlmostEqual(evaluate("(feed.fe - tail.fe) / (product.fe - tail.fe) * 100",
                                        {"feed.fe": 52.3, "tail.fe": 9.2, "product.fe": 64.8}),
                               (52.3 - 9.2) / (64.8 - 9.2) * 100, places=6)
        self.assertEqual(set(variables("feed.fe + input_a")), {"feed.fe", "input_a"})
