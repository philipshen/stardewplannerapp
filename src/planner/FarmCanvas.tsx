import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { Atlas, Canvas, Group, Image as SkiaImage, Path, Rect, Skia, useImage } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ITEM_BY_ID, Item, SPRITES } from '../data/items';
import { MAP_BY_ID, mapImage, terrainAt } from '../data/maps';
import { WORLD_SHEETS } from '../data/generated/assets';
import { useEditor } from '../store/editor';
import {
  blockedTrees, buildOcc, canPlace, coverage, eraseAt, Edit, key, layerOf, lineTiles, objectAt, Placed, placeItem, RANGE_STYLE, RangeKind,
  offsetsFor, rectTiles, stampPositions, terrainOk, uid,
} from './model';
import { buildDrawData, NEAREST, renderPlanPNG, spriteKey, TILE } from './render';

export type FarmCanvasHandle = {
  fit: () => void;
  zoomBy: (f: number) => void;
  exportPNG: (scale: number) => string | null;
  focus: (x: number, y: number) => void;
};

type Preview =
  | { kind: 'ghost'; item: Item; x: number; y: number; ok: boolean }
  | { kind: 'rect'; x0: number; y0: number; x1: number; y1: number; erase: boolean; item: Item | null; outline: boolean }
  | { kind: 'move'; dx: number; dy: number; ok: boolean }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number }
  | null;

const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

export const FarmCanvas = forwardRef<FarmCanvasHandle, { onSelect?: (o: Placed | null) => void }>(function FarmCanvas({ onSelect }, ref) {
  const plan = useEditor((s) => s.plan)!;
  const occ = useEditor((s) => s.occ);
  const tool = useEditor((s) => s.tool);
  const layers = useEditor((s) => s.layers);
  const selection = useEditor((s) => s.selection);
  const map = MAP_BY_ID[plan.map];
  const terrain = useImage(mapImage(plan.map, plan.season));
  const sheet = useImage(WORLD_SHEETS[0]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [preview, setPreview] = useState<Preview>(null);

  // ---------------------------------------------------------------- view transform
  const tx = useSharedValue(0), ty = useSharedValue(0), sc = useSharedValue(1);
  const minSc = useSharedValue(0.2);
  const transform = useDerivedValue(() => [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }]);
  const gridOpacity = useDerivedValue(() => Math.max(0, Math.min(0.5, (sc.value - 0.9) * 0.6)));
  const worldW = map.w * TILE, worldH = map.h * TILE;
  const vw = useSharedValue(1), vh = useSharedValue(1);
  useEffect(() => { vw.value = size.w || 1; vh.value = size.h || 1; }, [size, vw, vh]);
  /** Keep part of the map on screen (at most 40% of the viewport may be empty past an edge). */
  const clampT = (t: number, view: number, world: number) => {
    'worklet';
    const m = view * 0.4;
    const lo = Math.min(view - world - m, m), hi = Math.max(m, view - world - m);
    return Math.max(lo, Math.min(hi, t));
  };

  const fitScale = useCallback(() => (size.w && size.h ? Math.min(size.w / worldW, size.h / worldH) * 0.96 : 1), [size, worldW, worldH]);
  const fit = useCallback(() => {
    const s = fitScale();
    sc.value = withTiming(s, { duration: 250 });
    tx.value = withTiming((size.w - worldW * s) / 2, { duration: 250 });
    ty.value = withTiming((size.h - worldH * s) / 2, { duration: 250 });
  }, [fitScale, size, worldW, worldH, sc, tx, ty]);
  const focus = useCallback((x: number, y: number, s?: number) => {
    const scale = s ?? Math.max(sc.value, 1.5);
    sc.value = withTiming(scale, { duration: 250 });
    tx.value = withTiming(size.w / 2 - (x + 0.5) * TILE * scale, { duration: 250 });
    ty.value = withTiming(size.h / 2 - (y + 0.5) * TILE * scale, { duration: 250 });
  }, [size, sc, tx, ty]);

  const didInit = useRef<string | null>(null);
  useEffect(() => {
    if (!size.w || didInit.current === plan.id) return;
    didInit.current = plan.id;
    minSc.value = fitScale() * 0.7;
    if (map.kind === 'farm') {
      const home = plan.objects.find((o) => o.id === 'farmhouse') ?? plan.objects[0];
      const s = Math.max(fitScale(), Math.min(1.6, size.w / (TILE * 22)));
      sc.value = s;
      const cx = home ? home.x + 4 : map.w / 2, cy = home ? home.y + 6 : map.h / 2;
      tx.value = Math.max(size.w - worldW * s, Math.min(0, size.w / 2 - cx * TILE * s));
      ty.value = Math.max(size.h - worldH * s, Math.min(0, size.h / 2 - cy * TILE * s));
    } else {
      const s = fitScale();
      sc.value = s; tx.value = (size.w - worldW * s) / 2; ty.value = (size.h - worldH * s) / 2;
    }
  }, [size, plan.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomBy = useCallback((f: number) => {
    const ns = Math.max(minSc.value, Math.min(6, sc.value * f));
    const cx = size.w / 2, cy = size.h / 2;
    tx.value = withTiming(cx - ((cx - tx.value) * ns) / sc.value, { duration: 180 });
    ty.value = withTiming(cy - ((cy - ty.value) * ns) / sc.value, { duration: 180 });
    sc.value = withTiming(ns, { duration: 180 });
  }, [size, sc, tx, ty, minSc]);

  // ---------------------------------------------------------------- draw data
  const moving = preview?.kind === 'move' ? selection : undefined;
  const data = useMemo(() => (sheet ? buildDrawData(plan, occ, moving) : null), [sheet, plan.ground, plan.objects, plan.season, occ, moving]); // eslint-disable-line react-hooks/exhaustive-deps

  const gridPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (let x = 0; x <= map.w; x++) { p.moveTo(x * TILE, 0); p.lineTo(x * TILE, worldH); }
    for (let y = 0; y <= map.h; y++) { p.moveTo(0, y * TILE); p.lineTo(worldW, y * TILE); }
    return p;
  }, [map, worldW, worldH]);

  const blockedPath = useMemo(() => {
    if (!layers.blocked) return null;
    const p = Skia.Path.Make();
    const probe = ITEM_BY_ID['chest'];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (!terrainOk(probe, map, x, y)) p.addRect(Skia.XYWHRect(x * TILE, y * TILE, TILE, TILE));
    return p;
  }, [layers.blocked, map]);

  const coverPaths = useMemo(() => {
    if (!layers.coverage) return [];
    const groups = new Set(Object.entries({ water: layers.water, crow: layers.crow, junimo: layers.junimo, bee: layers.bee, log: true }).filter(([, v]) => v).map(([k]) => k));
    const cov = coverage(plan.objects, groups);
    const colors: Record<string, string> = { water: RANGE_STYLE.spr1.color, crow: RANGE_STYLE.scare8.color, junimo: RANGE_STYLE.junimo.color, bee: RANGE_STYLE.bee.color, log: RANGE_STYLE.log.color };
    return Object.entries(cov).filter(([, s]) => s.size).map(([g, s]) => {
      const p = Skia.Path.Make();
      for (const k of s) { const [x, y] = k.split(',').map(Number); p.addRect(Skia.XYWHRect(x * TILE, y * TILE, TILE, TILE)); }
      return { p, color: colors[g] };
    });
  }, [layers, plan.objects]);

  const warnPath = useMemo(() => {
    if (!layers.warnings) return null;
    const bad = blockedTrees(plan.objects, occ);
    if (!bad.size) return null;
    const p = Skia.Path.Make();
    for (const o of plan.objects) if (bad.has(o.u)) p.addRect(Skia.XYWHRect(o.x * TILE - TILE, o.y * TILE - TILE, TILE * 3, TILE * 3));
    return p;
  }, [layers.warnings, plan.objects, occ]);

  const selPath = useMemo(() => {
    if (!selection.size) return null;
    const p = Skia.Path.Make();
    const dx = preview?.kind === 'move' ? preview.dx : 0, dy = preview?.kind === 'move' ? preview.dy : 0;
    for (const o of plan.objects) {
      if (!selection.has(o.u)) continue;
      const it = ITEM_BY_ID[o.id];
      if (it) p.addRect(Skia.XYWHRect((o.x + dx) * TILE, (o.y + dy) * TILE, it.w * TILE, it.h * TILE));
    }
    return p;
  }, [selection, plan.objects, preview]);

  /** Coverage of the selected/ghosted item, always shown. */
  const focusRange = useMemo(() => {
    let src: { it: Item; x: number; y: number } | null = null;
    if (preview?.kind === 'ghost' && preview.item.range) src = { it: preview.item, x: preview.x, y: preview.y };
    else if (selection.size === 1) {
      const o = plan.objects.find((p) => selection.has(p.u));
      const it = o && ITEM_BY_ID[o.id];
      if (o && it?.range) src = { it, x: o.x + (preview?.kind === 'move' ? preview.dx : 0), y: o.y + (preview?.kind === 'move' ? preview.dy : 0) };
    }
    if (!src) return null;
    const p = Skia.Path.Make();
    for (const [dx, dy] of offsetsFor(src.it.range as RangeKind)) p.addRect(Skia.XYWHRect((src.x + dx) * TILE, (src.y + dy) * TILE, TILE, TILE));
    return { p, color: RANGE_STYLE[src.it.range as RangeKind].color.replace(/[\d.]+\)$/, '0.55)') };
  }, [preview, selection, plan.objects]);

  // Ghost / move preview sprites
  const ghost = useMemo(() => {
    const out: { sprites: ReturnType<typeof Skia.XYWHRect>[]; xf: ReturnType<typeof Skia.RSXform>[] } = { sprites: [], xf: [] };
    const add = (o: Placed) => {
      const rec = SPRITES.world[spriteKey(o, plan.season, occ)] ?? SPRITES.world[`${o.id}#0`];
      if (!rec) return;
      out.sprites.push(Skia.XYWHRect(rec[1], rec[2], rec[3], rec[4]));
      out.xf.push(Skia.RSXform(1, 0, o.x * TILE + rec[5], o.y * TILE + rec[6]));
    };
    if (preview?.kind === 'ghost') add({ u: 'g', id: preview.item.id, x: preview.x, y: preview.y });
    if (preview?.kind === 'move') for (const o of plan.objects) if (selection.has(o.u)) add({ ...o, x: o.x + preview.dx, y: o.y + preview.dy });
    return out;
  }, [preview, plan.objects, plan.season, selection, occ]);

  // ---------------------------------------------------------------- tool logic (JS thread)
  const stroke = useRef<{ active: boolean; started: boolean; sx: number; sy: number; lx: number; ly: number; mode: 'paint' | 'ghost' | 'rect' | 'erase' | 'erase-rect' | 'move' | 'marquee' | 'pan' | 'none'; moved: boolean; lastMsg: number }>({
    active: false, started: false, sx: 0, sy: 0, lx: 0, ly: 0, mode: 'none', moved: false, lastMsg: 0,
  });

  const toTile = (x: number, y: number) => [Math.floor((x - tx.value) / sc.value / TILE), Math.floor((y - ty.value) / sc.value / TILE)] as const;

  const warn = (msg: string) => {
    const s = stroke.current;
    if (Date.now() - s.lastMsg < 1200) return;
    s.lastMsg = Date.now();
    useEditor.getState().showToast(msg);
  };

  const applyPlace = (it: Item, tiles: [number, number][]) => {
    const st = useEditor.getState();
    let cur: Edit = { ground: st.plan!.ground, objects: st.plan!.objects };
    const o = buildOcc(cur.objects);
    let changed = false, lastErr = '';
    for (const [x, y] of tiles) {
      const chk = canPlace({ ...st.plan!, ...cur }, o, it, x, y);
      if (!chk.ok) { lastErr = chk.reason; continue; }
      const next = placeItem({ ...cur, map: st.plan!.map }, o, it, x, y);
      if (next) { cur = next; changed = true; }
    }
    if (changed) { st.commit(cur, false); haptic(); }
    else if (lastErr) warn(lastErr);
    return changed;
  };

  const applyErase = (tiles: [number, number][]) => {
    const st = useEditor.getState();
    let cur: Edit = { ground: st.plan!.ground, objects: st.plan!.objects };
    const o = buildOcc(cur.objects);
    let changed = false;
    for (const [x, y] of tiles) {
      const next = eraseAt(cur, o, x, y);
      if (next) { cur = next; changed = true; }
    }
    if (changed) { st.commit(cur, false); haptic(); }
    return changed;
  };

  const onBegin = (x: number, y: number) => {
    const s = stroke.current;
    const [gx, gy] = toTile(x, y);
    Object.assign(s, { active: true, started: false, sx: gx, sy: gy, lx: gx, ly: gy, moved: false });
    const st = useEditor.getState();
    if (st.tool === 'pan') { s.mode = 'pan'; return; }
    if (st.tool === 'place') {
      if (!st.item) { s.mode = 'none'; return; }
      const big = st.item.w > 1 || st.item.h > 1;
      s.mode = st.shape !== 'brush' ? 'rect' : big ? 'ghost' : 'paint';
    } else if (st.tool === 'erase') s.mode = st.shape === 'brush' ? 'erase' : 'erase-rect';
    else if (st.tool === 'select') {
      const o = objectAt(st.occ, gx, gy);
      if (o) {
        if (!st.selection.has(o.u)) { st.select([o.u]); onSelect?.(o); }
        s.mode = 'move';
      } else s.mode = 'marquee';
    }
  };

  const startStroke = () => {
    const s = stroke.current;
    if (s.started) return;
    s.started = true;
    if (s.mode === 'paint' || s.mode === 'erase' || s.mode === 'rect' || s.mode === 'erase-rect' || s.mode === 'ghost' || s.mode === 'move') useEditor.getState().checkpoint();
    if (s.mode === 'paint') applyPlace(useEditor.getState().item!, [[s.sx, s.sy]]);
    if (s.mode === 'erase') applyErase([[s.sx, s.sy]]);
  };

  const onUpdate = (x: number, y: number, dist: number) => {
    const s = stroke.current;
    if (!s.active || s.mode === 'pan' || s.mode === 'none') return;
    const [gx, gy] = toTile(x, y);
    if (dist > 6) s.moved = true;
    if (!s.started && (dist > 6 || s.mode === 'ghost')) startStroke();
    if (!s.started) return;
    const st = useEditor.getState();
    if (gx === s.lx && gy === s.ly && s.mode !== 'ghost') return;
    switch (s.mode) {
      case 'paint': applyPlace(st.item!, lineTiles(s.lx, s.ly, gx, gy).slice(1)); break;
      case 'erase': applyErase(lineTiles(s.lx, s.ly, gx, gy).slice(1)); break;
      case 'ghost': {
        const it = st.item!;
        const ax = gx - Math.floor((it.w - 1) / 2), ay = gy - Math.floor((it.h - 1) / 2);
        setPreview({ kind: 'ghost', item: it, x: ax, y: ay, ok: canPlace(st.plan!, st.occ, it, ax, ay).ok });
        break;
      }
      case 'rect':
        setPreview({ kind: 'rect', x0: s.sx, y0: s.sy, x1: gx, y1: gy, erase: false, item: st.item, outline: st.shape === 'outline' });
        break;
      case 'erase-rect':
        setPreview({ kind: 'rect', x0: s.sx, y0: s.sy, x1: gx, y1: gy, erase: true, item: null, outline: st.shape === 'outline' });
        break;
      case 'move': {
        const dx = gx - s.sx, dy = gy - s.sy;
        const sel = st.plan!.objects.filter((o) => st.selection.has(o.u));
        const ok = sel.every((o) => canPlace(st.plan!, st.occ, ITEM_BY_ID[o.id], o.x + dx, o.y + dy, st.selection).ok);
        setPreview({ kind: 'move', dx, dy, ok });
        break;
      }
      case 'marquee':
        setPreview({ kind: 'marquee', x0: s.sx, y0: s.sy, x1: gx, y1: gy });
        break;
    }
    s.lx = gx; s.ly = gy;
  };

  const onEnd = (x: number, y: number) => {
    const s = stroke.current;
    if (!s.active) return;
    s.active = false;
    const st = useEditor.getState();
    const [gx, gy] = toTile(x, y);
    if (!s.started) {
      // A tap.
      if (s.mode === 'paint' || s.mode === 'erase') { startStroke(); }
      else if (s.mode === 'ghost' || (s.mode === 'rect' && !s.moved)) {
        st.checkpoint();
        const it = st.item!;
        const ax = gx - Math.floor((it.w - 1) / 2), ay = gy - Math.floor((it.h - 1) / 2);
        if (!applyPlace(it, [[ax, ay]])) st.rollback();
      } else if (s.mode === 'erase-rect') { st.checkpoint(); if (!applyErase([[gx, gy]])) st.rollback(); }
      else if (s.mode === 'marquee' || s.mode === 'pan') {
        const o = objectAt(st.occ, gx, gy);
        if (s.mode === 'pan' && o) { st.setTool('select'); st.select([o.u]); onSelect?.(o); }
        else if (s.mode === 'marquee') { st.select(o ? [o.u] : []); onSelect?.(o ?? null); }
      } else if (s.mode === 'move') { /* tapped an object: selected in begin */ }
      setPreview(null);
      return;
    }
    switch (s.mode) {
      case 'ghost': {
        const it = st.item!;
        const ax = gx - Math.floor((it.w - 1) / 2), ay = gy - Math.floor((it.h - 1) / 2);
        if (!applyPlace(it, [[ax, ay]])) st.rollback();
        break;
      }
      case 'rect': {
        const it = st.item!;
        if (!applyPlace(it, stampPositions(it, s.sx, s.sy, gx, gy, st.shape === 'outline'))) st.rollback();
        break;
      }
      case 'erase-rect': {
        const tiles = rectTiles(s.sx, s.sy, gx, gy, st.shape === 'outline');
        if (!applyErase(tiles)) st.rollback();
        break;
      }
      case 'move': {
        const dx = gx - s.sx, dy = gy - s.sy;
        const sel = st.plan!.objects.filter((o) => st.selection.has(o.u));
        const ok = (dx || dy) && sel.every((o) => canPlace(st.plan!, st.occ, ITEM_BY_ID[o.id], o.x + dx, o.y + dy, st.selection).ok);
        if (ok) {
          // Crops carry their tilled soil along.
          st.commit({ ground: st.plan!.ground, objects: st.plan!.objects.map((o) => (st.selection.has(o.u) ? { ...o, x: o.x + dx, y: o.y + dy } : o)) }, false);
          haptic();
        } else {
          st.rollback();
          if (dx || dy) warn("Can't move there");
        }
        break;
      }
      case 'marquee': {
        const xa = Math.min(s.sx, gx), xb = Math.max(s.sx, gx), ya = Math.min(s.sy, gy), yb = Math.max(s.sy, gy);
        const sel = st.plan!.objects.filter((o) => {
          const it = ITEM_BY_ID[o.id];
          return it && o.x <= xb && o.x + it.w - 1 >= xa && o.y <= yb && o.y + it.h - 1 >= ya;
        });
        st.select(sel.map((o) => o.u));
        onSelect?.(sel.length === 1 ? sel[0] : null);
        break;
      }
    }
    setPreview(null);
  };

  const onCancel = () => {
    const s = stroke.current;
    if (!s.active) return;
    s.active = false;
    if (s.started && s.mode !== 'marquee' && s.mode !== 'pan') useEditor.getState().rollback();
    setPreview(null);
  };

  const onLongPress = (x: number, y: number) => {
    const s = stroke.current;
    if (s.started && s.moved) return;
    if (s.started) onCancel(); else s.active = false;
    const [gx, gy] = toTile(x, y);
    const st = useEditor.getState();
    const o = objectAt(st.occ, gx, gy);
    if (o) {
      st.setTool('select');
      st.select([o.u]);
      onSelect?.(o);
      haptic();
    }
  };

  const onHover = (x: number, y: number) => {
    const st = useEditor.getState();
    if (stroke.current.active || st.tool !== 'place' || !st.item) { if (preview?.kind === 'ghost' && !stroke.current.active) setPreview(null); return; }
    const [gx, gy] = toTile(x, y);
    const it = st.item;
    const ax = gx - Math.floor((it.w - 1) / 2), ay = gy - Math.floor((it.h - 1) / 2);
    if (preview?.kind === 'ghost' && preview.x === ax && preview.y === ay && preview.item === it) return;
    setPreview({ kind: 'ghost', item: it, x: ax, y: ay, ok: canPlace(st.plan!, st.occ, it, ax, ay).ok });
  };

  // ---------------------------------------------------------------- gestures
  const toolSV = useSharedValue(tool);
  useEffect(() => { toolSV.value = tool; }, [tool, toolSV]);
  const pinchStart = useSharedValue({ s: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
  const panStart = useSharedValue({ tx: 0, ty: 0 });
  const pointers = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      pinchStart.value = { s: sc.value, tx: tx.value, ty: ty.value, fx: e.focalX, fy: e.focalY };
      runOnJS(onCancel)();
    })
    .onUpdate((e) => {
      const st = pinchStart.value;
      const ns = Math.max(minSc.value, Math.min(6, st.s * e.scale));
      sc.value = ns;
      tx.value = clampT(e.focalX - ((st.fx - st.tx) * ns) / st.s, vw.value, worldW * ns);
      ty.value = clampT(e.focalY - ((st.fy - st.ty) * ns) / st.s, vh.value, worldH * ns);
    });

  const pan = Gesture.Pan()
    .minDistance(0)
    .averageTouches(true)
    .onTouchesDown((e) => { pointers.value = e.numberOfTouches; })
    .onTouchesUp((e) => { pointers.value = e.numberOfTouches; })
    .onBegin((e) => {
      panStart.value = { tx: tx.value, ty: ty.value };
      runOnJS(onBegin)(e.x, e.y);
    })
    .onUpdate((e) => {
      if (pointers.value > 1) {
        // Two-finger drag pans the view in any tool.
        tx.value = clampT(panStart.value.tx + e.translationX, vw.value, worldW * sc.value);
        ty.value = clampT(panStart.value.ty + e.translationY, vh.value, worldH * sc.value);
        return;
      }
      if (toolSV.value === 'pan') {
        tx.value = clampT(panStart.value.tx + e.translationX, vw.value, worldW * sc.value);
        ty.value = clampT(panStart.value.ty + e.translationY, vh.value, worldH * sc.value);
        if (Math.abs(e.translationX) + Math.abs(e.translationY) > 6) runOnJS(onUpdate)(e.x, e.y, 99);
        return;
      }
      runOnJS(onUpdate)(e.x, e.y, Math.abs(e.translationX) + Math.abs(e.translationY));
    })
    .onEnd((e) => { if (pointers.value <= 1) runOnJS(onEnd)(e.x, e.y); else runOnJS(onCancel)(); })
    .onFinalize((_, success) => { if (!success) runOnJS(onCancel)(); });

  const longPress = Gesture.LongPress().minDuration(480).maxDistance(8).onStart((e) => { runOnJS(onLongPress)(e.x, e.y); });

  const gesture = Gesture.Simultaneous(pinch, pan, longPress);

  // Mouse wheel zoom + hover ghost on web.
  const webHandlers = Platform.OS === 'web'
    ? {
        onWheel: (e: any) => {
          e.preventDefault?.();
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
          const f = Math.exp(-e.deltaY * 0.0015);
          const ns = Math.max(minSc.value, Math.min(6, sc.value * f));
          tx.value = clampT(cx - ((cx - tx.value) * ns) / sc.value, size.w, worldW * ns);
          ty.value = clampT(cy - ((cy - ty.value) * ns) / sc.value, size.h, worldH * ns);
          sc.value = ns;
        },
        onPointerMove: (e: any) => {
          if (e.pointerType !== 'mouse') return;
          const rect = e.currentTarget.getBoundingClientRect();
          onHover(e.clientX - rect.left, e.clientY - rect.top);
        },
        onPointerLeave: () => { if (!stroke.current.active) setPreview((p) => (p?.kind === 'ghost' ? null : p)); },
      }
    : {};

  useImperativeHandle(ref, () => ({
    fit,
    zoomBy,
    focus: (x, y) => focus(x, y),
    exportPNG: (scale) => (terrain && sheet ? renderPlanPNG(terrain, sheet, buildDrawData(plan, occ), scale) : null),
  }), [fit, zoomBy, focus, terrain, sheet, plan, occ]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // ---------------------------------------------------------------- preview shapes
  const rectPreview = useMemo(() => {
    if (preview?.kind !== 'rect' && preview?.kind !== 'marquee') return null;
    const p = Skia.Path.Make();
    if (preview.kind === 'rect' && preview.item && !preview.erase) {
      for (const [x, y] of stampPositions(preview.item, preview.x0, preview.y0, preview.x1, preview.y1, preview.outline)) p.addRect(Skia.XYWHRect(x * TILE, y * TILE, preview.item.w * TILE, preview.item.h * TILE));
    } else if (preview.kind === 'rect' && preview.outline) {
      for (const [x, y] of rectTiles(preview.x0, preview.y0, preview.x1, preview.y1, true)) p.addRect(Skia.XYWHRect(x * TILE, y * TILE, TILE, TILE));
    } else {
      const xa = Math.min(preview.x0, preview.x1), xb = Math.max(preview.x0, preview.x1), ya = Math.min(preview.y0, preview.y1), yb = Math.max(preview.y0, preview.y1);
      p.addRect(Skia.XYWHRect(xa * TILE, ya * TILE, (xb - xa + 1) * TILE, (yb - ya + 1) * TILE));
    }
    const color = preview.kind === 'marquee' ? 'rgba(80,160,255,0.25)' : preview.erase ? 'rgba(220,60,40,0.35)' : 'rgba(120,230,90,0.35)';
    const stroke = preview.kind === 'marquee' ? '#3a72c8' : preview.erase ? '#c83a3a' : '#3a7a24';
    return { p, color, stroke };
  }, [preview]);

  const ghostOk = preview?.kind === 'ghost' ? preview.ok : preview?.kind === 'move' ? preview.ok : true;
  const ghostFoot = useMemo(() => {
    if (preview?.kind !== 'ghost') return null;
    return Skia.XYWHRect(preview.x * TILE, preview.y * TILE, preview.item.w * TILE, preview.item.h * TILE);
  }, [preview]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.wrap} onLayout={onLayout} collapsable={false} {...(webHandlers as object)}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.w} height={size.h} color="#1e120a" />
          <Group transform={transform}>
            {terrain && <SkiaImage image={terrain} x={0} y={0} width={worldW} height={worldH} sampling={NEAREST} />}
            {blockedPath && <Path path={blockedPath} color="rgba(200,40,40,0.28)" />}
            {sheet && data && data.ground.sprites.length > 0 && <Atlas image={sheet} sprites={data.ground.sprites} transforms={data.ground.xf} sampling={NEAREST} />}
            {sheet && data && data.rugs.sprites.length > 0 && <Atlas image={sheet} sprites={data.rugs.sprites} transforms={data.rugs.xf} sampling={NEAREST} />}
            {coverPaths.map((c, i) => <Path key={i} path={c.p} color={c.color} />)}
            {focusRange && <Path path={focusRange.p} color={focusRange.color} />}
            <Path path={gridPath} color="rgba(30,15,5,1)" style="stroke" strokeWidth={0} opacity={layers.grid ? gridOpacity : 0} />
            {sheet && data && data.objects.sprites.length > 0 && <Atlas image={sheet} sprites={data.objects.sprites} transforms={data.objects.xf} sampling={NEAREST} />}
            {warnPath && <Path path={warnPath} color="#e83a3a" style="stroke" strokeWidth={1.5} />}
            {selPath && <Path path={selPath} color={preview?.kind === 'move' && !preview.ok ? '#e83a3a' : '#f8b830'} style="stroke" strokeWidth={2} />}
            {ghostFoot && <Rect rect={ghostFoot} color={ghostOk ? 'rgba(120,230,90,0.35)' : 'rgba(230,60,40,0.45)'} />}
            {sheet && ghost.sprites.length > 0 && (
              <Group opacity={0.75}>
                <Atlas image={sheet} sprites={ghost.sprites} transforms={ghost.xf} sampling={NEAREST} />
              </Group>
            )}
            {rectPreview && (
              <Group>
                <Path path={rectPreview.p} color={rectPreview.color} />
                <Path path={rectPreview.p} color={rectPreview.stroke} style="stroke" strokeWidth={1} />
              </Group>
            )}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#1e120a' },
});

void terrainAt; void key; void layerOf; void uid;
