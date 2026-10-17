#!/usr/bin/env bash
# Lists anything still left over from the my-tiny-os demo (Alex Park / AlexOS), so nothing
# from the template ships on someone's real site.
#
#   bash .claude/skills/make-my-site/scripts/check-leftovers.sh            while building
#   bash .claude/skills/make-my-site/scripts/check-leftovers.sh --publish  right before publishing
#
# --publish also checks the link-preview addresses in index.html, which need the owner's
# GitHub username and can't be filled in earlier.
# If the owner's real name is Alex, ignore hits that are their own name.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

publish=0
[ "${1:-}" = "--publish" ] && publish=1
must=0

# grep that skips comment lines (// …, /* …, * …, <!-- …)
code_grep() { grep -rInE "$1" "${@:2}" | grep -vE ':[0-9]+:\s*(//|/\*|\*|<!--)'; }

echo "Must fix:"

# the demo person and the demo projects
if code_grep "Alex|alex\.example|Sprocket|Band Night|Corners: a Photo Zine" src index.html; then must=1; fi

# demo links and unfinished cards in the content files
if code_grep "example\.com|placeholder: *true" src/content; then must=1; fi

# page title and description still the template's
if grep -nE "<title>my tiny OS</title>|content=\"my tiny OS\"" index.html; then must=1; fi

# the template's link-preview image
if [ -f public/og.jpg ] && [ -f .template-og.sha ] && \
   [ "$(shasum public/og.jpg | cut -d' ' -f1)" = "$(cat .template-og.sha)" ]; then
  echo "public/og.jpg: still the template's link preview (run: node scripts/make-share-images.mjs)"
  must=1
fi

# the owner's brief
if [ ! -f docs/DESIGN.md ]; then
  echo "docs/DESIGN.md: missing (write the owner's design brief)"
  must=1
fi

if [ "$publish" = 1 ] && grep -n "YOUR-USERNAME" index.html; then
  echo "  ↑ put the real address (https://<username>.github.io/<repo>/) into these link-preview tags"
  must=1
fi
[ "$must" = 0 ] && echo "  ✓ nothing"

echo
echo "Worth a look (demo wording still in place; keep only if it fits the owner's voice):"
if ! code_grep "good vibes|100% energy|being awesome|shoelaces|psst: double-click|all the things|that's everything \(for now|waking up the pixels|brewing big ideas|fluffing the clouds|first edition" src; then
  echo "  ✓ nothing"
fi
echo "  For a full voice pass, list every UI line with: node scripts/list-ui-text.mjs"

exit 0
