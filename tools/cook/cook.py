"""Orbit Acres: bakes game models in Blender.

    blender -b --factory-startup --python tools/cook/cook.py -- silo bay
    blender -b --factory-startup --python tools/cook/cook.py -- all

Reads what tools/cook/dump.js exported to tools/cook/raw/ and writes one file per
model to assets/cooked/. Each model becomes:

  a light shell   one watertight skin in place of hundreds of overlapping parts,
                  with rivets, seams and panels baked into its textures
  kept parts      things a shell can't hold, unchanged: lamps, glass, windows,
                  railings, ladders and other thin parts that stand clear of it
  textures        color, surface normals, and shading/roughness/metal

The textures come from the detailed model with weathering added here: grime in the
crevices, chipped paint on the edges, streaks running down the walls.
"""
import json
import math
import os
import struct
import sys
import time
import zlib

import bmesh
import bpy
from bpy_extras.bmesh_utils import bmesh_linked_uv_islands
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'raw')
WORK = os.path.join(HERE, 'work')
OUT = os.path.join(ROOT, 'assets', 'cooked')

TEXELS = 105           # Texture pixels per tile on the High files.
QUALITY = {'hi': 80, 'lo': 74}

VOXEL = 0.02           # Shell detail, in tiles.
CORE = 0.1             # Parts at least this thick always shape the shell.
CLOSE = 0.075          # Thin parts this close to the shell are baked into it.
THICK = 0.045          # Thin parts standing clear need this to survive in the shell.
TRIS_PER_AREA = 75     # Shell triangles per square tile of surface.
TRIS_MIN, TRIS_MAX = 500, 7000
TRIS_SKIP = 700        # Models this simple stay code-built.
THIN_KEEP = 0.25       # Thin kept parts are simplified to this share of their triangles.

# These stay as real geometry, whatever their shape.
KEEP_SURFS = {'lamp', 'window', 'glass', 'crystal', 'eye', 'chrome'}

LOG = open(os.path.join(HERE, 'cook.log'), 'a')


def say(*a):
    line = ' '.join(str(x) for x in a)
    LOG.write(line + '\n')
    LOG.flush()
    print(line, flush=True)


# ---- Scene ----

def setup():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'OPTIX'
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'GPU'
    s.cycles.use_denoising = False
    s.view_settings.view_transform = 'Standard'
    s.view_settings.look = 'None'
    b = s.render.bake
    b.use_selected_to_active = True
    b.use_cage = False
    b.cage_extrusion = 0.2
    b.max_ray_distance = 0.45
    b.margin = 6
    b.margin_type = 'EXTEND'
    b.use_clear = True
    b.target = 'IMAGE_TEXTURES'
    b.normal_space = 'TANGENT'


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for x in list(coll):
            if x.users == 0 or coll is bpy.data.materials:
                coll.remove(x)


def activate(obj, *others):
    bpy.ops.object.select_all(action='DESELECT')
    for o in others:
        o.select_set(True)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# ---- Reading a model ----

def load(key):
    with open(os.path.join(RAW, key + '.json')) as f:
        info = json.load(f)
    v = np.fromfile(os.path.join(RAW, key + '.bin'), dtype=np.float32).reshape(-1, 15)
    idx = np.fromfile(os.path.join(RAW, key + '.idx'), dtype=np.uint32).reshape(-1, 3)
    return info, v, idx


def to_blender(p):
    """The game is Y-up; Blender is Z-up."""
    return np.stack([p[:, 0], -p[:, 2], p[:, 1]], axis=1)


def to_game(p):
    return np.stack([p[:, 0], p[:, 2], -p[:, 1]], axis=1)


def make_mesh(name, verts, tris):
    """verts holds every game vertex; only the ones tris uses are kept."""
    used, inverse = np.unique(tris, return_inverse=True)
    faces = inverse.reshape(-1, 3)
    me = bpy.data.meshes.new(name)
    me.from_pydata(to_blender(verts[used, :3]).tolist(), [], faces.tolist())
    me.update()
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), dtype=bool))
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj, used


def extents(pts):
    """Sizes along a part's own axes, largest first."""
    c = pts - pts.mean(axis=0)
    if len(pts) < 3:
        return np.zeros(3)
    _, _, vt = np.linalg.svd(c, full_matrices=False)
    proj = c @ vt.T
    e = proj.max(axis=0) - proj.min(axis=0)
    return np.sort(np.concatenate([e, np.zeros(3 - len(e))]))[::-1]


def is_open(v, tris):
    """True when a surface has an edge with nothing on the other side."""
    ids = np.unique(tris)
    _, inv = np.unique(np.round(v[ids, :3] * 4096).astype(np.int64), axis=0, return_inverse=True)
    remap = np.zeros(int(ids.max()) + 1, np.int64)
    remap[ids] = inv.ravel()
    t = remap[tris]
    edges = np.sort(np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]]), axis=1)
    _, count = np.unique(edges, axis=0, return_counts=True)
    return bool(np.any(count == 1))


def solid_object(name, v, idx, group):
    """Joins parts into one mesh, giving open surfaces like roofs a real thickness."""
    def tris(parts):
        return np.concatenate([idx[p['t0']:p['t1']] for p in parts])
    closed = [p for p in group if not p['open']]
    gaps = [p for p in group if p['open']]
    obj = None
    if closed:
        obj, _ = make_mesh(name, v, tris(closed))
    if gaps:
        extra, _ = make_mesh(name + '-open', v, tris(gaps))
        bm = bmesh.new()
        bm.from_mesh(extra.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        bm.to_mesh(extra.data)
        bm.free()
        m = extra.modifiers.new('wall', 'SOLIDIFY')
        m.thickness = 0.07
        m.offset = -1
        m.use_rim = True
        activate(extra)
        bpy.ops.object.modifier_apply(modifier=m.name)
        if obj:
            activate(obj, extra)
            bpy.ops.object.join()
        else:
            obj = extra
            obj.name = name
    return obj


def voxel_shell(obj, size):
    m = obj.modifiers.new('voxel', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = size
    m.adaptivity = 0
    m.use_smooth_shade = True
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=m.name)


def classify(info, v, idx):
    """Sorts parts into shell, baked-in detail, and kept geometry."""
    parts = []
    for i0, i1, surf in info['parts']:
        t0, t1 = i0 // 3, i1 // 3
        ids = np.unique(idx[t0:t1])
        name = info['surfs'][surf] if surf >= 0 else 'hull'
        p = {'t0': t0, 't1': t1, 'ids': ids, 'surf': name, 'e': extents(v[ids, :3]), 'open': is_open(v, idx[t0:t1])}
        c = v[idx[t0:t1], :3]
        p['area'] = float(np.linalg.norm(np.cross(c[:, 1] - c[:, 0], c[:, 2] - c[:, 0]), axis=1).sum() / 2)
        p['glow'] = bool(np.any(np.abs(v[ids, 12]) > 0.001))
        parts.append(p)
    fixed = [p for p in parts if p['glow'] or p['surf'] in KEEP_SURFS]
    rest = [p for p in parts if not (p['glow'] or p['surf'] in KEEP_SURFS)]
    core = [p for p in rest if p['e'][2] >= CORE]
    thin = [p for p in rest if p['e'][2] < CORE]
    if not core:
        return None

    def tris_of(group):
        return np.concatenate([idx[p['t0']:p['t1']] for p in group]) if group else np.zeros((0, 3), np.uint32)

    def farthest(ev, p, limit):
        """How far a thin part strays from a surface, up to the limit."""
        far = 0.0
        tri = idx[p['t0']:p['t1']]
        mids = v[tri[:: max(1, len(tri) // 64)], :3].mean(axis=1)
        for q in to_blender(np.concatenate([mids, v[p['ids'][:: max(1, len(p['ids']) // 32)], :3]])):
            hit, loc, _, _ = ev.closest_point_on_mesh(q.tolist(), distance=limit)
            far = max(far, float(np.linalg.norm(np.array(loc) - q)) if hit else limit)
            if far >= limit:
                break
        return far

    # A rough shell of the big parts says which thin parts sit on the surface.
    obj = solid_object('rough', v, idx, core)
    voxel_shell(obj, 0.035)
    dep = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dep)
    glass, gev = None, None
    if fixed:
        glass, _ = make_mesh('fixed', v, tris_of(fixed))
        gev = glass.evaluated_get(bpy.context.evaluated_depsgraph_get())
    detail, loose, front = [], [], []
    for p in thin:
        # Window bars would vanish behind real glass, so they stay real too.
        if gev is not None and farthest(gev, p, 0.07) < 0.07:
            front.append(p)
        elif farthest(ev, p, CLOSE * 1.01) <= CLOSE:
            detail.append(p)
        else:
            loose.append(p)
    bpy.data.objects.remove(obj, do_unlink=True)
    if glass:
        bpy.data.objects.remove(glass, do_unlink=True)
    # A thin plate's two faces add up to about twice its outline; a ring or a frame is far less.
    plates = [p for p in loose if p['e'][2] < 0.065 and p['e'][1] >= 0.3 and p['area'] >= 0.6 * p['e'][0] * p['e'][1]]
    loose = [p for p in loose if not any(p is q for q in plates)]
    stands = [p for p in loose if p['e'][2] >= THICK and p['e'][1] >= THICK]
    wires = [p for p in loose if not (p['e'][2] >= THICK and p['e'][1] >= THICK)]
    body = core + stands
    fixed = fixed + plates
    count = lambda g: sum(p['t1'] - p['t0'] for p in g)
    say('  parts: %d in the shell, %d baked in, %d exact (%d tris), %d thin (%d tris)' % (len(body), len(detail), len(fixed), count(fixed), len(front) + len(wires), count(front) + count(wires)))
    return body, tris_of(detail), tris_of(fixed), tris_of(front + wires)


# ---- Materials ----

class Graph:
    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.tree = self.mat.node_tree
        self.tree.nodes.clear()

    def node(self, kind, **props):
        n = self.tree.nodes.new(kind)
        for k, val in props.items():
            setattr(n, k, val)
        return n

    def link(self, a, b):
        self.tree.links.new(a, b)

    def put(self, sock, val):
        if isinstance(val, bpy.types.NodeSocket):
            self.link(val, sock)
        else:
            sock.default_value = val

    def math(self, op, a, b=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        self.put(n.inputs[0], a)
        if b is not None:
            self.put(n.inputs[1], b)
        return n.outputs[0]

    def add(self, a, b):
        return self.math('ADD', a, b)

    def sub(self, a, b):
        return self.math('SUBTRACT', a, b)

    def mul(self, a, b):
        return self.math('MULTIPLY', a, b)

    def ramp(self, val, lo, hi):
        """0 below lo, 1 above hi, smooth between."""
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP')
        self.put(n.inputs['Value'], val)
        n.inputs['From Min'].default_value = lo
        n.inputs['From Max'].default_value = hi
        return n.outputs['Result']

    def lerp(self, t, a, b):
        n = self.node('ShaderNodeMapRange', interpolation_type='LINEAR', clamp=True)
        self.put(n.inputs['Value'], t)
        n.inputs['From Min'].default_value = 0
        n.inputs['From Max'].default_value = 1
        self.put(n.inputs['To Min'], a)
        self.put(n.inputs['To Max'], b)
        return n.outputs['Result']

    def mix(self, t, a, b, blend='MIX'):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend, clamp_factor=True)
        self.put(n.inputs[0], t)
        self.put(n.inputs[6], a)
        self.put(n.inputs[7], b)
        return n.outputs[2]

    def noise(self, vec, scale, detail=5, rough=0.55):
        n = self.node('ShaderNodeTexNoise')
        self.put(n.inputs['Vector'], vec)
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        return n.outputs[0]

    def stretch(self, vec, x, y, z):
        n = self.node('ShaderNodeVectorMath', operation='MULTIPLY')
        self.put(n.inputs[0], vec)
        n.inputs[1].default_value = (x, y, z)
        return n.outputs[0]

    def occlusion(self, dist, samples, inside=False, local=True):
        n = self.node('ShaderNodeAmbientOcclusion', samples=samples, inside=inside, only_local=local)
        n.inputs['Distance'].default_value = dist
        return n.outputs['AO']


# Which live surface detail the game draws over each material (see G.SURF).
DETAIL = {'hull': 1, 'metal': 2, 'dark': 2, 'rubber': 3, 'wood': 3, 'soil': 3, 'rock': 3, 'fruit': 4, 'fur': 4, 'skin': 4, 'fabric': 4}

# How each material weathers: grime in crevices, wear on edges, streaks, mottling.
WEATHER = {
    'hull': dict(grime=1.0, wear=0.6, streak=0.7, mottle=0.14, bare=(0.56, 0.57, 0.6)),
    'paint': dict(grime=0.9, wear=0.55, streak=0.6, mottle=0.1, bare=(0.56, 0.57, 0.6)),
    'metal': dict(grime=0.9, wear=0.4, streak=0.5, mottle=0.18, bare=(0.86, 0.87, 0.9)),
    'dark': dict(grime=0.6, wear=0.4, streak=0.2, mottle=0.16, bare=(0.42, 0.42, 0.46)),
    'rubber': dict(grime=0.3, wear=0.0, streak=0.1, mottle=0.1, bare=(0.2, 0.2, 0.2)),
    'wood': dict(grime=0.75, wear=0.3, streak=0.25, mottle=0.2, bare=(0.62, 0.48, 0.34)),
    'soil': dict(grime=0.5, wear=0.0, streak=0.0, mottle=0.25, bare=(0.3, 0.2, 0.2)),
    'rock': dict(grime=0.7, wear=0.25, streak=0.1, mottle=0.25, bare=(0.6, 0.58, 0.62)),
    'fabric': dict(grime=0.4, wear=0.0, streak=0.1, mottle=0.1, bare=(0.5, 0.5, 0.5)),
}
PLAIN = dict(grime=0.4, wear=0.0, streak=0.05, mottle=0.06, bare=(0.5, 0.5, 0.5))


def make_material(name):
    g = Graph('hi-' + name)
    w = WEATHER.get(name, PLAIN)

    coord = g.node('ShaderNodeTexCoord').outputs['Object']
    col = g.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Col').outputs['Color']
    rm = g.node('ShaderNodeSeparateXYZ')
    g.link(g.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='RM').outputs['Vector'], rm.inputs[0])
    rough, metal = rm.outputs[0], rm.outputs[1]

    grain = g.noise(coord, 26, 6, 0.6)
    big = g.noise(coord, 1.7, 5, 0.55)
    # Runs of dirt go up and down the walls.
    runs = g.noise(g.stretch(coord, 7, 7, 0.55), 1, 5, 0.55)
    open_air = g.occlusion(0.22, 12)
    seam_air = g.occlusion(0.06, 8)
    # Height above the ground, for dust thrown up around the foot of things.
    up = g.node('ShaderNodeSeparateXYZ')
    g.link(coord, up.inputs[0])
    edge = g.sub(1, g.occlusion(0.015, 8, inside=True))

    height = g.mul(grain, 0.006)
    base = col

    # Mottling, so no surface is one flat color.
    mottle = g.mul(g.sub(big, 0.5), w['mottle'] * 2.4)
    tint = g.node('ShaderNodeCombineColor')
    for i in range(3):
        g.link(g.add(1.0, mottle), tint.inputs[i])
    base = g.mix(1.0, base, tint.outputs[0], 'MULTIPLY')

    # Streaks.
    if w['streak'] > 0:
        streak = g.mul(g.ramp(g.add(runs, g.mul(g.sub(big, 0.5), 0.5)), 0.46, 0.66), w['streak'])
        base = g.mix(streak, base, g.mix(1.0, base, (0.5, 0.46, 0.44, 1), 'MULTIPLY'))
        rough = g.add(rough, g.mul(streak, 0.22))

    # Grime settles where air doesn't reach.
    dirt = g.mul(g.ramp(g.sub(1, open_air), 0.08, 0.72), w['grime'])
    dirt = g.mul(dirt, g.lerp(big, 0.65, 1.0))
    base = g.mix(dirt, base, g.mix(1.0, base, (0.3, 0.27, 0.27, 1), 'MULTIPLY'))
    rough = g.add(rough, g.mul(dirt, 0.34))
    metal = g.mul(metal, g.sub(1, g.mul(dirt, 0.8)))

    # A dark wash in every seam, the way model makers pick out panel lines.
    wash = g.mul(g.ramp(g.sub(1, seam_air), 0.1, 0.55), min(1.0, w['grime'] * 1.1))
    base = g.mix(wash, base, g.mix(1.0, base, (0.16, 0.14, 0.16, 1), 'MULTIPLY'))
    rough = g.add(rough, g.mul(wash, 0.25))

    # Dust climbs the lower walls.
    dust = g.mul(g.ramp(g.sub(1.5, up.outputs[2]), 0.0, 1.15), g.lerp(big, 0.35, 0.9))
    dust = g.mul(dust, 0.65 if name not in ('soil', 'rock') else 0.15)
    base = g.mix(dust, base, g.mix(1.0, base, (0.74, 0.66, 0.6, 1), 'MULTIPLY'))
    rough = g.add(rough, g.mul(dust, 0.3))

    # Paint rubs off high edges.
    if w['wear'] > 0:
        # Capped, or thin trim counts as all edge and breaks up into dashes.
        chip = g.ramp(g.add(g.mul(g.math('MINIMUM', edge, 0.55), 2), g.mul(g.sub(grain, 0.5), 1.4)), 1.2, 1.4)
        chip = g.mul(chip, w['wear'])
        base = g.mix(chip, base, (*w['bare'], 1))
        rough = g.lerp(chip, rough, 0.36)
        metal = g.lerp(chip, metal, 1.0 if name in ('hull', 'paint', 'metal', 'dark') else metal)
        height = g.sub(height, g.mul(chip, 0.004))
    rough = g.math('MAXIMUM', rough, 0.05)
    rough = g.math('MINIMUM', rough, 1.0)

    # Round off hard edges, then add the fine relief.
    bevel = g.node('ShaderNodeBevel', samples=8)
    bevel.inputs['Radius'].default_value = 0.014
    bump = g.node('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 1
    bump.inputs['Distance'].default_value = 1
    g.link(height, bump.inputs['Height'])
    g.link(bevel.outputs['Normal'], bump.inputs['Normal'])

    bsdf = g.node('ShaderNodeBsdfPrincipled')
    g.link(base, bsdf.inputs['Base Color'])
    g.link(rough, bsdf.inputs['Roughness'])
    g.link(metal, bsdf.inputs['Metallic'])
    g.link(bump.outputs[0], bsdf.inputs['Normal'])

    emit = g.node('ShaderNodeEmission')
    out = g.node('ShaderNodeOutputMaterial')
    g.link(emit.outputs[0], out.inputs['Surface'])
    # Shade from everything around, including the ground and kept parts.
    shade = g.occlusion(1.4, 24, local=False)
    level = g.node('ShaderNodeValue')
    level.outputs[0].default_value = DETAIL.get(name, 0) / 4
    return {'mat': g.mat, 'graph': g, 'bsdf': bsdf, 'emit': emit, 'out': out, 'base': base, 'rough': rough, 'metal': metal, 'ao': shade, 'cls': level.outputs[0]}


def show_pass(mats, name):
    for m in mats:
        g = m['graph']
        if name == 'normal':
            g.link(m['bsdf'].outputs[0], m['out'].inputs['Surface'])
            continue
        g.link(m['emit'].outputs[0], m['out'].inputs['Surface'])
        g.link(m[name], m['emit'].inputs['Color'])


def add_attributes(me, v, used):
    rgba = np.ones((len(used), 4), np.float32)
    rgba[:, :3] = v[used, 6:9]
    me.attributes.new('Col', 'FLOAT_COLOR', 'POINT').data.foreach_set('color', rgba.ravel())
    me.attributes.new('RM', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', v[used, 9:12].ravel())
    me.attributes.new('AO', 'FLOAT', 'POINT').data.foreach_set('value', v[used, 13].ravel())


def paint_source(obj, v, used, tris_surf):
    """Gives the detailed model its colors and materials."""
    me = obj.data
    add_attributes(me, v, used)
    names = sorted(set(tris_surf))
    mats = [make_material(n) for n in names]
    for m in mats:
        me.materials.append(m['mat'])
    slot = {n: i for i, n in enumerate(names)}
    me.polygons.foreach_set('material_index', np.array([slot[n] for n in tris_surf], dtype=np.int32))
    me.update()
    return mats


# ---- Baking ----

def bake(obj, src, kind, size, samples, colorspace):
    img = bpy.data.images.new('bake', size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = colorspace
    bpy.context.scene.render.bake.margin = max(3, size // 170)
    for mat in obj.data.materials:
        n = mat.node_tree.nodes.get('target')
        n.image = img
        mat.node_tree.nodes.active = n
    bpy.context.scene.cycles.samples = samples
    activate(obj, src)
    bpy.ops.object.bake(type=kind)
    return img


def save_image(img, path, quality):
    img.filepath_raw = path
    img.file_format = 'WEBP' if path.endswith('.webp') else 'PNG'
    img.save(quality=quality)


def pixels(img):
    n = img.size[0] * img.size[1] * 4
    px = np.zeros(n, np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(img.size[1], img.size[0], 4)


def combine(r, g, b):
    """Packs three grey maps into the channels of one array."""
    px = pixels(r).copy()
    px[:, :, 1] = pixels(g)[:, :, 0]
    px[:, :, 2] = pixels(b)[:, :, 0]
    px[:, :, 3] = 1
    return px


def shrunk(px, size):
    """Averages an image down by a whole factor."""
    k = px.shape[0] // size
    return px if k <= 1 else px.reshape(size, k, size, k, 4).mean(axis=(1, 3))


def fill_gaps(px, mask):
    """Spreads colors across the empty parts of a sheet.

    Far from the camera the game reads small versions of each texture, where any
    black left between islands leaks into their edges and shows up as dashes.
    """
    colors, weights = [px * mask[:, :, None]], [mask.astype(np.float32)]
    while colors[-1].shape[0] > 1:
        n = colors[-1].shape[0] // 2
        colors.append(colors[-1].reshape(n, 2, n, 2, 4).sum(axis=(1, 3)))
        weights.append(weights[-1].reshape(n, 2, n, 2).sum(axis=(1, 3)))
    out = colors[-1] / np.maximum(weights[-1][:, :, None], 1e-6)
    for c, w in zip(reversed(colors[:-1]), reversed(weights[:-1])):
        up = np.repeat(np.repeat(out, 2, axis=0), 2, axis=1)
        out = np.where(w[:, :, None] > 0, c / np.maximum(w[:, :, None], 1e-6), up)
    return out


def to_image(px, colorspace):
    size = px.shape[0]
    img = bpy.data.images.new('out', size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = colorspace
    img.pixels.foreach_set(px.ravel())
    return img


# ---- Writing the result ----

def shell_arrays(obj):
    me = obj.data
    me.calc_loop_triangles()
    n = len(me.loops)
    vidx = np.zeros(n, np.int32)
    me.loops.foreach_get('vertex_index', vidx)
    co = np.zeros(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    nor = np.zeros(n * 3, np.float32)
    me.corner_normals.foreach_get('vector', nor)
    uv = np.zeros(n * 2, np.float32)
    me.attributes[me.uv_layers.active.name].data.foreach_get('vector', uv)
    tris = np.zeros(len(me.loop_triangles) * 3, np.int32)
    me.loop_triangles.foreach_get('loops', tris)
    nor = nor.reshape(-1, 3)
    uv = uv.reshape(-1, 2)
    # Corners that agree become one vertex.
    key = np.column_stack([vidx, np.round(nor * 2048).astype(np.int32), np.round(uv * 65535).astype(np.int32)])
    _, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
    pos = to_game(co.reshape(-1, 3)[vidx[first]])
    return pos, to_game(nor[first]), uv[first], inverse.ravel()[tris].reshape(-1, 3)


def section(blob, sections, name, arr):
    while len(blob) % 4:
        blob.append(0)
    sections[name] = [len(blob), arr.size]
    blob.extend(arr.tobytes())


def deltas(arr, stride):
    """Neighboring values are close, which deflates far better as differences."""
    out = arr.copy().reshape(-1, stride)
    out[1:] = arr.reshape(-1, stride)[1:] - arr.reshape(-1, stride)[:-1]
    return out.ravel()


def write_pack(key, tier, shell, kept, images):
    pos, nor, uv, tri = shell
    allpos = pos if kept is None else np.concatenate([pos, kept[0]])
    lo, hi = allpos.min(axis=0), allpos.max(axis=0)
    span = np.maximum(hi - lo, 1e-5)
    blob = bytearray()
    sec = {}
    q = lambda p: np.round((p - lo) / span * 65535).astype(np.uint16)
    section(blob, sec, 'p', deltas(q(pos), 3))
    section(blob, sec, 'n', np.round(nor * 32767).astype(np.int16))
    # v runs down the image in the browser.
    flip = np.stack([uv[:, 0], 1 - uv[:, 1]], axis=1)
    section(blob, sec, 'u', deltas(np.round(np.clip(flip, 0, 1) * 65535).astype(np.uint16), 2))
    section(blob, sec, 'i', deltas(tri.ravel().astype(np.uint32 if len(pos) > 65000 else np.uint16), 3))
    head = {'lo': lo.tolist(), 'span': span.tolist(), 'a': [len(pos), len(tri)], 'b': [0, 0]}
    if kept is not None:
        kp, kn, kc, ks, km, kt = kept
        section(blob, sec, 'P', deltas(q(kp), 3))
        section(blob, sec, 'N', np.round(kn * 32767).astype(np.int16))
        section(blob, sec, 'C', np.round(np.clip(kc, 0, 1) * 65535).astype(np.uint16))
        section(blob, sec, 'S', np.round(ks * 1000).astype(np.int16))
        section(blob, sec, 'M', np.round(km * 1000).astype(np.int16))
        section(blob, sec, 'I', deltas(kt.ravel().astype(np.uint32 if len(kp) > 65000 else np.uint16), 3))
        head['b'] = [len(kp), len(kt)]
    pack = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = pack.compress(bytes(blob)) + pack.flush()
    head['z'] = [len(packed), len(blob)]
    tail = bytearray()
    for name, path in images.items():
        with open(path, 'rb') as f:
            data = f.read()
        sec[name] = [len(tail), len(data)]
        tail.extend(data)
    head['s'] = sec
    text = json.dumps(head, separators=(',', ':')).encode()
    path = os.path.join(OUT, key + '.' + tier + '.bin')
    with open(path, 'wb') as f:
        f.write(b'OAC2' + struct.pack('<I', len(text)) + text + packed + bytes(tail))
    return os.path.getsize(path)


def thin_arrays(v, tris):
    """Simplifies railings and rods, keeping their colors."""
    obj, used = make_mesh('thin', v, tris)
    me = obj.data
    add_attributes(me, v, used)
    m = obj.modifiers.new('less', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = THIN_KEEP
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=m.name)
    me.calc_loop_triangles()
    n = len(me.vertices)
    co = np.zeros(n * 3, np.float32)
    me.vertices.foreach_get('co', co)
    nor = np.zeros(len(me.loops) * 3, np.float32)
    me.corner_normals.foreach_get('vector', nor)
    vidx = np.zeros(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', vidx)
    rgba = np.zeros(n * 4, np.float32)
    me.attributes['Col'].data.foreach_get('color', rgba)
    rm = np.zeros(n * 3, np.float32)
    me.attributes['RM'].data.foreach_get('vector', rm)
    ao = np.zeros(n, np.float32)
    me.attributes['AO'].data.foreach_get('value', ao)
    tri = np.zeros(len(me.loop_triangles) * 3, np.int32)
    me.loop_triangles.foreach_get('loops', tri)
    nor = nor.reshape(-1, 3)
    key = np.column_stack([vidx, np.round(nor * 2048).astype(np.int32)])
    _, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
    ids = vidx[first]
    surf = np.column_stack([rm.reshape(-1, 3)[ids], np.zeros(len(ids), np.float32)])
    out = (to_game(co.reshape(-1, 3)[ids]), to_game(nor[first]), rgba.reshape(-1, 4)[ids, :3], surf, ao[ids].reshape(-1, 1), inverse.ravel()[tri].reshape(-1, 3))
    bpy.data.objects.remove(obj, do_unlink=True)
    return out


def exact_arrays(v, tris):
    used = np.unique(tris)
    remap = np.zeros(len(v), np.int64)
    remap[used] = np.arange(len(used))
    return (v[used, :3], v[used, 3:6], v[used, 6:9], v[used, 9:13], v[used, 13:14], remap[tris])


def join_kept(a, b):
    if a is None or len(a[5]) == 0:
        return b
    if b is None or len(b[5]) == 0:
        return a
    n = len(a[0])
    return tuple(np.concatenate([x, y]) for x, y in zip(a[:5], b[:5])) + (np.concatenate([a[5], b[5] + n]),)


def unfold(obj):
    """Lays the shell flat, giving the sides the room and undersides little."""
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70), island_margin=0.002, area_weight=0.0, correct_aspect=True, scale_to_bounds=True)
    bm = bmesh.from_edit_mesh(obj.data)
    layer = bm.loops.layers.uv.active
    for island in bmesh_linked_uv_islands(bm, layer):
        area = sum(f.calc_area() for f in island) or 1
        down = sum(f.normal.z * f.calc_area() for f in island) / area
        if down < -0.35:
            k = 0.3
            uvs = [l[layer].uv for f in island for l in f.loops]
            mid = sum(uvs, type(uvs[0])((0, 0))) / len(uvs)
            for u in uvs:
                u[:] = mid + (u - mid) * k
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=0.003, margin_method='ADD', shape_method='CONCAVE', scale=True)
    bpy.ops.object.mode_set(mode='OBJECT')


def trim_underside(obj):
    """Nothing ever sees the bottom of a building."""
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(obj.data)
    drop = [f for f in bm.faces if f.normal.z < -0.7 and f.calc_center_median().z < 0.06]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode='OBJECT')


# ---- One model ----

def cook(key):
    start = time.time()
    clear_scene()
    info, v, idx = load(key)
    say(key + ': %d triangles' % len(idx))
    if len(idx) < TRIS_SKIP:
        say('  too simple to gain anything: stays code-built')
        return None
    sorted_parts = classify(info, v, idx)
    if sorted_parts is None:
        say('  nothing to wrap: stays code-built')
        return None
    body, baked, exact, thin = sorted_parts
    keep = np.concatenate([exact, thin])

    # The detailed model: everything the shell has to look like.
    tri_surf = []
    for i0, i1, surf in info['parts']:
        tri_surf.extend([info['surfs'][surf]] * ((i1 - i0) // 3))
    tri_surf = np.array(tri_surf)
    skip = set(map(tuple, keep.tolist()))
    want = np.array([tuple(t) not in skip for t in idx.tolist()])
    src, used = make_mesh('source', v, idx[want])
    mats = paint_source(src, v, used, tri_surf[want].tolist())

    # The shell.
    shell = solid_object('shell', v, idx, body)
    voxel_shell(shell, VOXEL)
    me = shell.data
    me.calc_loop_triangles()
    area = sum(t.area for t in me.loop_triangles)
    target = int(max(TRIS_MIN, min(TRIS_MAX, area * TRIS_PER_AREA, len(idx) * 0.6)))
    m = shell.modifiers.new('less', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = min(1.0, target / max(1, len(me.loop_triangles)))
    activate(shell)
    bpy.ops.object.modifier_apply(modifier=m.name)
    trim_underside(shell)
    me = shell.data
    me.set_sharp_from_angle(angle=math.radians(40))
    me.update()
    me.calc_loop_triangles()
    say('  shell: area %.1f, %d triangles' % (area, len(me.loop_triangles)))
    unfold(shell)

    lm = bpy.data.materials.new('shell')
    lm.use_nodes = True
    tex = lm.node_tree.nodes.new('ShaderNodeTexImage')
    tex.name = 'target'
    me.materials.append(lm)

    # Things around the model still cast shade on it.
    kept_obj = None
    if len(keep):
        kept_obj, _ = make_mesh('kept', v, keep)
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = 'ground'

    # Bigger buildings get bigger textures, so every model is equally sharp.
    size = 2 ** int(min(10, max(7, round(math.log2(TEXELS * math.sqrt(area * 1.15))))))
    made = {}
    show_pass(mats, 'base')
    made['base'] = pixels(bake(shell, src, 'EMIT', size, 32, 'sRGB')).copy()
    show_pass(mats, 'normal')
    made['normal'] = pixels(bake(shell, src, 'NORMAL', size, 16, 'Non-Color')).copy()
    show_pass(mats, 'ao')
    ao = bake(shell, src, 'EMIT', size, 32, 'Non-Color')
    show_pass(mats, 'rough')
    rough = bake(shell, src, 'EMIT', size, 16, 'Non-Color')
    show_pass(mats, 'metal')
    metal = bake(shell, src, 'EMIT', size, 16, 'Non-Color')
    made['orm'] = combine(ao, rough, metal)
    show_pass(mats, 'cls')
    classes = bake(shell, src, 'EMIT', max(128, size // 4), 1, 'Non-Color')
    # A baked normal always points outward, so an empty texel is one with no blue.
    covered = made['normal'][:, :, 2] > 0.05
    made = {name: fill_gaps(px, covered) for name, px in made.items()}
    say('  baked %dpx in %.0fs' % (size, time.time() - start))

    # Kept parts travel with their original look.
    kept = None
    if len(exact):
        kept = exact_arrays(v, exact)
    if len(thin):
        kept = join_kept(kept, thin_arrays(v, thin))

    arrays = shell_arrays(shell)
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    total = {}
    for tier in ('hi', 'lo'):
        px = size if tier == 'hi' else size // 2
        files = {}
        for name, data in made.items():
            want = max(64, px // 2) if name == 'orm' else px
            one = to_image(shrunk(data, want), 'sRGB' if name == 'base' else 'Non-Color')
            path = os.path.join(WORK, '%s.%s.%s.webp' % (key, tier, name))
            save_image(one, path, QUALITY[tier])
            files[name] = path
            if tier == 'hi':
                save_image(one, path[:-5] + '.png', 100)
        path = os.path.join(WORK, '%s.cls.webp' % key)
        save_image(classes, path, 100)
        files['cls'] = path
        total[tier] = write_pack(key, tier, arrays, kept, files)
    tri_kept = 0 if kept is None else len(kept[5])
    say('  done in %.0fs: %d + %d triangles, hi %.0f KB, lo %.0f KB' % (time.time() - start, len(arrays[3]), tri_kept, total['hi'] / 1024, total['lo'] / 1024))
    return {'tris': [len(arrays[3]), tri_kept], 'hi': total['hi'], 'lo': total['lo']}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    keys = argv
    if keys == ['all']:
        keys = sorted(f[:-5] for f in os.listdir(RAW) if f.endswith('.json') and f != 'detail.json')
    setup()
    for key in keys:
        try:
            cook(key)
        except Exception:
            import traceback
            say('FAILED ' + key + ': ' + traceback.format_exc())
    say('ALL DONE')


try:
    main()
except Exception:
    import traceback
    say(traceback.format_exc())
    raise
