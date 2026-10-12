import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.ttLib.tables import otTables as ot

SRC = {False: 'mont/Montserrat[wght].ttf', True: 'mont/Montserrat-Italic[wght].ttf'}
OUT = sys.argv[1]
FAM = 'Remoto BS'
# style, os2 weight, target lowercase-l stem, target avg width (measured from Remoto)
STYLES = [('Thin',100,.032,.611),('Light',300,.056,.622),('Regular',400,.080,.630),
          ('Medium',500,.112,.635),('Bold',700,.166,.643),('Black',900,.213,.651)]
LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

def inst(path, w):
    f = TTFont(path); instantiateVariableFont(f, {'wght': w}, inplace=True, updateFontNames=False); return f

def metrics(f):
    gs, cm = f.getGlyphSet(), f.getBestCmap()
    p = BoundsPen(gs); gs[cm[ord('l')]].draw(p)
    stem = (p.bounds[2]-p.bounds[0])/1000
    avgw = sum(f['hmtx'][cm[ord(c)]][0] for c in LETTERS)/len(LETTERS)/1000
    return stem, avgw

def pick(stem_t, w_t):
    # choose wght + horizontal scale so scaled stem and scaled width both match Remoto
    lo, hi = 100, 900
    for _ in range(14):
        mid = (lo+hi)/2
        f = inst(SRC[False], mid); stem, avgw = metrics(f)
        sx = w_t/avgw
        if stem*sx < stem_t: lo = mid
        else: hi = mid
    return round((lo+hi)/2), sx

def walk(obj, sx, seen):
    if id(obj) in seen: return
    seen.add(id(obj))
    if isinstance(obj, list):
        for o in obj: walk(o, sx, seen)
        return
    if isinstance(obj, ot.ValueRecord):
        for a in ('XPlacement','XAdvance'):
            if hasattr(obj, a): setattr(obj, a, round(getattr(obj, a)*sx))
        return
    if isinstance(obj, ot.Anchor):
        obj.XCoordinate = round(obj.XCoordinate*sx); return
    if hasattr(obj, '__dict__'):
        for v in list(vars(obj).values()):
            if isinstance(v, (list, ot.BaseTable, ot.ValueRecord)): walk(v, sx, seen)

def hscale(f, sx):
    glyf, hmtx = f['glyf'], f['hmtx']
    for name in f.getGlyphOrder():
        g = glyf[name]
        if g.isComposite():
            for c in g.components: c.x = round(c.x*sx)
        elif g.numberOfContours > 0:
            for i,(x,y) in enumerate(g.coordinates): g.coordinates[i] = (round(x*sx), y)
        adv, lsb = hmtx[name]
        hmtx[name] = (round(adv*sx), lsb)
    for name in f.getGlyphOrder():
        g = glyf[name]; g.recalcBounds(glyf)
        adv,_ = hmtx[name]; hmtx[name] = (adv, getattr(g,'xMin',0) if g.numberOfContours else 0)
    if 'GPOS' in f: walk(f['GPOS'].table, sx, set())
    if 'kern' in f: del f['kern']

def rename(f, style, weight, italic):
    ribbi = style in ('Regular','Bold')
    fam1 = FAM if ribbi else f'{FAM} {style}'
    sub1 = ('Bold' if style=='Bold' else 'Regular') if not italic else ('Bold Italic' if style=='Bold' else 'Italic')
    typo = style + (' Italic' if italic else '')
    if typo == 'Regular Italic': typo = 'Italic'
    ps = ('RemotoBS-' + typo.replace(' ','')).replace('RegularItalic','Italic')
    n = f['name']
    cr = n.getDebugName(0)
    n.names = []
    for i, s in {0: cr, 1: fam1, 2: sub1, 3: f'1.000;{ps}', 4: f'{FAM} {typo}', 5: 'Version 1.000; based on Montserrat (SIL OFL 1.1)',
                 6: ps, 13: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
                 14: 'https://openfontlicense.org', 16: FAM, 17: typo}.items():
        n.setName(s, i, 3, 1, 0x409)
    for t in ('STAT','fvar','avar','gvar','HVAR','MVAR','DSIG'):
        if t in f: del f[t]
    os2 = f['OS/2']; os2.usWeightClass = weight
    sel = 0
    if italic: sel |= 1
    if style == 'Bold': sel |= 1<<5
    if not italic and style != 'Bold': sel |= 1<<6
    os2.fsSelection = (os2.fsSelection & (1<<7)) | sel
    f['head'].macStyle = (1 if style=='Bold' else 0) | (2 if italic else 0)
    return ps

os.makedirs(OUT, exist_ok=True)
for style, weight, stem_t, w_t in STYLES:
    w, sx = pick(stem_t, w_t)
    for italic in (False, True):
        f = inst(SRC[italic], w); hscale(f, sx)
        ps = rename(f, style, weight, italic)
        f.save(f'{OUT}/{ps}.ttf')
        print(ps, 'wght', w, 'scaleX %.3f' % sx)
