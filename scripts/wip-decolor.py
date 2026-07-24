"""Replaces `isDarkMode ? '#dark' : '#light'` with a semantic token.

v1 picked colours by hand at every call site, so the palette lived in 147
scattered ternaries and nothing guaranteed two screens agreed on "muted grey".
Each pair below maps to the Clay token that means the same thing.
"""

import io
import re
import sys
from pathlib import Path

PAIRS = {
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
    ("#7A9455", "#93AE72"): "sage",
    ("#888", "#666"): "inkMuted",
    ("#9ca3af", "#6b7280"): "inkMuted",
    ("#A1A1AA", "#6B7280"): "inkMuted",
    ("#a0a0a0", "#6b7280"): "inkMuted",
    ("#aaa", "#666"): "inkMuted",
    ("#ccc", "#666"): "inkMuted",
    ("#B27A4D", "#905c36"): "primary",
    ("#E0E0E0", "#333333"): "ink",
    ("#E5E7EB", "#111827"): "ink",
    ("#fff", "#000"): "ink",
    ("#fff", "#333"): "ink",
    ("#FFA500", "#F59E0B"): "accent",
}

# className ternaries whose two branches now mean the same thing.
CLASS_TERNARIES = {
    "'bg-dark-card' : 'bg-surface'": "bg-surface",
    "'bg-dark-muted' : 'bg-canvas'": "bg-canvas",
    "'bg-dark-muted border-gray-600' : 'bg-sunken border-line'": "bg-sunken border-line",
    "'h-full bg-dark-primary' : 'h-full bg-primary'": "h-full bg-primary",
}

root = Path(sys.argv[1])
changed = []

for path in sorted(root.rglob("*.tsx")):
    if "node_modules" in path.parts:
        continue
    original = io.open(path, encoding="utf-8").read()
    text = original

    for (dark, light), token in PAIRS.items():
        text = text.replace(f"isDarkMode ? '{dark}' : '{light}'", f"colors.{token}")

    for ternary, cls in CLASS_TERNARIES.items():
        # `${isDarkMode ? 'a' : 'b'}` inside a template literal → plain classes
        text = text.replace("${isDarkMode ? " + ternary + "}", cls)
        text = text.replace("isDarkMode ? " + ternary, f"'{cls}'")

    if text == original:
        continue

    # Swap the destructure only when isDarkMode is genuinely gone.
    body = re.sub(r"const \{[^}]*\} = useTheme\(\);", "", text)
    if "isDarkMode" not in body:
        text = re.sub(
            r"const \{ isDarkMode \} = useTheme\(\);",
            "const { colors } = useTheme();",
            text,
        )
    elif "colors" not in re.findall(r"const \{([^}]*)\} = useTheme\(\)", text)[0] if re.findall(r"const \{([^}]*)\} = useTheme\(\)", text) else False:
        pass

    # Files that still need isDarkMode as well as colors.
    if "colors." in text and re.search(r"const \{ isDarkMode \} = useTheme\(\);", text):
        text = re.sub(
            r"const \{ isDarkMode \} = useTheme\(\);",
            "const { isDarkMode, colors } = useTheme();",
            text,
        )

    io.open(path, "w", encoding="utf-8").write(text)
    changed.append(str(path.relative_to(root)))

print(f"{len(changed)} ficheros")
for name in changed:
    print("  ", name)
