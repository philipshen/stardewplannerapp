import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { Atlas, Canvas, Group, Image as SkiaImage, Path, Picture, Rect, Skia, useImage } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ITEM_BY_ID, Item, SPRITES } from '../data/items';
import { MAP_BY_ID, terrainAt } from '../data/maps';
import { mapImage } from '../data/mapImages';
import { WORLD_SHEETS } from '../data/generated/assets';
import { useEditor } from '../store/editor';
import {
  blockedTrees, buildOcc, canPlace, coverage, eraseAt, Edit, key, layerOf, lineTiles, objectAt, Placed, placeItem, RANGE_STYLE, RangeKind,
  torchLift, offsetsFor, placementCells, soilForCrops, rectTiles, stampPositions, tileBuildable, tileTillable, uid,
} from './model';
import { buildDrawData, groundKey, NEAREST, renderPlanPNG, spriteKey, TILE } from './render';
import { t, translateReason } from '../i18n';
import { sfx, unlockAudio } from '../audio';
import { planLights } from './lighting';
import { nightPicture } from './night';
import { Wildlife } from './Wildlife';

export type FarmCanvasHandle = {
  fit: () => void;
  zoomBy: (f: number) => void;
  exportPNG: (scale: number) => string | null;
  focus: (x: number, y: number) => void;
};

type Preview =
  | { kind: 'ghost'; item: Item; x: number; y: number; ok: boolean; cells: ReturnType<typeof placementCells> }
  | { kind: 'rect'; x0: number; y0: number; x1: number; y1: number; erase: boolean; item: Item | null; outline: boolean }
  | { kind: 'move'; dx: number; dy: number; ok: boolean }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number }
  | null;

const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

export const FarmCanvas = forwardRef<FarmCanvasHandle, { onSelect?: (o: Placed | null) => void; onContextMenu?: (o: Placed) => void; readOnly?: boolean; viewInsets?: { top: number; bottom: number } }>(function FarmCanvas({ onSelect, onContextMenu, readOnly = false, viewInsets }, ref) {
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
  const lighting = useMemo(() => layers.night ? nightPicture(planLights(plan.objects, occ), worldW, worldH) : null, [layers.night, plan.objects, occ, worldW, worldH]);
  const vw = useSharedValue(1), vh = useSharedValue(1);
  useEffect(() => { vw.value = size.w || 1; vh.value = size.h || 1; }, [size, vw, vh]);
  /** Keep part of the map on screen (at most 40% of the viewport may be empty past an edge). */
  const clampT = (t: number, view: number, world: number) => {
    'worklet';
    const m = view * 0.4;
    const lo = Math.min(view - world - m, m), hi = Math.max(m, view - world - m);
    return Math.max(lo, Math.min(hi, t));
  };

  const insetTop = viewInsets?.top ?? 0, insetBottom = viewInsets?.bottom ?? 0;
  const fitScale = useCallback(() => (size.w && size.h ? Math.min(size.w / worldW, Math.max(1, size.h - insetTop - insetBottom) / worldH) * 0.96 : 1), [size, worldW, worldH, insetTop, insetBottom]);
  const fit = useCallback(() => {
    const s = fitScale();
    sc.value = withTiming(s, { duration: 250 });
    tx.value = withTiming((size.w - worldW * s) / 2, { duration: 250 });
    ty.value = withTiming((size.h + insetTop - insetBottom - worldH * s) / 2, { duration: 250 });
  }, [fitScale, size, worldW, worldH, sc, tx, ty, insetTop, insetBottom]);
  const focus = useCallback((x: number, y: number, s?: number) => {
    const scale = s ?? Math.max(sc.value, 1.5);
    sc.value = withTiming(scale, { duration: 250 });
    tx.value = withTiming(size.w / 2 - (x + 0.5) * TILE * scale, { duration: 250 });
    ty.value = withTiming(size.h / 2 - (y + 0.5) * TILE * scale, { duration: 250 });
  }, [size, sc, tx, ty]);

  const didInit = useRef<string | null>(null);
  const previousSize = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!size.w || !size.h) return;
    const samePlan = didInit.current === plan.id + plan.map;
    const before = previousSize.current;
    previousSize.current = size;
    minSc.value = fitScale() * 0.7;
    if (samePlan && !readOnly) {
      // Preserve the tile at the center when rotating an editable farm.
      if (before && (before.w !== size.w || before.h !== size.h)) {
        const cx = (before.w / 2 - tx.value) / sc.value;
        const cy = (before.h / 2 - ty.value) / sc.value;
        const nextScale = Math.max(minSc.value, sc.value);
        sc.value = nextScale;
        tx.value = clampT(size.w / 2 - cx * nextScale, size.w, worldW * nextScale);
        ty.value = clampT(size.h / 2 - cy * nextScale, size.h, worldH * nextScale);
      }
      return;
    }
    didInit.current = plan.id + plan.map;
    if (map.kind === 'farm' && !readOnly) {
      const home = plan.objects.find((o) => o.id === 'farmhouse') ?? plan.objects[0];
      const s = Math.max(fitScale(), Math.min(1.6, size.w / (TILE * 22)));
      sc.value = s;
      const cx = home ? home.x + 4 : map.w / 2, cy = home ? home.y + 6 : map.h / 2;
      tx.value = Math.max(size.w - worldW * s, Math.min(0, size.w / 2 - cx * TILE * s));
      ty.value = Math.max(size.h - worldH * s, Math.min(0, size.h / 2 - cy * TILE * s));
    } else {
      const s = fitScale();
      sc.value = s; tx.value = (size.w - worldW * s) / 2; ty.value = (size.h + insetTop - insetBottom - worldH * s) / 2;
    }
  }, [size, plan.id, plan.map, readOnly, insetTop, insetBottom]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const p = Skia.PathBuilder.Make();
    for (let x = 0; x <= map.w; x++) { p.moveTo(x * TILE, 0); p.lineTo(x * TILE, worldH); }
    for (let y = 0; y <= map.h; y++) { p.moveTo(0, y * TILE); p.lineTo(worldW, y * TILE); }
    return p.build();
  }, [map, worldW, worldH]);

  const areaPath = (on: boolean, test: (x: number, y: number) => boolean) => {
    if (!on) return null;
    const p = Skia.PathBuilder.Make();
    // Merge runs of tiles in a row into one rect to keep the path small.
    for (let y = 0; y < map.h; y++) {
      let run = -1;
      for (let x = 0; x <= map.w; x++) {
        const ok = x < map.w && test(x, y);
        if (ok && run < 0) run = x;
        if (!ok && run >= 0) { p.addRect(Skia.XYWHRect(run * TILE, y * TILE, (x - run) * TILE, TILE)); run = -1; }
      }
    }
    return p.build();
  };
  const buildablePath = useMemo(() => areaPath(layers.buildable, (x, y) => tileBuildable(map, x, y)), [layers.buildable, map]); // eslint-disable-line react-hooks/exhaustive-deps
  const tillablePath = useMemo(() => areaPath(layers.tillable, (x, y) => tileTillable(map, x, y)), [layers.tillable, map]); // eslint-disable-line react-hooks/exhaustive-deps

  const coverPaths = useMemo(() => {
    const groups = new Set(Object.entries({ water: layers.water, crow: layers.crow, junimo: layers.junimo, bee: layers.bee, log: true }).filter(([, v]) => v).map(([k]) => k));
    const cov = coverage(plan.objects, groups);
    const colors: Record<string, string> = { water: RANGE_STYLE.spr1.color, crow: RANGE_STYLE.scare8.color, junimo: RANGE_STYLE.junimo.color, bee: RANGE_STYLE.bee.color, log: RANGE_STYLE.log.color };
    return Object.entries(cov).filter(([, s]) => s.size).map(([g, s]) => {
      const p = Skia.PathBuilder.Make();
      for (const k of s) { const [x, y] = k.split(',').map(Number); p.addRect(Skia.XYWHRect(x * TILE, y * TILE, TILE, TILE)); }
      return { p: p.build(), color: colors[g] };
    });
  }, [layers, plan.objects]);

  const warnPath = useMemo(() => {
    if (!layers.warnings) return null;
    const bad = blockedTrees(plan.objects, occ);
    if (!bad.size) return null;
    const p = Skia.PathBuilder.Make();
    for (const o of plan.objects) if (bad.has(o.u)) p.addRect(Skia.XYWHRect(o.x * TILE - TILE, o.y * TILE - TILE, TILE * 3, TILE * 3));
    return p.build();
  }, [layers.warnings, plan.objects, occ]);

  const selPath = useMemo(() => {
    if (!selection.size) return null;
    const p = Skia.PathBuilder.Make();
    const dx = preview?.kind === 'move' ? preview.dx : 0, dy = preview?.kind === 'move' ? preview.dy : 0;
    for (const o of plan.objects) {
      if (!selection.has(o.u)) continue;
      const it = ITEM_BY_ID[o.id];
      if (it) p.addRect(Skia.XYWHRect((o.x + dx) * TILE, (o.y + dy) * TILE, it.w * TILE, it.h * TILE));
    }
    return p.build();
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
    const p = Skia.PathBuilder.Make();
    for (const [dx, dy] of offsetsFor(src.it.range as RangeKind)) p.addRect(Skia.XYWHRect((src.x + dx) * TILE, (src.y + dy) * TILE, TILE, TILE));
    return { p: p.build(), color: RANGE_STYLE[src.it.range as RangeKind].color.replace(/[\d.]+\)$/, '0.55)') };
  }, [preview, selection, plan.objects]);

  // Ghost / move preview sprites
  const ghost = useMemo(() => {
    const out: { sprites: ReturnType<typeof Skia.XYWHRect>[]; xf: ReturnType<typeof Skia.RSXform>[] } = { sprites: [], xf: [] };
    const add = (o: Placed) => {
      const rec = SPRITES.world[spriteKey(o, plan.season, occ)] ?? SPRITES.world[groundKey(o.id, o.x, o.y, plan.season)] ?? SPRITES.world[`${o.id}#0`];
      if (!rec) return;
      out.sprites.push(Skia.XYWHRect(rec[1], rec[2], rec[3], rec[4]));
      out.xf.push(Skia.RSXform(1, 0, o.x * TILE + rec[5], o.y * TILE + rec[6] - torchLift(o, occ)));
    };
    if (preview?.kind === 'ghost') add({ u: 'g', id: preview.item.id, x: preview.x, y: preview.y });
    if (preview?.kind === 'move') for (const o of plan.objects) if (selection.has(o.u)) add({ ...o, x: o.x + preview.dx, y: o.y + preview.dy });
    return out;
  }, [preview, plan.objects, plan.season, selection, occ]);

  // ---------------------------------------------------------------- tool logic (JS thread)
  const stroke = useRef<{ active: boolean; started: boolean; recorded: boolean; sx: number; sy: number; lx: number; ly: number; mode: 'paint' | 'ghost' | 'rect' | 'erase' | 'erase-single' | 'erase-rect' | 'move' | 'marquee' | 'pan' | 'none'; moved: boolean; lastMsg: number }>({
    active: false, started: false, recorded: false, sx: 0, sy: 0, lx: 0, ly: 0, mode: 'none', moved: false, lastMsg: 0,
  });

  const toTile = (x: number, y: number) => [Math.floor((x - tx.value) / sc.value / TILE), Math.floor((y - ty.value) / sc.value / TILE)] as const;

  const warn = (msg: string) => {
    const s = stroke.current;
    if (Date.now() - s.lastMsg < 1200) return;
    s.lastMsg = Date.now();
    sfx('error');
    useEditor.getState().showToast(translateReason(msg));
  };

  const applyPlace = (it: Item, tiles: [number, number][]) => {
    const st = useEditor.getState();
    let cur: Edit = { ground: st.plan!.ground, objects: st.plan!.objects };
    const o = buildOcc(cur.objects);
    let changed = false, lastErr = '';
    for (const [x, y] of tiles) {
      const chk = canPlace({ ...st.plan!, ...cur }, o, it, x, y, undefined, st.layers.anywhere);
      if (!chk.ok) { lastErr = chk.reason; continue; }
      const next = placeItem({ ...cur, map: st.plan!.map }, o, it, x, y);
      if (next) { cur = next; changed = true; }
    }
    if (changed) {
      // Brush strokes enter history only when they actually change the farm.
      if (!stroke.current.recorded) { st.checkpoint(); stroke.current.recorded = true; }
      st.commit(cur, false); haptic(); sfx(it.kind === 'building' ? 'build' : 'place'); }
    else if (lastErr) warn(lastErr);
    return changed;
  };

  // Keep the painted footprint centered on the same tile as its preview.
  const paintAt = (it: Item, tiles: [number, number][]) => applyPlace(it, tiles.map(([x, y]) =>
    [x - Math.floor((it.w - 1) / 2), y - Math.floor((it.h - 1) / 2)]));

  const applyErase = (tiles: [number, number][]) => {
    const st = useEditor.getState();
    let cur: Edit = { ground: st.plan!.ground, objects: st.plan!.objects };
    const o = buildOcc(cur.objects);
    let changed = false;
    for (const [x, y] of tiles) {
      const next = eraseAt(cur, o, x, y);
      if (next) { cur = next; changed = true; }
    }
    if (changed) {
      // Brush strokes enter history only when they actually change the farm.
      if (!stroke.current.recorded) { st.checkpoint(); stroke.current.recorded = true; }
      st.commit(cur, false); haptic(); sfx('erase'); }
    return changed;
  };

  const showPlacement = (it: Item, gx: number, gy: number) => {
    const st = useEditor.getState();
    const x = gx - Math.floor((it.w - 1) / 2), y = gy - Math.floor((it.h - 1) / 2);
    const cells = placementCells(st.plan!, st.occ, it, x, y, undefined, st.layers.anywhere);
    setPreview({ kind: 'ghost', item: it, x, y, ok: cells.every(c => c.ok), cells });
  };

  const onBegin = (x: number, y: number) => {
    unlockAudio();
    const s = stroke.current;
    const [gx, gy] = toTile(x, y);
    Object.assign(s, { active: true, started: false, recorded: false, sx: gx, sy: gy, lx: gx, ly: gy, moved: false });
    const st = useEditor.getState();
    if (readOnly || st.tool === 'pan') { s.mode = 'pan'; return; }
    if (st.tool === 'place') {
      if (!st.item) { s.mode = 'none'; return; }
      s.mode = st.shape === 'single' ? 'ghost' : st.shape === 'rect' ? 'rect' : 'paint';
      showPlacement(st.item, gx, gy);
    } else if (st.tool === 'erase') s.mode = st.shape === 'single' ? 'erase-single' : st.shape === 'rect' ? 'erase-rect' : 'erase';
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
    if (s.mode === 'move') {
      useEditor.getState().checkpoint(); s.recorded = true;
    }
    if (s.mode === 'paint') paintAt(useEditor.getState().item!, [[s.sx, s.sy]]);
    if (s.mode === 'erase') applyErase([[s.sx, s.sy]]);
  };

  const onUpdate = (x: number, y: number, dist: number) => {
    const s = stroke.current;
    if (!s.active || s.mode === 'none') return;
    if (dist > 6) s.moved = true;
    if (s.mode === 'pan') return;
    const [gx, gy] = toTile(x, y);
    if (!s.started && (dist > 6 || s.mode === 'ghost')) startStroke();
    if (!s.started) return;
    const st = useEditor.getState();
    if (gx === s.lx && gy === s.ly && s.mode !== 'ghost') return;
    switch (s.mode) {
      case 'paint': showPlacement(st.item!, gx, gy); paintAt(st.item!, lineTiles(s.lx, s.ly, gx, gy).slice(1)); break;
      case 'erase': applyErase(lineTiles(s.lx, s.ly, gx, gy).slice(1)); break;
      case 'ghost': showPlacement(st.item!, gx, gy); break;
      case 'rect':
        setPreview({ kind: 'rect', x0: s.sx, y0: s.sy, x1: gx, y1: gy, erase: false, item: st.item, outline: false });
        break;
      case 'erase-rect':
        setPreview({ kind: 'rect', x0: s.sx, y0: s.sy, x1: gx, y1: gy, erase: true, item: null, outline: false });
        break;
      case 'move': {
        const dx = gx - s.sx, dy = gy - s.sy;
        const sel = st.plan!.objects.filter((o) => st.selection.has(o.u));
        const ok = sel.every((o) => canPlace(st.plan!, st.occ, ITEM_BY_ID[o.id], o.x + dx, o.y + dy, st.selection, st.layers.anywhere).ok);
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
    if (readOnly) { setPreview(null); return; }
    const st = useEditor.getState();
    const [gx, gy] = toTile(x, y);
    if (s.mode === 'erase-single') { applyErase([[gx, gy]]); setPreview(null); return; }
    if (!s.started) {
      // A tap.
      if (s.mode === 'paint' || s.mode === 'erase') { startStroke(); }
      else if (s.mode === 'ghost' || (s.mode === 'rect' && !s.moved)) {
        const it = st.item!;
        const ax = gx - Math.floor((it.w - 1) / 2), ay = gy - Math.floor((it.h - 1) / 2);
        applyPlace(it, [[ax, ay]]);
      } else if (s.mode === 'erase-rect') { applyErase([[gx, gy]]); }
      else if (s.mode === 'marquee' || s.mode === 'pan') {
        const o = objectAt(st.occ, gx, gy);
        if (s.mode === 'pan' && !s.moved && o) { st.setTool('select'); st.select([o.u]); onSelect?.(o); }
        else if (s.mode === 'marquee') { st.select(o ? [o.u] : []); onSelect?.(o ?? null); }
      } else if (s.mode === 'move') { /* tapped an object: selected in begin */ }
      setPreview(null);
      return;
    }
    switch (s.mode) {
      case 'paint': paintAt(st.item!, lineTiles(s.lx, s.ly, gx, gy).slice(1)); break;
      case 'erase': applyErase(lineTiles(s.lx, s.ly, gx, gy).slice(1)); break;
      case 'ghost': {
        const it = st.item!;
        const ax = gx - Math.floor((it.w - 1) / 2), ay = gy - Math.floor((it.h - 1) / 2);
        applyPlace(it, [[ax, ay]]);
        break;
      }
      case 'rect': {
        const it = st.item!;
        applyPlace(it, stampPositions(it, s.sx, s.sy, gx, gy, false));
        break;
      }
      case 'erase-rect': {
        const tiles = rectTiles(s.sx, s.sy, gx, gy, false);
        applyErase(tiles);
        break;
      }
      case 'move': {
        const dx = gx - s.sx, dy = gy - s.sy;
        const sel = st.plan!.objects.filter((o) => st.selection.has(o.u));
        const ok = (dx || dy) && sel.every((o) => canPlace(st.plan!, st.occ, ITEM_BY_ID[o.id], o.x + dx, o.y + dy, st.selection, st.layers.anywhere).ok);
        if (ok) {
          const objects = st.plan!.objects.map((o) => (st.selection.has(o.u) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
          st.commit({ ground: soilForCrops(st.plan!.ground, objects.filter((o) => st.selection.has(o.u))), objects }, false);
          haptic();
        } else {
          st.rollback();
          if (dx || dy) warn(t('toast.cantMove'));
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
    if (s.recorded) useEditor.getState().rollback();
    setPreview(null);
  };

  /** The pan gesture ended without activating: a tap if nothing was drawn yet, else an interrupted stroke. */
  const onTapOrCancel = (x: number, y: number) => {
    if (stroke.current.started) onCancel(); else onEnd(x, y);
  };

  const onLongPress = (x: number, y: number) => {
    if (readOnly) return;
    const s = stroke.current;
    const current = useEditor.getState();
    if (!s.active || s.moved || s.recorded || (current.tool === 'place' && current.shape !== 'single')) return;
    const [gx, gy] = toTile(x, y);
    const st = useEditor.getState();
    const o = objectAt(st.occ, gx, gy);
    if (o) {
      onCancel();
      st.setTool('select');
      st.select([o.u]);
      onSelect?.(o);
      haptic();
      sfx('select');
      onContextMenu?.(o);
    }
  };

  const onHover = (x: number, y: number) => {
    if (readOnly) return;
    const st = useEditor.getState();
    if (stroke.current.active || st.tool !== 'place' || !st.item) { if (preview?.kind === 'ghost' && !stroke.current.active) setPreview(null); return; }
    const [gx, gy] = toTile(x, y);
    const it = st.item;
    const ax = gx - Math.floor((it.w - 1) / 2), ay = gy - Math.floor((it.h - 1) / 2);
    if (preview?.kind === 'ghost' && preview.x === ax && preview.y === ay && preview.item === it) return;
    showPlacement(it, gx, gy);
  };

  // ---------------------------------------------------------------- gestures
  const toolSV = useSharedValue(readOnly ? 'pan' : tool);
  useEffect(() => { toolSV.value = readOnly ? 'pan' : tool; }, [tool, toolSV, readOnly]);
  // Pinch and pan both run at the same time, so each one applies only its change since the last frame.
  const lastScale = useSharedValue(1);
  const lastPan = useSharedValue({ x: 0, y: 0 });
  /** Skip one pan frame after the number of fingers changes: the touch centroid jumps then. */
  const resync = useSharedValue(true);
  const pointers = useSharedValue(0);
  /** True once a second finger touched during this gesture. Such a gesture never edits the plan. */
  const multi = useSharedValue(false);
  const downAt = useSharedValue({ x: 0, y: 0 });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      lastScale.value = 1;
      runOnJS(onCancel)();
    })
    .onUpdate((e) => {
      const ns = Math.max(minSc.value, Math.min(6, (sc.value * e.scale) / lastScale.value));
      lastScale.value = e.scale;
      tx.value = clampT(e.focalX - ((e.focalX - tx.value) * ns) / sc.value, vw.value, worldW * ns);
      ty.value = clampT(e.focalY - ((e.focalY - ty.value) * ns) / sc.value, vh.value, worldH * ns);
      sc.value = ns;
    });

  const pan = Gesture.Pan()
    .minDistance(0)
    .averageTouches(true)
    .onTouchesDown((e) => {
      pointers.value = e.numberOfTouches;
      resync.value = true;
      if (e.numberOfTouches === 1) {
        multi.value = false;
        const touch = e.changedTouches[0];
        if (touch) {
          lastPan.value = { x: 0, y: 0 };
          downAt.value = { x: touch.x, y: touch.y };
          runOnJS(onBegin)(touch.x, touch.y);
        }
      }
      else if (!multi.value) { multi.value = true; runOnJS(onCancel)(); }
    })
    .onTouchesUp((e) => { pointers.value = e.numberOfTouches; resync.value = true; })
    .onUpdate((e) => {
      const dx = resync.value ? 0 : e.translationX - lastPan.value.x, dy = resync.value ? 0 : e.translationY - lastPan.value.y;
      lastPan.value = { x: e.translationX, y: e.translationY };
      resync.value = false;
      // Two fingers move the view in any tool. One finger moves it in the Pan tool.
      if (multi.value || toolSV.value === 'pan') {
        tx.value = clampT(tx.value + dx, vw.value, worldW * sc.value);
        ty.value = clampT(ty.value + dy, vh.value, worldH * sc.value);
        if (!multi.value && Math.abs(e.translationX) + Math.abs(e.translationY) > 6) runOnJS(onUpdate)(e.x, e.y, 99);
        return;
      }
      runOnJS(onUpdate)(e.x, e.y, Math.abs(e.translationX) + Math.abs(e.translationY));
    })
    .onEnd((e) => { if (multi.value) runOnJS(onCancel)(); else runOnJS(onEnd)(e.x, e.y); })
    .onFinalize((_, success) => {
      if (success) return;
      // On iOS and Android a touch that does not move never activates the pan, so it ends here.
      // That is a tap: finish it where the finger went down. (A long press has already closed the stroke.)
      if (multi.value) runOnJS(onCancel)();
      else runOnJS(onTapOrCancel)(downAt.value.x, downAt.value.y);
    });

  const longPress = Gesture.LongPress().minDuration(480).maxDistance(8).onStart((e) => { runOnJS(onLongPress)(e.x, e.y); });

  const gesture = Gesture.Simultaneous(pinch, pan, longPress);

  // Mouse wheel zoom + hover ghost on web.
  const webHandlers = Platform.OS === 'web'
    ? {
        onWheel: (e: any) => {
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
    exportPNG: (scale) => (terrain && sheet ? renderPlanPNG(terrain, sheet, buildDrawData(plan, occ), scale, worldW, worldH, layers.night) : null),
  }), [fit, zoomBy, focus, terrain, sheet, plan, occ, worldW, worldH, layers.night]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    // A fold/resize changes the coordinate system: never commit an old finger position.
    if (next.w !== size.w || next.h !== size.h) onCancel();
    setSize(next);
  };

  // ---------------------------------------------------------------- preview shapes
  const rectPreview = useMemo(() => {
    if (preview?.kind !== 'rect' && preview?.kind !== 'marquee') return null;
    const p = Skia.PathBuilder.Make();
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
    return { p: p.build(), color, stroke };
  }, [preview]);

  const placementPaths = useMemo(() => {
    const good = Skia.PathBuilder.Make(), bad = Skia.PathBuilder.Make();
    const add = (cells: ReturnType<typeof placementCells>) => cells.forEach(c => (c.ok ? good : bad).addRect(Skia.XYWHRect(c.x * TILE, c.y * TILE, TILE, TILE)));
    if (preview?.kind === 'ghost') add(preview.cells);
    if (preview?.kind === 'rect' && preview.item && !preview.erase) {
      for (const [x, y] of stampPositions(preview.item, preview.x0, preview.y0, preview.x1, preview.y1, preview.outline)) add(placementCells(plan, occ, preview.item, x, y, undefined, layers.anywhere));
    }
    if (preview?.kind === 'move') for (const o of plan.objects) if (selection.has(o.u)) add(placementCells(plan, occ, ITEM_BY_ID[o.id], o.x + preview.dx, o.y + preview.dy, selection, layers.anywhere));
    return { good: good.build(), bad: bad.build() };
  }, [preview, plan, occ, layers.anywhere, selection]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.wrap} onLayout={onLayout} collapsable={false} {...(webHandlers as object)}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.w} height={size.h} color="#1e120a" />
          <Group transform={transform}>
            {terrain && <SkiaImage image={terrain} x={0} y={0} width={worldW} height={worldH} sampling={NEAREST} />}
            {buildablePath && <Path path={buildablePath} color="rgba(60,200,90,0.3)" />}
            {tillablePath && <Path path={tillablePath} color="rgba(240,190,40,0.32)" />}
            {sheet && data && data.ground.sprites.length > 0 && <Atlas image={sheet} sprites={data.ground.sprites} transforms={data.ground.xf} sampling={NEAREST} />}
            {sheet && data && data.rugs.sprites.length > 0 && <Atlas image={sheet} sprites={data.rugs.sprites} transforms={data.rugs.xf} sampling={NEAREST} />}
            {coverPaths.map((c, i) => <Path key={i} path={c.p} color={c.color} />)}
            {focusRange && <Path path={focusRange.p} color={focusRange.color} />}
            <Path path={gridPath} color="rgba(30,15,5,1)" style="stroke" strokeWidth={0} opacity={preview ? 0.5 : layers.grid ? gridOpacity : 0} />
            {sheet && data && data.objects.sprites.length > 0 && <Atlas image={sheet} sprites={data.objects.sprites} transforms={data.objects.xf} sampling={NEAREST} />}
            {layers.wildlife && map.kind === 'farm' && !map.image && <Wildlife width={worldW} height={worldH} season={plan.season} />}
            {lighting && <Picture picture={lighting} />}
            {warnPath && <Path path={warnPath} color="#e83a3a" style="stroke" strokeWidth={1.5} />}
            {selPath && <Path path={selPath} color={preview?.kind === 'move' && !preview.ok ? '#e83a3a' : '#f8b830'} style="stroke" strokeWidth={2} />}
            <Path path={placementPaths.good} color="rgba(75,220,65,0.45)" />
            <Path path={placementPaths.bad} color="rgba(245,55,40,0.55)" />
            {sheet && ghost.sprites.length > 0 && (
              <Group opacity={0.55}>
                <Atlas image={sheet} sprites={ghost.sprites} transforms={ghost.xf} sampling={NEAREST} />
              </Group>
            )}
            <Path path={placementPaths.good} color="#216d25" style="stroke" strokeWidth={1} />
            <Path path={placementPaths.bad} color="#b51b12" style="stroke" strokeWidth={1} />
            {rectPreview && !(preview?.kind === 'rect' && preview.item && !preview.erase) && (
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
