#!/usr/bin/env python3
"""Translate untranslated-*.json via Google Translate and write translated-*.json."""
import json
import re
import sys
import time
from pathlib import Path

try:
    from deep_translator import GoogleTranslator
except ImportError:
    print("Install: pip install deep-translator", file=sys.stderr)
    sys.exit(1)

DATA = Path(__file__).resolve().parent / "data"
LANG_MAP = {
    "es": "es",
    "fr": "fr",
    "de": "de",
    "zh": "zh-CN",
    "ja": "ja",
    "pt": "pt",
    "it": "it",
    "ru": "ru",
    "ar": "ar",
    "ko": "ko",
    "hu": "hu",
}

PH_RE = re.compile(r"(\{\{[^}]+\}\})")


def protect(text: str) -> tuple[str, list[str]]:
    parts = PH_RE.split(text)
    placeholders = [p for p in parts if p.startswith("{{")]
    safe = "".join("__PH{}__".format(i) if p.startswith("{{") else p for i, p in enumerate(parts) if not p.startswith("{{") or True)
    # simpler approach
    placeholders = []
    def repl(m):
        placeholders.append(m.group(0))
        return f"__PH{len(placeholders)-1}__"
    safe = PH_RE.sub(repl, text)
    return safe, placeholders


def restore(text: str, placeholders: list[str]) -> str:
    for i, ph in enumerate(placeholders):
        text = text.replace(f"__PH{i}__", ph)
    return text


def translate_batch(translator: GoogleTranslator, texts: list[str]) -> list[str]:
    if not texts:
        return []
    protected = []
    ph_lists = []
    for t in texts:
        safe, phs = protect(t)
        protected.append(safe)
        ph_lists.append(phs)
    try:
        out = translator.translate_batch(protected)
    except Exception:
        out = []
        for p in protected:
            time.sleep(0.05)
            out.append(translator.translate(p))
    return [restore(o or "", phs) for o, phs in zip(out, ph_lists)]


def main():
    codes = sys.argv[1:] if len(sys.argv) > 1 else list(LANG_MAP.keys())
    batch_size = 40

    # Refresh untranslated-*.json from current locale files (run export-untranslated.ts first if needed).
    import subprocess
    web_root = Path(__file__).resolve().parent.parent
    subprocess.run(
        ["yarn", "tsx", "scripts/export-untranslated.ts"],
        cwd=web_root,
        check=False,
    )

    for code in codes:
        src = DATA / f"untranslated-{code}.json"
        if not src.exists():
            print(f"skip {code}: no {src.name}")
            continue
        items = json.loads(src.read_text(encoding="utf-8"))
        paths = list(items.keys())
        values = [items[p] for p in paths]
        target = LANG_MAP[code]
        translator = GoogleTranslator(source="en", target=target)
        translated: dict[str, str] = {}
        print(f"{code}: translating {len(paths)} strings → {target}…")

        for i in range(0, len(paths), batch_size):
            chunk_paths = paths[i : i + batch_size]
            chunk_vals = values[i : i + batch_size]
            chunk_out = translate_batch(translator, chunk_vals)
            for p, v in zip(chunk_paths, chunk_out):
                translated[p] = v
            print(f"  {min(i + batch_size, len(paths))}/{len(paths)}")
            time.sleep(0.2)

        out_path = DATA / f"translated-{code}.json"
        out_path.write_text(json.dumps(translated, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  wrote {out_path}")


if __name__ == "__main__":
    main()
