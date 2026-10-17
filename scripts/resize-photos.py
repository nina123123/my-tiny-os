#!/usr/bin/env python3
"""
Get the photos in public/ ready to publish.

    python3 scripts/resize-photos.py               # after adding or replacing photos
    python3 scripts/resize-photos.py --force       # rebuild every small copy
    python3 scripts/resize-photos.py --check       # only list images that still carry metadata
    python3 scripts/resize-photos.py --strip-only dist   # only strip metadata, in another folder

1. Hidden metadata. Photos from phones and cameras carry EXIF / XMP / IPTC
   data: GPS position, date and time, device, sometimes names. Every WebP,
   JPEG and PNG in public/ (not just public/media) has it removed in place.
   This is lossless: the image data is copied byte for byte, never
   re-encoded. Colour profiles are kept, and so is a photo's rotation: if it
   relies on an EXIF orientation, a tiny EXIF block holding only that
   orientation is written back. Data hidden after the end of a JPEG (extra
   "multi-picture" images, phone trailers) is dropped too.

2. Small copies. For every public/media/**/<name>.webp it writes
   <name>-640.webp next to it: 640px wide, WebP quality 75 (a straight copy
   when the photo is already 640px wide or less, so the small copy always
   exists). Grid tiles, timeline cards, gallery thumbnails and the dock pick
   the small copy through srcset; project heroes and the lightbox keep the
   full photo. It also writes src/components/photoWidths.ts, the list of
   photos that have a small copy (with their real widths). Photos missing
   from that list simply use the full file, so a photo uploaded without
   running this script still works.

Files that already end in -640 are never treated as sources, small copies are
only rebuilt when their photo is newer, and small copies whose photo was
deleted are removed. Step 2 needs Python 3 with Pillow (pip install pillow);
--check and --strip-only need nothing but Python 3, so the deploy workflow
runs `--strip-only dist` on every build as a safety net for the live site.
A photo that was pushed to GitHub with its metadata keeps it in the repo's
history, so run this script before you commit new photos.
"""

from __future__ import annotations

import os
import shutil
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
MEDIA = PUBLIC / "media"
MANIFEST = ROOT / "src" / "components" / "photoWidths.ts"

SMALL = 640
SUFFIX = f"-{SMALL}"
QUALITY = 75

IMAGE_EXTS = {".webp", ".jpg", ".jpeg", ".png"}


# ── 1. metadata ──────────────────────────────────────────────────────────────

ORIENTATION = 0x0112


def orientation_of(tiff: bytes) -> int:
    """The EXIF orientation (1–8) in a TIFF/EXIF block, or 1 when there is none."""
    if tiff.startswith(b"Exif\x00\x00"):
        tiff = tiff[6:]
    order = {b"II": "<", b"MM": ">"}.get(tiff[:2])
    if not order:
        return 1
    try:
        (ifd,) = struct.unpack_from(order + "I", tiff, 4)
        (count,) = struct.unpack_from(order + "H", tiff, ifd)
        for i in range(count):
            at = ifd + 2 + 12 * i
            tag, kind = struct.unpack_from(order + "HH", tiff, at)
            if tag == ORIENTATION and kind == 3:
                (value,) = struct.unpack_from(order + "H", tiff, at + 8)
                return value if 1 <= value <= 8 else 1
    except struct.error:
        pass
    return 1


def orientation_only(value: int) -> bytes:
    """A minimal little-endian TIFF block that holds nothing but an orientation."""
    return (
        b"II*\x00"
        + struct.pack("<I", 8)
        + struct.pack("<H", 1)
        + struct.pack("<HHIHH", ORIENTATION, 3, 1, value, 0)
        + struct.pack("<I", 0)
    )


def is_orientation_only(tiff: bytes) -> bool:
    if tiff.startswith(b"Exif\x00\x00"):
        tiff = tiff[6:]
    return tiff == orientation_only(orientation_of(tiff))


def strip_webp(data: bytes) -> tuple[bytes, list[str]] | None:
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    (riff_size,) = struct.unpack_from("<I", data, 4)
    end = min(len(data), 8 + riff_size)
    chunks: list[list[bytes]] = []
    removed: list[str] = []
    orientation = 1
    pos = 12
    while pos + 8 <= end:
        fourcc = data[pos : pos + 4]
        (size,) = struct.unpack_from("<I", data, pos + 4)
        body = data[pos + 8 : pos + 8 + size]
        pos += 8 + size + (size & 1)
        if fourcc == b"EXIF" and not is_orientation_only(body):
            orientation = orientation_of(body)
            removed.append("EXIF")
        elif fourcc == b"XMP ":
            removed.append("XMP")
        else:
            chunks.append([fourcc, body])
    if len(data) > end:
        removed.append("trailing data")
    if not removed:
        return None

    vp8x = next((c for c in chunks if c[0] == b"VP8X"), None)
    if orientation != 1 and vp8x is not None:
        chunks.append([b"EXIF", orientation_only(orientation)])
    if vp8x is not None:
        # VP8X flags: ICC 0x20, alpha 0x10, EXIF 0x08, XMP 0x04, animation 0x02
        has_exif = any(c[0] == b"EXIF" for c in chunks)
        flags = (vp8x[1][0] & ~0x0C) | (0x08 if has_exif else 0)
        vp8x[1] = bytes([flags]) + vp8x[1][1:]

    payload = b"WEBP" + b"".join(
        fourcc + struct.pack("<I", len(body)) + body + (b"\x00" if len(body) & 1 else b"") for fourcc, body in chunks
    )
    return b"RIFF" + struct.pack("<I", len(payload)) + payload, removed


def strip_jpeg(data: bytes) -> tuple[bytes, list[str]] | None:
    if data[:2] != b"\xff\xd8":
        return None
    segments: list[tuple[int, bytes]] = []  # (marker, raw bytes including the marker)
    removed: list[str] = []
    orientation = 1
    n = len(data)
    pos = 2
    while True:
        if pos + 1 >= n or data[pos] != 0xFF:
            return None  # not a JPEG this script understands: leave it alone
        while pos + 1 < n and data[pos + 1] == 0xFF:  # fill bytes
            pos += 1
        marker = data[pos + 1]
        if marker == 0xD9:  # end of image
            pos += 2
            break
        if marker == 0x01 or 0xD0 <= marker <= 0xD7:  # markers without a length
            segments.append((marker, data[pos : pos + 2]))
            pos += 2
            continue
        (length,) = struct.unpack_from(">H", data, pos + 2)
        raw = data[pos : pos + 2 + length]
        body = data[pos + 4 : pos + 2 + length]
        pos += 2 + length
        if marker == 0xDA:  # start of scan: the compressed data runs until the next real marker
            scan = pos
            while True:
                pos = data.find(b"\xff", pos)
                if pos < 0 or pos + 1 >= n:
                    return None
                nxt = data[pos + 1]
                if nxt == 0xFF:
                    pos += 1
                elif nxt == 0x00 or 0xD0 <= nxt <= 0xD7:
                    pos += 2
                else:
                    break
            segments.append((marker, raw + data[scan:pos]))
            continue
        if 0xE0 <= marker <= 0xEF or marker == 0xFE:
            keep = (
                marker == 0xE0  # JFIF / JFXX
                or (marker == 0xE2 and body.startswith(b"ICC_PROFILE\x00"))
                or (marker == 0xEE and body.startswith(b"Adobe"))  # colour transform, needed to decode
                or (marker == 0xE1 and body.startswith(b"Exif\x00\x00") and is_orientation_only(body))
            )
            if not keep:
                if marker == 0xE1 and body.startswith(b"Exif\x00\x00"):
                    orientation = orientation_of(body)
                    removed.append("EXIF")
                elif marker == 0xE1 and body.startswith(b"http://ns.adobe.com/"):
                    removed.append("XMP")
                elif marker == 0xED:
                    removed.append("IPTC")
                elif marker == 0xFE:
                    removed.append("comment")
                else:
                    removed.append(f"APP{marker - 0xE0}")
                continue
        segments.append((marker, raw))
    if pos < n:
        removed.append("trailing data")
    if not removed:
        return None

    out = bytearray(b"\xff\xd8")
    i = 0
    while i < len(segments) and segments[i][0] == 0xE0:  # JFIF has to stay first
        out += segments[i][1]
        i += 1
    if orientation != 1:
        exif = b"Exif\x00\x00" + orientation_only(orientation)
        out += b"\xff\xe1" + struct.pack(">H", len(exif) + 2) + exif
    for _, raw in segments[i:]:
        out += raw
    out += b"\xff\xd9"
    return bytes(out), removed


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_DROP = {b"eXIf": "EXIF", b"tEXt": "text", b"zTXt": "text", b"iTXt": "text/XMP", b"tIME": "time"}


def png_chunk(kind: bytes, body: bytes) -> bytes:
    return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)


def strip_png(data: bytes) -> tuple[bytes, list[str]] | None:
    if not data.startswith(PNG_SIGNATURE):
        return None
    chunks: list[tuple[bytes, bytes]] = []
    removed: list[str] = []
    orientation = 1
    pos = 8
    while pos + 12 <= len(data):
        (length,) = struct.unpack_from(">I", data, pos)
        kind = data[pos + 4 : pos + 8]
        raw = data[pos : pos + 12 + length]
        body = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind in PNG_DROP and not (kind == b"eXIf" and is_orientation_only(body)):
            if kind == b"eXIf":
                orientation = orientation_of(body)
            removed.append(PNG_DROP[kind])
        else:
            chunks.append((kind, raw))
        if kind == b"IEND":
            break
    if pos < len(data):
        removed.append("trailing data")
    if not removed:
        return None

    out = bytearray(PNG_SIGNATURE)
    pending = orientation != 1
    for kind, raw in chunks:
        if pending and kind in (b"IDAT", b"IEND"):  # eXIf has to come before the image data
            out += png_chunk(b"eXIf", orientation_only(orientation))
            pending = False
        out += raw
    return bytes(out), removed


STRIPPERS = {".webp": strip_webp, ".jpg": strip_jpeg, ".jpeg": strip_jpeg, ".png": strip_png}


def same_pixels(before: bytes, after: bytes) -> bool:
    """With Pillow installed, double-check that stripping didn't change the picture."""
    try:
        from io import BytesIO

        from PIL import Image
    except ImportError:
        return True
    try:
        with Image.open(BytesIO(before)) as a, Image.open(BytesIO(after)) as b:
            return a.size == b.size and a.mode == b.mode and a.tobytes() == b.tobytes()
    except Exception:  # an image Pillow can't decode: trust the byte-for-byte copy
        return True


def strip_metadata(path: Path, write: bool = True) -> list[str]:
    """Remove hidden metadata from one image in place. Returns what was (or would be) removed."""
    strip = STRIPPERS.get(path.suffix.lower())
    if not strip:
        return []
    data = path.read_bytes()
    try:
        result = strip(data)
    except (struct.error, IndexError, ValueError):
        return []
    if result is None:
        return []
    clean, removed = result
    if write:
        if not same_pixels(data, clean):
            print(f"  ! {path}: left as it is (removing its metadata would change the picture)", file=sys.stderr)
            return []
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_bytes(clean)
        os.replace(tmp, path)
    return sorted(set(removed))


def strip_folder(folder: Path, write: bool) -> int:
    """Strip (or, with write=False, only list) every image in a folder. Returns how many had metadata."""
    in_actions = os.environ.get("GITHUB_ACTIONS") == "true"
    found = 0
    for path in sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS):
        removed = strip_metadata(path, write=write)
        if not removed:
            continue
        found += 1
        # where the photo lives in the repo (a built copy in dist/ comes from public/)
        source = (PUBLIC / path.relative_to(folder)).relative_to(ROOT).as_posix()
        what = ", ".join(removed)
        print(f"  {'cleaned' if write else 'has metadata'}: {source} ({what})")
        if in_actions and folder.resolve() != PUBLIC.resolve():
            print(
                f"::warning file={source}::This photo has hidden metadata ({what}). It was removed from the "
                "live site, but the copy in the repo still has it: run python3 scripts/resize-photos.py and commit."
            )
    return found


# ── 2. small copies ──────────────────────────────────────────────────────────


def is_small_copy(path: Path) -> bool:
    return path.stem.endswith(SUFFIX)


def small_copy_of(path: Path) -> Path:
    return path.with_name(f"{path.stem}{SUFFIX}{path.suffix}")


def make_small(src: Path, dst: Path) -> None:
    from PIL import Image, ImageOps

    with Image.open(src) as raw:
        im = ImageOps.exif_transpose(raw)
        if im.width <= SMALL:
            shutil.copyfile(src, dst)
            return
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        height = max(1, round(im.height * SMALL / im.width))
        small = im.resize((SMALL, height), Image.Resampling.LANCZOS)
        tmp = dst.with_name(dst.name + ".tmp")
        # no exif / xmp passed in, so the small copy carries no metadata
        small.save(tmp, "WEBP", quality=QUALITY, method=6)
        os.replace(tmp, dst)


def make_small_copies(force: bool) -> None:
    from PIL import Image, ImageOps

    if not MEDIA.is_dir():
        print(f"no {MEDIA.relative_to(ROOT)} folder, no small copies to make")
        return

    sources = sorted(p for p in MEDIA.rglob("*.webp") if p.is_file() and not is_small_copy(p))
    made = kept = 0
    widths: dict[str, int] = {}
    before = after = 0

    for src in sources:
        dst = small_copy_of(src)
        if force or not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            make_small(src, dst)
            made += 1
        else:
            kept += 1
        with Image.open(src) as im:
            widths[src.relative_to(MEDIA).as_posix()] = ImageOps.exif_transpose(im).width
        before += src.stat().st_size
        after += dst.stat().st_size

    # small copies whose photo is gone
    removed = 0
    wanted = {small_copy_of(s) for s in sources}
    for p in MEDIA.rglob(f"*{SUFFIX}.webp"):
        if p not in wanted:
            p.unlink()
            removed += 1

    lines = [
        "/*",
        " * GENERATED by scripts/resize-photos.py. Don't edit by hand: run",
        " * `python3 scripts/resize-photos.py` after adding or replacing photos.",
        " *",
        f" * Photos in public/media that have a small {SMALL}px copy (<name>{SUFFIX}.webp),",
        " * with the width of the full photo. See srcSetOf() in ./responsiveImage.ts.",
        " */",
        "export const PHOTO_WIDTHS: Record<string, number> = {",
        *(f"  '{key}': {w}," for key, w in sorted(widths.items())),
        "}",
        "",
    ]
    MANIFEST.write_text("\n".join(lines), encoding="utf-8")

    print(
        f"{len(sources)} photos: {made} small copies made, {kept} up to date, {removed} removed. "
        f"full {before / 1024:.0f} KB -> small {after / 1024:.0f} KB. "
        f"wrote {MANIFEST.relative_to(ROOT)}"
    )


def plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def main() -> int:
    args = sys.argv[1:]

    if "--strip-only" in args:
        i = args.index("--strip-only")
        folder = Path(args[i + 1]).resolve() if i + 1 < len(args) else PUBLIC
        if not folder.is_dir():
            print(f"no {folder} folder, nothing to do")
            return 0
        found = strip_folder(folder, write=True)
        print(f"metadata: {plural(found, 'image')} cleaned in {folder}")
        return 0

    if not PUBLIC.is_dir():
        print(f"no {PUBLIC.relative_to(ROOT)} folder, nothing to do")
        return 0

    if "--check" in args:
        found = strip_folder(PUBLIC, write=False)
        if found:
            print(f"{plural(found, 'image')} still carry metadata: run python3 scripts/resize-photos.py")
            return 1
        print("metadata: every image in public/ is clean")
        return 0

    found = strip_folder(PUBLIC, write=True)
    print(f"metadata: {plural(found, 'image')} cleaned, every image in public/ is clean now")
    make_small_copies(force="--force" in args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
