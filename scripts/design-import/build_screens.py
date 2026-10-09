import os,re,sys
d,out=sys.argv[1],sys.argv[2]
src=open(out).read()
head=src[:src.index('\nfunction ')].rstrip('\n')+'\n'
# Markup patches for controls the pilot can't back: the label-photo CTAs become the
# working paste / add-by-name inputs. (screen, old, new); "re:" marks a regex.
# Applied before the copy hooks below; each must match exactly once.
MARKUP_PATCHES = [
  ("SH_mixPick", '<input value={v.query} onChange={v.onQuery} placeholder="Search brand or product"', '<input id="myrota-mix-product-name" value={v.query} onChange={v.onQuery} placeholder="Enter product name"'),
  ("SH_mixPick", '<button onClick={v.mixScan}', '<button onClick={() => document.getElementById("myrota-mix-product-name")?.focus()}'),
  ("SH_mixPick", '</span>Scan the label</button>', '</span>Enter a product name</button>'),
  ("S_add", 'onClick={v.scanGo}', 'onClick={v.pasteGo}'),
  ("S_add", 're:<svg width="36" height="36" .*?</svg>Scan the label</button>', '<RotaMarker icon="jar" size={34} />Paste ingredient list</button>'),
  ("S_add", '<div style={{ display: "flex", justifyContent: "center", gap: "24px" }}><button onClick={v.pasteGo}', '<div style={{ display: "flex", justifyContent: "center", gap: "24px", alignItems: "center", flexWrap: "wrap" }}><button onClick={() => document.getElementById("myrota-product-name")?.focus()}'),
  ("S_add", 're:>Paste ingredients</button><button onClick=\\{v\\.galleryGo\\} style=\\{\\{[^}]*\\}\\}>Choose a photo</button>', '>Add by name instead</button><span style={{ fontSize: "12px", color: "#845535" }}>Photo reading coming soon</span>'),
  ("S_add", '<input value={v.query} onChange={v.onQuery} placeholder="Search brand or product"', '<input id="myrota-product-name" value={v.query} onChange={v.onQuery} placeholder="Product name (e.g. Vitamin C serum)"'),
]
PATCHES = [
  ("S_scan", "Scan the back label first", "scanTitle"),
  ("S_scan", "The ingredient list tells us more than the name. We'll use your camera only while this screen is open. Photos aren't kept.", "scanBody"),
  ("S_scan", "Use camera", "scanPrimary"),
  ("S_scan", "Choose from gallery", "scanSecondary"),
  ("S_add", "Not in our library. Scan the label, or add it as unknown.", "unknownRowSub"),
  ("SH_invite", "Invite one friend", "inviteTitle"),
  ("SH_invite", "They build their own rota from their own shelf. You'll see each other's streak, nothing else.", "inviteBody"),
  ("SH_invite", "myrota.app/i/a8Kb4Q", "!inviteLink"),  # fixture link: no fallback in prod bundle; demo gallery supplies it
  ("S_friends", "One link works for a chat, a group or your Status. Each person builds their own rota.", "friendsEmptyLine"),
  ("S_friends", "Invite a friend", "inviteBtnLabel"),
  ("SH_name", "What should friends call you?", "nameTitle"),
  ("SH_name", "Shown only to people who join from your link. You can change it in Profile.", "nameHint"),
  ("SH_install", "Open myrota in one tap and get your reminders.", "androidLine"),
  ("SH_share", "Save image", "saveImageLabel"),
  ("S_rotaComplete", "Plan next week", "planNextLabel"),
  ("S_review", "Snap the front", "snapFrontLabel"),
  ("SH_unknown", "Unknown product", "unkTitle"),
  ("SH_unknown", "It isn't in our library, so we won't guess what's in it or check it against your other products. It goes on your shelf as Unknown.", "unkBody"),
  ("SH_unknown", "Add to shelf as unknown", "unkCta"),
]
names=sorted(f[:-4] for f in os.listdir(d) if re.match(r'(S|SH)_\w+\.tsx$',f))
parts=[]
for n in names:
    t=open(os.path.join(d,n+'.tsx')).read()
    bodies=[b.strip() for b in re.split(r'^// ---- .*\n',t,flags=re.M) if b.strip()]
    kind,key=n.split('_',1)
    body=bodies[0]
    for (scr, old, new) in MARKUP_PATCHES:
        if scr == n:
            pat = old[3:] if old.startswith('re:') else re.escape(old)
            body, count = re.subn(pat, lambda _m: new, body, flags=re.S)
            assert count == 1, (n, old, count)
    for (scr, orig, var) in PATCHES:
        if scr == n:
            import json
            needle = '>' + orig + '<'
            assert body.count(needle) == 1, (n, orig, body.count(needle))
            if var.startswith('!'):
                body = body.replace(needle, '>{v.' + var[1:] + '}<')
            else:
                body = body.replace(needle, '>{v.' + var + ' ?? ' + json.dumps(orig, ensure_ascii=False) + '}<')
    parts.append((kind,key,body))
# Design-review-only states: unreachable in production (no backend), kept out of the
# production bundle so fixture people/links never ship. Loaded by /dev/states only.
DEMO_ONLY = {('S','whatsapp'),('S','lock'),('S','friendJoined'),('S','inviteLanding'),('S','reminders'),('S','nextWeek'),('SH','claim'),('SH','rescue'),('SH','swap'),('SH','nudge')}
def emit(sel, name_s, name_sh):
    s=''
    for kind,key,body in parts:
        if sel(kind,key):
            s+=f'\nfunction {kind}_{key}(v: V): ReactNode {{\n  return (<>{body}</>);\n}}\n'
    s+=f'\nexport const {name_s}: Record<string, (v: V) => ReactNode> = {{\n'+''.join(f'  {k}: S_{k},\n' for kind,k,_ in parts if kind=='S' and sel(kind,k))+'};\n'
    s+=f'\nexport const {name_sh}: Record<string, (v: V) => ReactNode> = {{\n'+''.join(f'  {k}: SH_{k},\n' for kind,k,_ in parts if kind=='SH' and sel(kind,k))+'};\n'
    return s
open(out,'w').write(head+'\n'+emit(lambda k,n:(k,n) not in DEMO_ONLY,'SCREENS','SHEETS'))
demo_out=out.replace('screens.tsx','screens-demo.tsx')
demo_head=head.replace('Prototype v1.6 screens and sheets','DEMO-ONLY Prototype v1.6 screens and sheets (design review; no production backend)')
open(demo_out,'w').write(demo_head+'\n'+emit(lambda k,n:(k,n) in DEMO_ONLY,'DEMO_SCREENS','DEMO_SHEETS')+'\n/** Fixture bindings with no production fallback (e.g. the prototype invite link). */\nexport const DEMO_DEFAULTS = { inviteLink: "myrota.app/i/a8Kb4Q" };\n')
