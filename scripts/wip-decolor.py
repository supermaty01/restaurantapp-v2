"""Replaces v1's hand-picked colours with the Clay tokens.

v1 chose every colour at the call site — `isDarkMode ? '#B27A4D' : '#905c36'` —
so the palette lived in ~150 scattered ternaries and nothing made two screens
agree on what "muted grey" meant. Each pair below maps to the token that means
the same thing; the class ternaries collapse outright, because a single Clay
class is already correct in both schemes.

One-shot migration, kept in the repo as the record of the mapping. Run with:
    python scripts/wip-decolor.py apps/mobile
"""

import io
import re
import sys
from pathlib import Path

# (dark, light) -> token in lib/design/tokens.ts
COLOUR_PAIRS = {
    ("#1C1C1E", "#FFFFFF"): "surface",
    ("#2A2A2A", "#FFFFFF"): "surface",
    ("#2A2A2A", "#fff"): "surface",
    ("#2A2A2D", "#FFFFFF"): "surface",
    ("#2F2F33", "#F3F4F6"): "sunken",
    ("#3A3A3C", "#E5E7EB"): "line",
    ("#444444", "#E0E0E0"): "line",
    ("#555", "#ccc"): "lineStrong",
    ("#6b7280", "#9ca3af"): "inkSubtle",
    ("#777", "#999"): "inkSubtle",
    ("#888", "#999"): "inkSubtle",
    ("#888", "#666"): "inkMuted",
    ("#9ca3af", "#6b7280"): "inkMuted",
    ("#A1A1AA", "#6B7280"): "inkMuted",
    ("#a0a0a0", "#6b7280"): "inkMuted",
    ("#aaa", "#666"): "inkMuted",
    ("#ccc", "#666"): "inkMuted",
    ("#E0E0E0", "#333333"): "ink",
    ("#E5E7EB", "#111827"): "ink",
    ("#fff", "#000"): "ink",
    ("#fff", "#333"): "ink",
    # v1's two brand colours: the brown accent became the single Clay accent,
    # the green survives only as the category/positive tone.
    ("#B27A4D", "#905c36"): "primary",
    ("#7A9455", "#93AE72"): "sage",
    ("#FFA500", "#F59E0B"): "accent",
}

# Class ternaries whose branches now mean the same thing.
CLASS_TERNARIES = {
    "'bg-dark-card' : 'bg-surface'": "bg-surface",
    "'bg-dark-muted' : 'bg-canvas'": "bg-canvas",
    "'bg-dark-muted border-gray-600' : 'bg-sunken border-line'": "bg-sunken border-line",
    "'h-full bg-dark-primary' : 'h-full bg-primary'": "h-full bg-primary",
    "'text-ink-subtle' : 'text-ink-muted'": "text-ink-muted",
    "'text-on-primary' : 'text-ink'": "text-ink",
    "'bg-surface' : 'bg-sunken'": "bg-sunken",
}

DESTRUCTURE = re.compile(r"const \{([^}]*)\} = useTheme\(\);")


def fix_destructure(text: str) -> str:
    """Keeps the useTheme destructure in step with what the file still uses.

    `isDarkMode` survives where it drives something that is genuinely not a
    colour — the StatusBar style, the moon/sun icon.
    """

    def replace(match: "re.Match[str]") -> str:
        keys = [k.strip() for k in match.group(1).split(",") if k.strip()]
        body = text.replace(match.group(0), "")
        wanted = [k for k in keys if re.search(rf"\b{re.escape(k)}\b", body)]
        if "colors." in body and "colors" not in wanted:
            wanted.append("colors")
        if not wanted:
            return ""
        return "const { " + ", ".join(wanted) + " } = useTheme();"

    return DESTRUCTURE.sub(replace, text)


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "apps/mobile")
    changed = []

    for path in sorted(root.rglob("*.tsx")):
        if "node_modules" in path.parts:
            continue

        original = io.open(path, encoding="utf-8").read()
        text = original

        for (dark, light), token in COLOUR_PAIRS.items():
            text = text.replace(f"isDarkMode ? '{dark}' : '{light}'", f"colors.{token}")

        for ternary, classes in CLASS_TERNARIES.items():
            text = text.replace("${isDarkMode ? " + ternary + "}", classes)
            text = text.replace("isDarkMode ? " + ternary, f"'{classes}'")

        if text == original:
            continue

        text = fix_destructure(text)
        # Tidy the double spaces left inside template literals.
        text = re.sub(
            r"\{`([^`]*?)`\}",
            lambda m: "{`" + re.sub(r" {2,}", " ", m.group(1)).strip() + "`}",
            text,
        )
        text = re.sub(r"\n\n\n+", "\n\n", text)

        io.open(path, "w", encoding="utf-8").write(text)
        changed.append(str(path.relative_to(root)))

    print(f"{len(changed)} ficheros")
    for name in changed:
        print("  ", name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
