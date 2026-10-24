"""Сезонные версии главного фото храма.

Запуск:  python3 tools/seasons/make_seasons.py [сезон ...]
Берёт docs/assets/img/hero.jpg (ранняя осень, утверждённое фото) и делает
docs/assets/img/seasons/<сезон>.jpg|.webp и маски <сезон>-masks.webp.

Если владелец положил готовую картинку в docs/assets/img/seasons/src/<сезон>.*,
она берётся как основа вместо обработки (приводится к кадру hero.jpg).

Храм и кресты не меняются по форме: все перекраски идут по маскам,
храм получает только общую цветокоррекцию света.
"""
import os
import sys
import glob
import numpy as np
import cv2
from PIL import Image

import masks as M

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'docs', 'assets', 'img')
OUT = os.path.join(IMG, 'seasons')
IW, IH = M.IW, M.IH
rng = np.random.default_rng(7)


# ---------------- помощники ----------------
def lum(c):
    return c[..., 0] * 0.299 + c[..., 1] * 0.587 + c[..., 2] * 0.114


def blur(x, s):
    return cv2.GaussianBlur(x, (0, 0), s)


def noise(scale, seed):
    """Плавный шум со средним 0.5, размер пятна ~ scale пикселей."""
    r = np.random.default_rng(seed)
    gw, gh = int(IW / scale) + 3, int(IH / scale) + 3
    g = r.random((gh, gw)).astype(np.float32)
    n = cv2.resize(g, (int(gw * scale), int(gh * scale)), interpolation=cv2.INTER_CUBIC)[:IH, :IW]
    n = blur(n, scale * 0.35)
    n = (n - n.mean()) / (n.std() + 1e-6)
    return np.clip(0.5 + n * 0.18, 0, 1)


def hsv2rgb(h, s, v):
    hsv = np.stack([h % 360, np.clip(s, 0, 1), np.clip(v, 0, 1)], -1).astype(np.float32)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)


def mix(a, b, t):
    if t.ndim == 2:
        t = t[..., None]
    return a * (1 - t) + b * t


def col(*c):
    return np.array(c, np.float32)


def vgrad(top, bottom, y0=0.0, y1=1.0):
    y = (np.arange(IH, dtype=np.float32) / IH)[:, None, None]
    t = np.clip((y - y0) / (y1 - y0), 0, 1)
    t = t * t * (3 - 2 * t)
    g = np.asarray(top, np.float32) * (1 - t) + np.asarray(bottom, np.float32) * t
    return np.broadcast_to(g, (IH, IW, 3)).copy()


def saturate(c, k):
    L = lum(c)[..., None]
    return L + (c - L) * k


def contrast(c, k, pivot=0.5):
    return pivot + (c - pivot) * k


def cloud_detail(rgb, m):
    """Рисунок облаков исходного неба: светлее/темнее средней яркости неба."""
    L = lum(rgb)
    sky = m['sky']
    w = blur(sky, 30) + 1e-3
    Lm = blur(L * sky, 30) / w
    return (L - Lm) * (sky > 0.02)


def thin_holes(m, density, fine=7, mid=22, seed=1):
    """Где листья «опали»: мелкие и средние пятна, плотность задаётся полем density 0..1."""
    n = noise(fine, seed) * 0.55 + noise(mid, seed + 1) * 0.45
    n = (n - n.mean()) / (n.std() + 1e-6)
    thr = np.quantile(n, 1 - np.clip(density, 0, 1).mean()) if np.isscalar(density) else None
    # локальный порог по полю плотности
    from scipy.stats import norm
    t = norm.ppf(1 - np.clip(density, 0.01, 0.99))
    return M.smooth(n - t, -0.35, 0.35)


# ---------------- сезоны ----------------
HOLES = {}


def compose(rgb, m, sky_fn, leaf_fn, holes=None, hole_bg=None, glow=0.0):
    """Собирает кадр: фон за листвой (небо) → листва поверх по alpha.
    holes — где листья «опали» (там виден фон hole_bg)."""
    a = m['foliage']
    sky_new = sky_fn(m['bgsrc'])
    out = mix(rgb, sky_new, m['skyw'])
    leaf = leaf_fn(m['leafrgb'])
    if holes is not None:
        leaf = mix(leaf, hole_bg if hole_bg is not None else sky_new, holes)
    out = mix(out, leaf, a)
    if glow:
        # светящийся край размытой ближней ветки сохраняем по яркости
        e = 4 * a * (1 - a) * m['near'] * glow
        out = out + ((lum(rgb) - lum(out)) * e)[..., None]
    return out


def grade_temple(out, rgb, m, k_mul, sat=1.0, con=1.0, pivot=0.55, gold_keep=0.9, gold_mul=(1, 1, 1)):
    """Общий свет на храме (и на всём кадре), золото остаётся тёплым."""
    c = saturate(out * col(*k_mul), sat)
    c = contrast(c, con, pivot)
    g = rgb * col(*gold_mul)
    return mix(c, g, m['gold'] * gold_keep)


def crown_holes(m, density, seed):
    """Маска «облетевших» мест в кронах (не на кустах и не на ближней ветке)."""
    L = lum(m['leafrgb'])
    holes = thin_holes(m, density, seed=seed)
    branch = 1 - M.smooth(L, 0.18, 0.4)          # тёмное в кроне — ветви, их оставляем
    return holes * (1 - m['ground']) * (1 - branch) * (1 - m['near']), branch


def far_haze(sky, top, bottom):
    yy = np.arange(IH, dtype=np.float32)[:, None, None]
    t = M.smooth(yy, 640, 900)
    return sky * (1 - t) + vgrad(top, bottom, 0.55, 0.92) * t


def early_autumn(rgb, m):
    return rgb.copy()


def summer(rgb, m):
    var = noise(90, 11) - 0.5                         # разные кроны — чуть разный зелёный

    def leaf(c):
        H, S, V = M.hsv(c)
        L = lum(c)
        dh = np.clip(H - 38, -14, 14)
        nh = 100 + dh * 0.8 + var * 18 - M.smooth(L, 0.6, 0.98) * 16      # блики — в тёплый жёлто-зелёный
        ns = np.clip(S * 0.7, 0, 0.72) * (1 - 0.35 * M.smooth(L, 0.7, 1.0))
        nv = np.clip(np.power(V, 1.25) * 0.8, 0, 1)
        return hsv2rgb(nh, ns, nv)

    def sky(c):
        s2 = saturate(c * col(0.95, 0.985, 1.03), 1.15)
        return s2

    out = compose(rgb, m, sky, leaf, glow=0.6)
    return grade_temple(out, rgb, m, (0.99, 1.0, 1.015), sat=1.0, con=1.02)


def late_autumn(rgb, m):
    yy = m['yy']

    def sky(c):
        L = lum(c)
        skym = m['skyw']
        w = blur(skym, 30) + 1e-3
        Lm = blur(L * skym, 30) / w
        det = (L - Lm) * (skym > 0.02)
        base = vgrad(col(0.60, 0.635, 0.68), col(0.85, 0.84, 0.82), 0.0, 0.85)
        g = base + (det * 0.55 + blur(det, 18) * 0.9)[..., None]
        g += (noise(160, 3) - 0.5)[..., None] * 0.06
        return far_haze(g, col(0.70, 0.70, 0.69), col(0.47, 0.45, 0.42))

    nvar = noise(60, 41) - 0.5
    nnear = noise(50, 42) - 0.5

    def leaf(c):
        H, S, V = M.hsv(c)
        nh = 31 + nvar * 18 + np.clip(H - 38, -10, 10) * 0.4
        nh = nh * (1 - m['near']) + (27 + nnear * 10) * m['near']
        ns = np.clip(S * 0.58, 0, 0.62)
        nv = np.clip(np.power(V, 1.12) * 0.72, 0, 1) * (1 - m['near'] * 0.12)
        b = hsv2rgb(nh, ns, nv)
        L = lum(c)
        br = 1 - M.smooth(L, 0.18, 0.4)
        return mix(b, saturate(b, 0.4) * 0.9, br)

    dens = np.clip(0.45 + (noise(120, 21) - 0.5) * 0.9, 0.2, 0.75)
    holes, _ = crown_holes(m, dens, 5)
    HOLES['late-autumn'] = holes
    sky_img = sky(m['bgsrc'])
    out = compose(rgb, m, lambda c: sky_img, leaf, holes=holes, hole_bg=sky_img)

    # земля и кусты: бурые, оливковые, приглушённые
    H, S, V = M.hsv(rgb)
    g = m['ground'] * m['foliage']
    gnd = hsv2rgb(36 + (noise(40, 51) - 0.5) * 22, np.clip(S * 0.45, 0, 0.5), np.power(V, 1.15) * 0.6)
    out = mix(out, gnd, g)

    Lo = lum(out)
    out = out + ((1 - Lo) ** 2 * 0.07)[..., None]              # пасмурно: тени мягче
    c = out * col(0.93, 0.965, 1.03)
    c = saturate(c, 0.72)
    c = contrast(c, 0.86, 0.55) * 0.95
    g2 = contrast(saturate(rgb, 0.85), 0.92, 0.5) * col(0.93, 0.92, 0.9)
    return mix(c, g2, m['gold'] * 0.9)


def winter(rgb, m):
    def sky(c):
        L = lum(c)
        skym = m['skyw']
        w = blur(skym, 30) + 1e-3
        Lm = blur(L * skym, 30) / w
        det = (L - Lm) * (skym > 0.02)
        base = vgrad(col(0.68, 0.76, 0.85), col(0.90, 0.92, 0.935), 0.0, 0.8)
        g = base + (det * 0.4 + blur(det, 16) * 0.5)[..., None]
        return far_haze(g, col(0.86, 0.89, 0.92), col(0.70, 0.73, 0.77))

    def leaf(c):
        L = lum(c)
        Ln = M.smooth(L, 0.08, 0.85) ** 0.7
        dark = col(0.40, 0.43, 0.49) * np.ones_like(c)
        light = col(0.94, 0.96, 0.99) * np.ones_like(c)
        f = mix(dark, light, Ln)
        br = 1 - M.smooth(L, 0.16, 0.36)
        f = mix(f, col(0.27, 0.26, 0.28) * np.ones_like(c), br * 0.6)
        # ближняя ветка — в снегу: белые комья с голубой тенью, без тёмного
        sn = mix(col(0.66, 0.72, 0.82) * np.ones_like(c), col(0.98, 0.985, 1.0) * np.ones_like(c), M.smooth(L, 0.3, 0.85))
        return mix(f, sn, m['near'])

    dens = np.clip(0.55 + (noise(120, 22) - 0.5) * 0.8, 0.3, 0.8)
    holes, _ = crown_holes(m, dens, 9)
    HOLES['winter'] = holes
    sky_img = sky(m['bgsrc'])
    out = compose(rgb, m, lambda c: sky_img, leaf, holes=holes, hole_bg=sky_img)

    L = lum(rgb)
    # земля и кусты: снег сверху, тёмные прутья в глубине
    g = m['ground']
    Ls = blur(L, 1.2)
    snowc = mix(col(0.62, 0.69, 0.80) * np.ones_like(rgb), col(0.95, 0.97, 1.0) * np.ones_like(rgb), M.smooth(Ls, 0.2, 0.7))
    twig = col(0.33, 0.33, 0.36) * np.ones_like(rgb)
    gnd = mix(twig, snowc, M.smooth(Ls, 0.08, 0.26))
    out = mix(out, gnd, g)

    # снег на кровлях: плотный, мягкий, с голубой тенью у нижнего края
    r = m['roof']
    RL = blur(L, 2.5)
    rn = M.smooth(RL, 0.1, 0.6)
    snow_roof = mix(col(0.74, 0.80, 0.89) * np.ones_like(rgb), col(0.97, 0.98, 1.0) * np.ones_like(rgb), rn * 0.6 + 0.4)
    snow_roof += (noise(6, 77) - 0.5)[..., None] * 0.03
    edge = np.clip(r - cv2.erode(r, np.ones((5, 1), np.uint8)), 0, 1)     # нижняя кромка снега
    snow_roof = mix(snow_roof, col(0.62, 0.68, 0.79) * np.ones_like(rgb), blur(edge, 0.8) * 0.5)
    out = mix(out, snow_roof, r)

    # тени на снегу и стенах — голубые
    Lo = lum(out)
    out = out + (col(-0.05, -0.01, 0.05) * (1 - M.smooth(Lo, 0.3, 0.85))[..., None])
    return grade_temple(out, rgb, m, (0.91, 0.965, 1.05), sat=0.72, con=0.94, pivot=0.6, gold_keep=0.92)


def spring(rgb, m):
    var = noise(90, 13) - 0.5
    # в цвету: левое дерево и дерево справа от купола; немного — на ближней ветке
    xx, yy = m['xx'], m['yy']
    zA = ((xx < 125) & (yy > 360) & (yy < 960)).astype(np.float32)
    zB = ((xx > 950) & (xx < 1225) & (yy > 290) & (yy < 600)).astype(np.float32)
    zone = blur(np.maximum(zA, zB), 25) * (0.75 + 0.5 * (noise(40, 63) - 0.5) * 2).clip(0, 1)
    zone = np.maximum(zone, m['near'] * M.smooth(noise(90, 62), 0.5, 0.6) * 0.7) * (1 - m['ground'])
    def leaf(c):
        H, S, V = M.hsv(c)
        L = lum(c)
        dh = np.clip(H - 38, -14, 14)
        nh = 82 + dh * 0.6 + var * 12 - M.smooth(L, 0.6, 0.98) * 12
        ns = np.clip(S * 0.55, 0, 0.62) * (1 - 0.3 * M.smooth(L, 0.7, 1.0))
        nv = np.clip(np.power(V, 1.05) * 0.96 + 0.03, 0, 1)
        y = hsv2rgb(nh, ns, nv)
        # цветение: светлые места крон в «цветущих» зонах — бело-розовые
        bl = np.clip(zone * 1.25, 0, 1) * M.smooth(L, 0.26, 0.56)
        petals = mix(col(0.80, 0.60, 0.66) * np.ones_like(c), col(1.0, 0.95, 0.95) * np.ones_like(c), M.smooth(L, 0.4, 0.95))
        return mix(y, petals, bl * 0.95)

    def sky(c):
        return saturate(c * col(0.95, 0.99, 1.04), 1.08)

    out = compose(rgb, m, sky, leaf, glow=0.5)
    return grade_temple(out, rgb, m, (0.975, 0.99, 1.025), sat=0.97, con=1.0)

SEASONS = dict(summer=summer, **{'late-autumn': late_autumn}, winter=winter, spring=spring)


def save(name, out, m):
    os.makedirs(OUT, exist_ok=True)
    im = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))
    q = 86
    while True:
        p = os.path.join(OUT, name + '.jpg')
        im.save(p, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(p) <= 350_000 or q <= 70:
            break
        q -= 2
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=82, method=6)
    save_masks(name, m)
    return im


def save_masks(name, m):
    """Маски для анимации (половинное разрешение): R — небо, G — листва, B — золото."""
    holes = HOLES.get(name)
    fol = m['foliage'] if holes is None else m['foliage'] * (1 - holes)
    sky = m['skyw'] * (1 - fol)
    old = Image.open(os.path.join(IMG, 'hero-life-masks.png')).convert('RGB')
    gold = np.asarray(old).astype(np.float32)[..., 2] / 255          # золото храма то же, что у исходного фото
    half = lambda a: cv2.resize(a.astype(np.float32), (IW // 2, IH // 2 + 1), interpolation=cv2.INTER_AREA)[:old.size[1]]
    fol_h = half(fol)
    fol_h = (M.smooth(fol_h, 0.35, 0.6) * 255)
    sky_h = half(sky) * 255
    ch = np.stack([sky_h, fol_h, gold * 255], -1)
    Image.fromarray(np.clip(ch + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name + '-masks.webp'), 'WEBP', lossless=True)


def source_override(name):
    """Готовая картинка владельца для сезона (если есть)."""
    for p in glob.glob(os.path.join(OUT, 'src', name + '.*')):
        return p
    return None


if __name__ == '__main__':
    rgb = M.load(os.path.join(IMG, 'hero.jpg'))
    m = M.build(rgb)
    names = sys.argv[1:] or list(SEASONS)
    for n in names:
        out = SEASONS[n](rgb, m)
        save(n, out, m)
        print(n, os.path.getsize(os.path.join(OUT, n + '.jpg')) // 1024, 'KB jpg,',
              os.path.getsize(os.path.join(OUT, n + '.webp')) // 1024, 'KB webp')
