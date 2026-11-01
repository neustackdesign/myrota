import re, sys
src, out = sys.argv[1], sys.argv[2]
body = open(src).read()
body = re.sub(r'^// ----.*\n', '', body, flags=re.M).strip()

def rep(old, new, count=1, regex=False):
    global body
    if regex:
        body, n = re.subn(old, new, body, flags=re.S)
    else:
        n = body.count(old)
        body = body.replace(old, new)
    if n == 0 or (count and n != count):
        raise SystemExit(f"replacement mismatch ({n}): {old[:80]}")

# Social accounts do not exist yet: remove placeholder icons rather than ship dead links.
for lab in ["Instagram", "TikTok", "WhatsApp channel"]:
    rep(r'<a [^>]*href="#" aria-label="' + lab + r'"[^>]*>.*?</a>', '', regex=True)
rep('href="#" >About<'.replace(' >', ''), 'href="/about">About<', 0) if False else None
for text, href in [("About", "/about"), ("Contact", "/contact"), ("Press kit", "/about#press"), ("Privacy", "/legal/privacy"), ("Terms", "/legal/terms"), ("Cookie settings", "/legal/privacy#cookies")]:
    rep(r'href="#"((?:(?!<a ).)*?>)' + re.escape(text) + '<', 'href="' + href + r'"\1' + text + '<', regex=True)
# Mix: carry the chosen pair (as unanalysed names, never a reviewed result) into the app.
rep('href={v.appHref}' + re.escape('') , 'href={v.appHref}', 0) if False else None
i = body.find('Build a rota with these')
j = body.rfind('href={v.appHref}', 0, i)
body = body[:j] + 'href={v.mixPairHref}' + body[j + len('href={v.appHref}'):]
rep('Verdicts here are illustrative.', 'These verdicts are illustrative examples, not reviewed results. In the app, any pair without a pharmacist-reviewed rule shows “Not enough evidence”.')
rep("Two sessions, one tap each, and a reminder only when you need it. Here's a Wednesday, eleven days in.", "Two sessions, one tap each. Here's a Wednesday, eleven days in. Reminders are planned; they aren't switched on in this pilot yet.")
# Friends: no live invites in the pilot. Share the real public URL, labelled honestly.
rep('Invite a friend on WhatsApp', 'Share myrota on WhatsApp')
rep("I'm building a skincare rota from what's already on my shelf. Build yours and we can keep each other going.", "I'm building a skincare rota from what's already on my shelf. Build yours:")
rep('myrota.app/i/a8Kb4Q · 21:44', '{v.publicUrlLabel}')
rep('This is the message your friend gets. One link works for a chat, a group or your Status.', "This is the message your friend gets. Friend Streaks aren't switched on in this pilot yet, so for now the link opens myrota itself. The moments above are illustrations.")
# TU: describe only the entry methods that are live in the pilot.
rep("Scan the back, search the name or paste the ingredients. If myrota can't read something, it says so. It only goes where you put it.", "Paste the ingredients from the label, or add a product by name. You'll review what we've read before saving it. Photo reading and product-library matching are still being built.")

header = '''"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * myrota landing — Landing (1) design ("myrota — Your shelf, in the right
 * order."), seven chapters MO–SU. Markup generated from the Claude Design
 * source by scripts in docs/NEW_DESIGN_SOURCE_AUDIT.md; behaviour in
 * useLandingVM. Copy changes for truthfulness are listed in
 * docs/DESIGN_DIFF_AND_CONTRACT.md. Do not hand-edit styles casually: keep
 * parity with the source.
 */
import { Fragment } from "react";
import { DayTag } from "@/components/brand/DayTag";
import { Grain } from "@/components/brand/Grain";
import { ImageSlot } from "@/components/brand/ImageSlot";
import { MomentCard } from "@/components/brand/MomentCard";
import { PhotoFrame } from "@/components/brand/PhotoFrame";
import { RhythmStrip } from "@/components/brand/RhythmStrip";
import { RotaMarker } from "@/components/brand/RotaMarker";
import { RotaRing } from "@/components/brand/RotaRing";
import { Wordmark } from "@/components/brand/Wordmark";
import { track } from "@/lib/analytics";
import { useLandingVM } from "./useLandingVM";

function onCtaClick(e: React.MouseEvent) {
  const a = (e.target as HTMLElement).closest?.("a[href^='/app']");
  if (a) track("cta_start", { where: a.closest("[data-screen-label]")?.getAttribute("data-screen-label") ?? "landing" });
}

export function Landing() {
  const v = useLandingVM();
  return (
    <main id="main" onClickCapture={onCtaClick}>
      '''
footer = '''
    </main>
  );
}
'''
open(out, 'w').write(header + body + footer)
print("ok", len(body))
