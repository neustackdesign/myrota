"""Convert a Claude Design (DC) packed template fragment into TSX.

Usage: python3 -I dc2tsx.py <markup.html> <out_dir> <mode>
  mode = proto  -> split into screens (S.x) and sheets (SH.x) + chrome
  mode = landing -> split into top-level nav/header/section/footer blocks

Bindings `{{ path }}` become `v.path` unless the root is a loop variable.
`style-hover|active|focus` become generated class names collected in dc-states.css.
"""
import hashlib
import html
import json
import re
import sys
from html.parser import HTMLParser

VOID = {"input", "img", "br", "hr", "meta", "source"}
ATTR_MAP = {
    "class": "className", "for": "htmlFor", "tabindex": "tabIndex", "readonly": "readOnly",
    "maxlength": "maxLength", "autocomplete": "autoComplete", "inputmode": "inputMode",
    "autofocus": "autoFocus", "viewbox": "viewBox", "preserveaspectratio": "preserveAspectRatio",
    "basefrequency": "baseFrequency", "numoctaves": "numOctaves", "xchannelselector": "xChannelSelector",
    "ychannelselector": "yChannelSelector", "stddeviation": "stdDeviation", "gradientunits": "gradientUnits",
    "gradienttransform": "gradientTransform", "patternunits": "patternUnits", "clippathunits": "clipPathUnits",
    "spellcheck": "spellCheck", "enterkeyhint": "enterKeyHint", "srcset": "srcSet", "colspan": "colSpan",
    "crossorigin": "crossOrigin", "referrerpolicy": "referrerPolicy", "xlink:href": "xlinkHref",
}
TAG_MAP = {t.lower(): t for t in ["feTurbulence","feDisplacementMap","feGaussianBlur","feColorMatrix","feComposite","feOffset","feMerge","feMergeNode","feBlend","feFlood","linearGradient","radialGradient","clipPath","textPath","foreignObject","feComponentTransfer","feFuncA","feMorphology","feDropShadow"]}
COMPONENTS = {"Wordmark", "RotaRing", "RotaMarker", "Grain", "PhotoFrame", "MomentCard", "DayTag", "RhythmStrip", "Avatar", "RotaSpot"}
BIND = re.compile(r"\{\{\s*(.*?)\s*\}\}")
state_css = {}


def camel(s):
    s = s.strip()
    if s.startswith("--"):
        return s
    if s.startswith("-webkit-"):
        s = "Webkit-" + s[len("-webkit-"):]
    return re.sub(r"-([a-z])", lambda m: m.group(1).upper(), s)


def expr(path, loops):
    p = path.strip()
    if re.fullmatch(r"-?\d+(\.\d+)?|true|false|null", p):
        return p
    if p.startswith("'") or p.startswith('"'):
        return p
    root = re.split(r"[.\[]", p, maxsplit=1)[0]
    if root in loops:
        return p
    return "v." + p


FONT_MAP = [("'Faculty Glyphic'", "var(--font-faculty-glyphic)"), ("'Geist Mono'", "var(--font-geist-mono)"), ("'Geist'", "var(--font-geist)")]


def fonts(val):
    for a, b in FONT_MAP:
        val = val.replace(a, b)
    return val


def value_expr(val, loops):
    """Return a JS expression for an attribute value with possible bindings."""
    val = fonts(val)
    parts = BIND.split(val)
    if len(parts) == 1:
        return json.dumps(val, ensure_ascii=False)
    if len(parts) == 3 and parts[0] == "" and parts[2] == "":
        return expr(parts[1], loops)
    out = "`"
    for i, part in enumerate(parts):
        if i % 2 == 0:
            out += part.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
        else:
            out += "${" + expr(part, loops) + "}"
    return out + "`"


def split_css(css):
    decls, depth, cur = [], 0, ""
    for ch in css:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == ";" and depth == 0:
            decls.append(cur)
            cur = ""
        else:
            cur += ch
    decls.append(cur)
    return [d for d in decls if d.strip()]


def style_obj(css, loops):
    items = {}
    for d in split_css(css):
        if ":" not in d:
            continue
        k, v = d.split(":", 1)
        key = json.dumps(camel(k)) if camel(k).startswith('--') else camel(k)
        items.pop(key, None)
        items[key] = value_expr(v.strip(), loops)
    return "{{ " + ", ".join(f"{k}: {v}" for k, v in items.items()) + " }}"


def state_class(kind, css):
    body = ";".join(d.strip() + " !important" for d in split_css(css) if ":" in d)
    h = hashlib.sha1((kind + body).encode()).hexdigest()[:6]
    name = f"dc-{kind[0]}{h}"
    sel = {"hover": ":hover", "active": ":active", "focus": ":focus-visible"}[kind]
    state_css[name] = f".{name}{sel}{{{body}}}"
    return name


def jsx_text(t, loops):
    parts = BIND.split(t)
    out = ""
    for i, part in enumerate(parts):
        if i % 2 == 0:
            out += part.replace("{", "&#123;").replace("}", "&#125;").replace("<", "&lt;").replace(">", "&gt;")
        else:
            out += "{" + expr(part, loops) + "}"
    return out


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.children, self.parent = tag, attrs, [], parent


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", [])
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def emit(node, loops, ind=0):
    pad = "  " * ind
    if isinstance(node, str):
        if not node.strip():
            return " " if node and "\n" not in node and node != "" else ""
        return jsx_text(re.sub(r"\s*\n\s*", " ", node), loops)
    tag, attrs = node.tag, dict(node.attrs)
    if tag in ("helmet", "script", "style", "title"):
        return ""
    kids = lambda lp: "".join(emit(c, lp, ind + 1) for c in node.children)
    if tag == "sc-if":
        cond = value_expr(attrs.get("value", "false"), loops)
        inner = kids(loops).strip()
        return f"{{{cond} ? (<>{inner}</>) : null}}"
    if tag == "sc-for":
        lst = value_expr(attrs.get("list", "[]"), loops)
        var = attrs.get("as", "item")
        lp = loops | {var}
        inner = kids(lp).strip()
        return f"{{({lst} ?? []).map(({var}: any, {var}_i: number) => (<Fragment key={{{var}_i}}>{inner}</Fragment>))}}"
    if tag == "dc-import":
        name = attrs.pop("name")
        props = []
        for k, v in attrs.items():
            if k.startswith("hint-"):
                continue
            if k == "style":
                props.append(f"style={style_obj(v, loops)}")
                continue
            if k.startswith("sc-camel-"):
                k = k[len("sc-camel-"):]
            key = camel(k) if "-" in k else k
            if BIND.search(v or ""):
                props.append(f"{key}={{{value_expr(v, loops)}}}")
            elif re.fullmatch(r"-?\d+(\.\d+)?", v or ""):
                props.append(f"{key}={{{v}}}")
            else:
                props.append(f"{key}={json.dumps(v or '', ensure_ascii=False)}")
        return f"<{name} {' '.join(props)} />"
    if tag == "image-slot":
        props = []
        for k, v in attrs.items():
            if k == "style":
                props.append(f"style={style_obj(v, loops)}")
            elif k in ("id", "placeholder", "shape"):
                props.append(f"{'slot' if k == 'id' else k}={{{value_expr(v, loops)}}}")
        return f"<ImageSlot {' '.join(props)} />"
    out_attrs, classes = [], []
    for k, v in node.attrs:
        v = "" if v is None else v
        if k.startswith("hint-"):
            continue
        if k == "style":
            out_attrs.append(f"style={style_obj(v, loops)}")
        elif k in ("style-hover", "style-active", "style-focus"):
            classes.append(state_class(k.split("-")[1], v))
        elif k.startswith("sc-camel-"):
            name = camel(k[len("sc-camel-"):])
            out_attrs.append(f"{name}={{{value_expr(v, loops)}}}")
        elif k.lower() in ("onclick", "onchange", "oninput"):
            name = {"onclick": "onClick", "onchange": "onChange", "oninput": "onInput"}[k.lower()]
            out_attrs.append(f"{name}={{{value_expr(v, loops)}}}")
        elif k == "class":
            classes.append(v)
        else:
            name = ATTR_MAP.get(k, k if (k.startswith("data-") or k.startswith("aria-")) else camel(k) if "-" in k else k)
            if v == "" and k not in ("alt", "value", "placeholder"):
                out_attrs.append(name)
            elif BIND.search(v):
                out_attrs.append(f"{name}={{{value_expr(v, loops)}}}")
            elif name in ("rows", "cols", "maxLength", "tabIndex", "size") and re.fullmatch(r"-?\d+", v):
                out_attrs.append(f"{name}={{{v}}}")
            else:
                out_attrs.append(f"{name}={json.dumps(v, ensure_ascii=False)}")
    if classes:
        out_attrs.insert(0, f'className="{" ".join(classes)}"')
    a = (" " + " ".join(out_attrs)) if out_attrs else ""
    tag = TAG_MAP.get(tag, tag)
    if tag in VOID:
        return f"<{tag}{a} />"
    inner = kids(loops)
    return f"<{tag}{a}>{inner}</{tag}>"


def parse(markup):
    p = P()
    p.feed(markup)
    return p.root


def find_blocks(root, pred):
    out = []
    def walk(n):
        if isinstance(n, str):
            return
        if pred(n):
            out.append(n)
            return
        for c in n.children:
            walk(c)
    walk(root)
    return out


def main():
    src, out_dir, mode = sys.argv[1], sys.argv[2], sys.argv[3]
    markup = open(src).read()
    i = markup.find("</helmet>")
    if i >= 0 and mode != "component":
        markup = markup[i + len("</helmet>"):]
    root = parse(markup)
    index = {}
    if mode == "component":
        xdc = find_blocks(root, lambda n: n.tag == "x-dc")
        body = "".join(emit(c, set(), 1) for c in (xdc[0].children if xdc else root.children)).strip()
        index["component"] = [body]
    elif mode == "proto":
        blocks = find_blocks(root, lambda n: n.tag == "sc-if" and re.fullmatch(r"\{\{\s*(S|SH)\.\w+\s*\}\}", dict(n.attrs).get("value", "")))
        for b in blocks:
            key = BIND.search(dict(b.attrs)["value"]).group(1).replace(".", "_")
            body = "".join(emit(c, set(), 1) for c in b.children).strip()
            index.setdefault(key, []).append(body)
        # chrome: the whole thing (for reference)
        open(f"{out_dir}/_all.tsx", "w").write("".join(emit(c, set()) for c in root.children))
    else:
        blocks = [c for c in find_blocks(root, lambda n: n.tag in ("nav", "header", "section", "footer"))]
        for k, b in enumerate(blocks):
            label = dict(b.attrs).get("data-screen-label", f"block{k}")
            key = f"{k:02d}_" + re.sub(r"[^A-Za-z0-9]+", "_", label).strip("_")
            index[key] = [emit(b, set(), 1)]
    for key, bodies in index.items():
        with open(f"{out_dir}/{key}.tsx", "w") as f:
            for j, body in enumerate(bodies):
                f.write(f"// ---- {key} #{j}\n<>{body}</>\n")
    with open(f"{out_dir}/dc-states.css", "w") as f:
        f.write("\n".join(state_css[k] for k in sorted(state_css)) + "\n")
    print(json.dumps({k: [len(b) for b in v] for k, v in index.items()}))


if __name__ == "__main__":
    main()
