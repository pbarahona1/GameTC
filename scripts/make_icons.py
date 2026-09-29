"""Genera el ícono (normal, redondo y adaptativo) y las pantallas de inicio de Android.
Uso: python3 scripts/make_icons.py   (requiere Pillow)"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os, math

RES = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
BG = (14, 18, 22)
BG2 = (28, 35, 43)
GOLD = (214, 171, 82)
GOLD_D = (160, 120, 45)
GOLD_L = (240, 208, 140)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def emblem(size, bg=True, pad=0.0, rounded=None):
    """Emblema: moneda dorada con barras ascendentes y flecha de crecimiento."""
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        # degradado radial oscuro
        grad = Image.new('RGBA', (S, S))
        gd = ImageDraw.Draw(grad)
        for r in range(S // 2, 0, -4):
            t = r / (S / 2)
            gd.ellipse([S / 2 - r * 1.45, S / 2 - r * 1.45, S / 2 + r * 1.45, S / 2 + r * 1.45], fill=lerp(BG2, BG, t) + (255,))
        if rounded:
            mask = Image.new('L', (S, S), 0)
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * rounded), fill=255)
            im.paste(grad, (0, 0), mask)
        else:
            im.paste(grad, (0, 0))
    c = S / 2
    R = S * (0.5 - pad)
    # anillo de la moneda
    ring = R * 0.86
    w = R * 0.085
    for i in range(int(w)):
        t = i / w
        d.ellipse([c - ring + i, c - ring + i, c + ring - i, c + ring - i], outline=lerp(GOLD_L, GOLD_D, t) + (255,), width=2)
    # barras ascendentes
    bw = R * 0.2
    gap = R * 0.09
    base = c + R * 0.42
    heights = [0.42, 0.66, 0.92]
    x0 = c - (bw * 3 + gap * 2) / 2
    for i, h in enumerate(heights):
        x = x0 + i * (bw + gap)
        top = base - R * h
        for yy in range(int(top), int(base)):
            t = (yy - top) / max(1, base - top)
            d.line([(x, yy), (x + bw, yy)], fill=lerp(GOLD_L, GOLD, t) + (255,))
        d.rounded_rectangle([x, top, x + bw, base], radius=int(bw * 0.18), outline=None)
    # flecha de crecimiento
    pts = [(c - R * 0.55, c + R * 0.12), (c - R * 0.15, c - R * 0.2), (c + R * 0.08, c - R * 0.02), (c + R * 0.5, c - R * 0.48)]
    lw = int(R * 0.075)
    d.line(pts, fill=(245, 245, 240, 255), width=lw, joint='curve')
    ax, ay = pts[-1]
    ang = math.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
    L = R * 0.2
    left = (ax - L * math.cos(ang - 0.5), ay - L * math.sin(ang - 0.5))
    right = (ax - L * math.cos(ang + 0.5), ay - L * math.sin(ang + 0.5))
    tip = (ax + R * 0.04 * math.cos(ang), ay + R * 0.04 * math.sin(ang))
    d.polygon([tip, left, right], fill=(245, 245, 240, 255))
    return im.resize((size, size), Image.LANCZOS)

def circle_mask(im):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).ellipse([0, 0, im.size[0] - 1, im.size[1] - 1], fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out

DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for k, f in DENS.items():
    d = os.path.join(RES, f'mipmap-{k}')
    s = int(48 * f)
    emblem(s, bg=True, pad=0.06, rounded=0.22).save(os.path.join(d, 'ic_launcher.png'))
    circle_mask(emblem(s, bg=True, pad=0.06)).save(os.path.join(d, 'ic_launcher_round.png'))
    fs = int(108 * f)
    fg = Image.new('RGBA', (fs, fs), (0, 0, 0, 0))
    inner = emblem(int(fs * 0.62), bg=False, pad=0.0)
    fg.paste(inner, ((fs - inner.size[0]) // 2, (fs - inner.size[1]) // 2), inner)
    fg.save(os.path.join(d, 'ic_launcher_foreground.png'))

# Ícono del sistema de splash (Android 12+): 288dp con zona segura central.
# En drawable-nodpi para que Android no lo reescale por densidad al decodificarlo.
icon = Image.new('RGBA', (576, 576), (0, 0, 0, 0))
em = emblem(312, bg=False)
icon.paste(em, ((576 - 312) // 2, (576 - 312) // 2), em)
os.makedirs(os.path.join(RES, 'drawable-nodpi'), exist_ok=True)
icon.save(os.path.join(RES, 'drawable-nodpi', 'splash_icon.png'))

def font(sz, bold=True):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def splash(w, h, path):
    im = Image.new('RGB', (w, h), BG)
    g = ImageDraw.Draw(im)
    for r in range(int(max(w, h) * 0.7), 0, -6):
        t = r / (max(w, h) * 0.7)
        g.ellipse([w / 2 - r, h * 0.45 - r, w / 2 + r, h * 0.45 + r], fill=lerp(BG2, BG, t))
    s = int(min(w, h) * 0.36)
    em = emblem(s, bg=False)
    im.paste(em, ((w - s) // 2, int(h * 0.45 - s / 2)), em)
    t1 = 'ULTIMATE REALISTIC TYCOON'
    f1 = font(max(12, int(min(w, h) * 0.045)))
    tw = g.textlength(t1, font=f1)
    g.text(((w - tw) / 2, h * 0.45 + s * 0.62), t1, font=f1, fill=GOLD)
    t2 = 'Cada peso cuenta.'
    f2 = font(max(10, int(min(w, h) * 0.03)), bold=False)
    tw2 = g.textlength(t2, font=f2)
    g.text(((w - tw2) / 2, h * 0.45 + s * 0.62 + f1.size * 1.6), t2, font=f2, fill=(154, 163, 173))
    im.save(path)

for folder in os.listdir(RES):
    p = os.path.join(RES, folder, 'splash.png')
    if os.path.exists(p):
        w, h = Image.open(p).size
        splash(w, h, p)

# Ícono web (favicon y vista previa)
web = os.path.join(os.path.dirname(__file__), '..', 'public')
os.makedirs(web, exist_ok=True)
emblem(512, bg=True, pad=0.06, rounded=0.22).save(os.path.join(web, 'icon-512.png'))
emblem(192, bg=True, pad=0.06, rounded=0.22).save(os.path.join(web, 'icon-192.png'))
print('ok')
