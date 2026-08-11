import io

SEC = "# \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 \u062a\u0646\u0627\u0698 \u062a\u062d\u0648\u06cc\u0644\u06cc \u062e\u0637\u0648\u0637 \u062a\u0648\u0644\u06cc\u062f (\u062a\u0639\u0631\u06cc\u0641\u200c\u0645\u062d\u0648\u0631) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550"

FIXES = {
    "machines/views.py": {
        1505: SEC,
        1517: '            return _error("\u0634\u0645\u0627 \u0627\u062c\u0627\u0632\u0647\u200c\u06cc \u0645\u062f\u06cc\u0631\u06cc\u062a \u062a\u0639\u0631\u06cc\u0641\u200c\u0647\u0627 \u0631\u0627 \u0646\u062f\u0627\u0631\u06cc\u062f.", status.HTTP_403_FORBIDDEN)',
        1520: '        return Response({"detail": "\u062a\u0639\u0631\u06cc\u0641 \u062a\u0646\u0627\u0698 \u062a\u062d\u0648\u06cc\u0644\u06cc \u062e\u0637 \u062d\u0630\u0641 \u0634\u062f."})',
        1524: '            return _error("\u0634\u0645\u0627 \u0627\u062c\u0627\u0632\u0647\u200c\u06cc \u0645\u062f\u06cc\u0631\u06cc\u062a \u062a\u0639\u0631\u06cc\u0641\u200c\u0647\u0627 \u0631\u0627 \u0646\u062f\u0627\u0631\u06cc\u062f.", status.HTTP_403_FORBIDDEN)',
        1554: '            return _error("\u0634\u0645\u0627 \u0627\u062c\u0627\u0632\u0647\u200c\u06cc \u0645\u062f\u06cc\u0631\u06cc\u062a \u062a\u0639\u0631\u06cc\u0641\u200c\u0647\u0627 \u0631\u0627 \u0646\u062f\u0627\u0631\u06cc\u062f.", status.HTTP_403_FORBIDDEN)',
        1573: '        return Response({"detail": "\u062d\u0630\u0641 \u0634\u062f."})',
        1590: '            return _error("\u0634\u0645\u0627 \u0627\u062c\u0627\u0632\u0647\u200c\u06cc \u0645\u062f\u06cc\u0631\u06cc\u062a \u062a\u0639\u0631\u06cc\u0641\u200c\u0647\u0627 \u0631\u0627 \u0646\u062f\u0627\u0631\u06cc\u062f.", status.HTTP_403_FORBIDDEN)',
        1617: '        return Response({"detail": "\u062d\u0630\u0641 \u0634\u062f."})',
        1636: '    """\u0627\u0633\u06a9\u06cc\u0645\u0627\u06cc \u0641\u0631\u0645 \u062f\u0627\u06cc\u0646\u0627\u0645\u06cc\u06a9 \u062b\u0628\u062a \u062a\u0646\u0627\u0698 \u06cc\u06a9 \u062e\u0637 (\u0628\u0631 \u0627\u0633\u0627\u0633 \u067e\u0627\u0631\u0627\u0645\u062a\u0631 line)."""',
        1639: '        return _error("\u067e\u0627\u0631\u0627\u0645\u062a\u0631 line \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a.")',
        1651: '        return _error("line_id \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a.")',
    },
    "machines/serializers.py": {
        669: SEC,
        715: '        raise serializers.ValidationError({"inputs": "\u0628\u0627\u06cc\u062f \u06cc\u06a9 \u0644\u06cc\u0633\u062a \u0628\u0627\u0634\u062f."})',
        721: '            raise serializers.ValidationError({"inputs": f"\u0631\u062f\u06cc\u0641 {idx + 1}: \u06a9\u0644\u06cc\u062f (key) \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a."})',
        723: '            raise serializers.ValidationError({"inputs": f"\u06a9\u0644\u06cc\u062f \u062a\u06a9\u0631\u0627\u0631\u06cc \u00ab{key}\u00bb."})',
        744: '        raise serializers.ValidationError({"outputs": "\u0628\u0627\u06cc\u062f \u06cc\u06a9 \u0644\u06cc\u0633\u062a \u0628\u0627\u0634\u062f."})',
        750: '            raise serializers.ValidationError({"outputs": f"\u0631\u062f\u06cc\u0641 {idx + 1}: \u06a9\u0644\u06cc\u062f (key) \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a."})',
        752: '            raise serializers.ValidationError({"outputs": f"\u06a9\u0644\u06cc\u062f \u062a\u06a9\u0631\u0627\u0631\u06cc \u00ab{key}\u00bb."})',
        756: '            raise serializers.ValidationError({"outputs": f"\u0641\u0631\u0645\u0648\u0644 \u062e\u0631\u0648\u062c\u06cc \u00ab{key}\u00bb \u062e\u0627\u0644\u06cc \u0627\u0633\u062a."})',
    },
}

def fix(path, plan):
    lines = open(path, 'rb').read().split(b'\n')
    changed = 0
    for n, new in plan.items():
        old = lines[n - 1]
        try:
            old.decode('utf-8')
            print(path, n, 'WARN: line is valid utf8, skipping?')
            continue
        except UnicodeDecodeError:
            pass
        lines[n - 1] = new.encode('utf-8')
        changed += 1
    open(path, 'wb').write(b'\n'.join(lines))
    print(path, 'fixed lines:', changed)

for p, plan in FIXES.items():
    fix(p, plan)
