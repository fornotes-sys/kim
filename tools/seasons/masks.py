"""Маски для сезонных версий главного фото храма (docs/assets/img/hero.jpg).

Все маски — в полном разрешении снимка (1444×1089), float32 0..1:
  temple  — храм целиком (защищён от любых перекрасок, кроме общей цветокоррекции);
  gold    — купол, кресты, золотые детали (остаются тёплыми во всех сезонах);
  foliage — листва деревьев, кусты, трава (то, что меняет цвет по сезону);
  sky     — небо (включая просветы между листьями);
  roof    — кровли храма (для снега);
  ground  — земля и кусты внизу кадра.
"""
import numpy as np
import cv2
from PIL import Image

IW, IH = 1444, 1089


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mix_(a, b, t):
    return a * (1 - t[..., None]) + b * t[..., None]


def blur_(x, s):
    return cv2.GaussianBlur(x, (0, 0), s)


def poly(points, blur=0):
    m = np.zeros((IH, IW), np.uint8)
    cv2.fillPoly(m, [np.array(points, np.int32)], 255, lineType=cv2.LINE_AA)
    m = m.astype(np.float32) / 255
    if blur:
        m = cv2.GaussianBlur(m, (0, 0), blur)
    return m


# Контур храма (пиксели снимка). Со стороны неба — с запасом,
# со стороны деревьев (слева и справа) край уточняется по цвету ниже.
TEMPLE = [
    (98, 384), (150, 345), (190, 318), (232, 330), (300, 352), (366, 377), (360, 388),
    (352, 486), (455, 470), (455, 330), (470, 300), (500, 255), (560, 200), (620, 175),
    (668, 160), (720, 172), (790, 200), (848, 250), (875, 290), (893, 330), (892, 470),
    (960, 488), (1060, 520), (1052, 540), (1125, 533), (1240, 672), (1226, 690),
    (1226, 1045), (40, 1048), (54, 1000), (54, 705), (36, 700), (60, 688), (54, 598),
    (98, 560),
]
CROSS_DOME = [(640, 18), (702, 18), (702, 80), (690, 92), (695, 168), (648, 168), (652, 92), (640, 80)]
CROSS_BELL = [(184, 234), (198, 234), (198, 252), (212, 252), (212, 275), (205, 280), (205, 325), (172, 325), (172, 280), (168, 275), (168, 252), (184, 252)]
DOME = [(456, 340), (462, 312), (476, 290), (498, 258), (530, 224), (580, 192), (630, 172), (668, 156),
        (710, 168), (770, 190), (820, 222), (858, 262), (882, 296), (894, 322), (894, 345), (456, 345)]
# кровли храма (для снега): металлические скаты
ROOFS = [
    [(100, 380), (186, 318), (192, 322), (106, 386)],                                 # колокольня, левый скат (кромка)
    [(186, 318), (240, 328), (300, 346), (366, 371), (362, 383), (300, 366), (240, 352), (190, 338)],  # колокольня, правый скат
    [(349, 506), (420, 488), (500, 474), (610, 466), (612, 476), (500, 484), (420, 497), (350, 514)],  # за барабаном слева
    [(618, 468), (700, 470), (760, 476), (860, 474), (858, 487), (760, 500), (700, 488), (618, 480)],  # за барабаном в центре
    [(860, 474), (960, 492), (1080, 524), (1078, 532), (960, 502), (860, 486)],     # за барабаном справа
    [(320, 643), (352, 590), (370, 570), (355, 556), (445, 568), (540, 600), (615, 630),
     (655, 659), (640, 666), (480, 652), (320, 650)],                               # левое крыло
    [(720, 556), (612, 635), (862, 635)],                                            # средний фронтон
    [(958, 555), (1119, 537), (1042, 637), (858, 641)],                              # правое крыло
]
# деревянные двери и окна нижнего яруса — не путать с кустами
WOOD = [(160, 820, 220, 1016), (446, 878, 502, 996), (556, 878, 612, 996),
        (1022, 905, 1054, 1008), (1092, 905, 1124, 1008), (1162, 905, 1194, 1008)]


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255


def hsv(rgb):
    h = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)   # H 0..360, S, V 0..1
    return h[..., 0], h[..., 1], h[..., 2]


def build(rgb):
    H, S, V = hsv(rgb)
    yy, xx = np.mgrid[0:IH, 0:IW].astype(np.float32)

    # цвет листвы: жёлто-оранжевый, насыщенный
    leafcol = (smooth(H, 18, 26) * (1 - smooth(H, 62, 78)) * smooth(S, 0.30, 0.50) * smooth(V, 0.08, 0.18))

    t = poly(TEMPLE)
    crosses = np.maximum(poly(CROSS_DOME), poly(CROSS_BELL))
    # сам крест — насыщенное тёмное золото и его блики рядом; размытые листья за ним — не крест
    csat = (smooth(S, 0.7, 0.85) * smooth(V, 0.2, 0.35)).astype(np.float32)
    csat = cv2.dilate(csat, np.ones((5, 5), np.uint8))
    cb = poly(CROSS_BELL)
    cb_top = cb * (yy < 256)
    crosses = np.maximum(poly(CROSS_DOME), np.maximum(cb * (yy >= 256), cb_top * np.clip(blur_(csat, 0.7) * 1.3, 0, 1)))
    crossbox = np.maximum(poly(CROSS_DOME), cb)
    t = np.maximum(t, crosses)
    # голубое небо внутри контура (просветы колокольни, края у крестов и купола) — это небо
    skycol = smooth(H, 180, 195) * (1 - smooth(H, 245, 260)) * smooth(S, 0.10, 0.18) * smooth(V, 0.55, 0.7)
    t = t * (1 - skycol)
    # у краёв, где храм соседствует с деревьями, решает цвет: жёлтое — листва
    side = (((xx < 118) & (yy > 420)) | ((xx > 1140) & (yy > 520)) | ((xx > 960) & (xx < 1135) & (yy > 478) & (yy < 552))
            | ((xx > 158) & (xx < 200) & (yy > 500) & (yy < 552)) | ((xx > 268) & (xx < 312) & (yy > 505) & (yy < 552)))
    bush = (yy > 950).astype(np.float32)
    wood = np.zeros((IH, IW), np.float32)
    for x0, y0, x1, y1 in WOOD:
        wood[y0:y1, x0:x1] = 1
    strict = smooth(H, 29, 35) * (1 - smooth(H, 66, 80)) * smooth(S, 0.5, 0.65) * smooth(V, 0.12, 0.25)
    take = np.where(side, leafcol, 0) + np.where(bush > 0, strict * (1 - wood), 0)
    temple = np.clip(t * (1 - np.clip(take, 0, 1)), 0, 1)

    # ближняя размытая ветка (вверху слева): берём пятна листьев целиком, вместе со светлыми бликами
    near = (((yy < 300) & (xx < 540)) | ((yy < 345) & (xx < 40))).astype(np.float32)
    near = blur_(near, 3)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    closed = cv2.morphologyEx((leafcol > 0.35).astype(np.uint8), cv2.MORPH_CLOSE, k).astype(np.float32)
    closed = np.maximum(blur_(closed, 2.5), leafcol)
    leafcol = leafcol * (1 - near) + closed * near
    foliage = leafcol * (1 - temple) * (1 - crosses)

    # Края листьев на фоне неба — смесь цвета листа и неба. Разделяем их:
    # alpha — доля листа в пикселе, leafrgb — «чистый» цвет листа, skyrgb — цвет неба за ним.
    # Тогда перекраска листвы не оставляет оранжевой каймы, а замена неба — светлого ореола.
    upper = 1 - smooth(yy, 760, 860)
    wB = skycol * (1 - leafcol) * (1 - temple)
    # белые облака (но не светлый ореол вокруг размытой ветки)
    glowz = near * smooth(blur_(leafcol, 12), 0.01, 0.1)
    wB = np.maximum(wB, (1 - smooth(S, 0.12, 0.25)) * smooth(V, 0.8, 0.9) * (1 - leafcol) * (1 - t) * (1 - glowz))
    wO = smooth(leafcol, 0.85, 0.98) * smooth(V, 0.55, 0.8)
    def wavg(w, sig):
        a = cv2.GaussianBlur(rgb * w[..., None], (0, 0), sig)
        b = cv2.GaussianBlur(w, (0, 0), sig)[..., None]
        return a, b
    a1, b1 = wavg(wB, 10); a2, b2 = wavg(wB, 40)
    B = (a1 + a2 * 0.02) / (b1 + b2 * 0.02 + 1e-6)
    o1, p1 = wavg(wO, 8); o2, p2 = wavg(wO, 40)
    O = (o1 + o2 * 0.02) / (p1 + p2 * 0.02 + 1e-6)
    d = O - B
    a = np.sum((rgb - B) * d, -1) / (np.sum(d * d, -1) + 1e-4)
    a = np.clip(a, 0, 1)
    # у размытой ближней ветки края светятся (ореол от контрового света): считаем по «теплоте» R−B
    wrm = lambda c: c[..., 0] - c[..., 2]
    aw = np.clip((wrm(rgb) - wrm(B)) / np.maximum(wrm(O) - wrm(B), 0.2), 0, 1)
    a = np.maximum(a, aw * near)
    have = np.maximum(smooth(b1[..., 0], 0.02, 0.08) * smooth(p2[..., 0], 0.002, 0.01), near) * upper * (1 - temple)
    leafnear = smooth(blur_(leafcol, 3), 0.03, 0.25)
    a = np.maximum(a, (1 - smooth(V, 0.25, 0.5))) * leafnear          # тёмное внутри кроны — ветви, не небо
    alpha = foliage * (1 - have) + a * have
    alpha = np.clip(alpha, 0, 1) * (1 - temple) * (1 - crosses)
    leafrgb = np.where(have[..., None] > 0.01,
                       np.clip(B + (rgb - B) / np.maximum(alpha, 0.2)[..., None], 0, 1), rgb)
    # при малой доле листа «чистый» цвет ненадёжен — тянем его к среднему цвету листвы рядом
    leafrgb = mix_(O, leafrgb, smooth(alpha, 0.25, 0.85))
    leafrgb = leafrgb * have[..., None] + rgb * (1 - have[..., None])
    foliage = alpha

    # золото: купол и кресты по цвету внутри своих областей + медальоны
    goldcol = smooth(H, 25, 32) * (1 - smooth(H, 60, 70)) * smooth(S, 0.2, 0.4) * smooth(V, 0.25, 0.45)
    gold_area = np.maximum.reduce([poly(DOME, 2), crosses, poly([(640, 140), (700, 140), (700, 175), (640, 175)])])
    gold = goldcol * gold_area
    gold = np.clip(cv2.GaussianBlur(cv2.dilate(gold, np.ones((3, 3), np.uint8)), (0, 0), 1.2) * 1.2, 0, 1) * gold_area

    # небо: всё, что не храм и не листва, в верхней части кадра
    sky = np.clip((1 - temple) * (1 - foliage) * upper, 0, 1)
    # тёмные просветы между листьями — ветви и тень, а не небо
    sky *= np.maximum(smooth(V, 0.45, 0.7), have)
    # куда при перекраске кладётся «фон за листвой» (небо или даль)
    skyw = np.clip((1 - temple) * upper * np.maximum(smooth(V, 0.45, 0.7), have), 0, 1)
    halo = glowz            # светлый ореол вокруг размытых листьев
    bgsrc = mix_(rgb, B, have * np.maximum(smooth(alpha, 0.0, 0.12), halo))

    roof = np.zeros((IH, IW), np.float32)
    for r in ROOFS:
        roof = np.maximum(roof, poly(r))
    # белые стены и карнизы, попавшие в контур кровли, не трогаем
    wall = (1 - smooth(S, 0.10, 0.2)) * smooth(V, 0.80, 0.9)
    roof = roof * (1 - wall) * temple

    ground = smooth(yy, 940, 1000) * (1 - temple)

    return dict(near=near, have=have, skyw=skyw, bgsrc=bgsrc.astype(np.float32), leafrgb=leafrgb.astype(np.float32), skyrgb=B.astype(np.float32), temple=temple, gold=gold, foliage=foliage, sky=sky, roof=roof, ground=ground,
                H=H, S=S, V=V, yy=yy, xx=xx)
