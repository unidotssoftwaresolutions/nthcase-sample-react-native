import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BackHandler,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Item } from '../data/catalog';
import { DOUBLE_TAP_MS } from '../data/gestures';
import {
  boardLabel,
  boardPosition,
  boardTopLeft,
  countText,
  detailPlace,
  EMPTY_LOG,
  fullyVisibleTiles,
  gridItem,
  innerLine,
  itemAt,
  Lobby,
  logText,
  logTouch,
  pagerPosition,
  rowPosition,
  tileItem,
  tileWhere,
  topItem,
  topRowPosition,
  TOP_ROW,
  type Touch,
  type TouchLog,
} from '../data/lobby';
import { actions, useAppState } from '../data/store';
import { GLYPHS } from '../generated/art';
import { TemplateIds, TestIds } from '../testIds';
import { Button, GlyphTile, Icon, ItemNumber, Screen, TopBar, type IconName } from '../ui/components';
import { Radius, Space, Type, useTheme } from '../ui/theme';

/*
 * The Lobby (SPEC.md §5 and §12, new in 1.1): a test bench for scrolling, built from React Native's core scrollers.
 *
 *   the promo pager   a horizontal FlatList with pagingEnabled, ABOVE the page, so it is the first scrollable in the
 *                     tree; rendered only while Show the pager is on (off, it is not in the tree at all)
 *   the Top 10 row    a horizontal FlatList between the pager and the page, outside the page: the first scrollable
 *                     when the pager is off
 *   the page          a vertical ScrollView
 *   chips and rows    horizontal FlatLists inside the page
 *   the inner list    a FlatList 240 high inside the page, nestedScrollEnabled (Android needs it)
 *   the board         Android: a vertical ScrollView holding a horizontal one, because an Android ScrollView scrolls
 *                     one way only. iOS: one ScrollView whose content is wider and taller than it, which scrolls both
 *   the bar           the Lobby's own row of buttons; Saved is left out of the render until its delay has passed
 *   the quick sheet   a Modal that slides from the bottom: a window of its own on Android, a presented view on iOS
 *
 * Every touch is Pressable's own: onPress and onLongPress, with React Native's own timings and its own rules for a
 * finger that moves (README, "The Lobby"). React Native has no double tap, so a tap waits the double-tap time
 * (300 ms) for a second one: two presses inside it are one "Double-tapped" line, as SPEC.md §5 asks.
 */

type Panel =
  | { kind: 'none' }
  /** [row] 1–4, or TOP_ROW for the Top 10 row. */
  | { kind: 'detail'; row: number; tile: number }
  | { kind: 'promo'; banner: number }
  | { kind: 'saved' };

/** What a quick sheet was opened for: its title, and what its Open opens. */
type SheetFor = { title: string; opens: Panel };

type LogFn = (touch: Touch, what: string, where: string) => void;

/** Every scroll offset of one visit. The panels unmount the scrollers; these put each one back where it was. */
type Offsets = {
  pager: number;
  top: number;
  page: number;
  chips: number;
  rows: number[];
  inner: number;
  boardX: number;
  boardY: number;
};

const NONE: Panel = { kind: 'none' };
const BOARD_SIZE = Lobby.BOARD_CELL * 5;
const BOARD_CONTENT = Lobby.BOARD_CELL * Lobby.BOARD;
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
/**
 * Where a scroller starts when it mounts: where it was before a panel took its place. Taken once, so the prop never
 * changes while the scroller lives: a changed `contentOffset` would move it, under the finger.
 */
function useStart(x: number, y: number): { x: number; y: number } {
  return useState(() => ({ x, y }))[0];
}
const xOf = (e: NativeSyntheticEvent<NativeScrollEvent>) => e.nativeEvent.contentOffset.x;
const yOf = (e: NativeSyntheticEvent<NativeScrollEvent>) => e.nativeEvent.contentOffset.y;

export function LobbyScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const delay = useAppState((s) => s.lobbySavedDelay);
  const pagerShown = useAppState((s) => s.lobbyPagerShown);

  const [log, setLog] = useState<TouchLog>(EMPTY_LOG);
  const record = useCallback<LogFn>((touch, what, where) => setLog((l) => logTouch(l, touch, what, where)), []);
  const [panel, setPanel] = useState<Panel>(NONE);
  const [sheet, setSheet] = useState<SheetFor | null>(null);
  const [barSelected, setBarSelected] = useState('Home');
  const [chip, setChip] = useState(1);
  const [auto, setAuto] = useState(false);

  // Saved appears late: out of the render until the delay has passed. The count starts when the Lobby opens, and
  // again whenever a delay is chosen (the epoch), so a scenario's 12 s are 12 s from its own tap.
  const [epoch, setEpoch] = useState(0);
  const [savedShown, setSavedShown] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) {
      setSavedShown(true);
      return undefined;
    }
    setSavedShown(false);
    const timer = setTimeout(() => setSavedShown(true), delay * 1000);
    return () => clearTimeout(timer);
    // the epoch restarts the count even when the same delay is chosen again
  }, [delay, epoch]);

  // where each scroller is, and what its position line says: kept here, above the panels
  const offsets = useRef<Offsets>({ pager: 0, top: 0, page: 0, chips: 0, rows: [0, 0, 0, 0], inner: 0, boardX: 0, boardY: 0 }).current;
  const [banner, setBanner] = useState(1);

  const openDetail = useCallback((row: number, tile: number) => setPanel({ kind: 'detail', row, tile }), []);
  const openPromo = useCallback((n: number) => setPanel({ kind: 'promo', banner: n }), []);
  const openSheet = useCallback((target: SheetFor) => setSheet(target), []);
  const closePanel = useCallback(() => setPanel(NONE), []);

  // system Back closes the detail or the promo first (the sheet's own Back is the Modal's onRequestClose)
  const backCloses = panel.kind === 'detail' || panel.kind === 'promo';
  useEffect(() => {
    if (!backCloses) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPanel(NONE);
      return true;
    });
    return () => sub.remove();
  }, [backCloses]);

  return (
    <Screen testID={TestIds.LOBBY_SCREEN}>
      <TopBar title="Lobby" onBack={backCloses ? closePanel : onBack} />
      <TouchLogBlock log={log} onReset={() => setLog(EMPTY_LOG)} />
      <DelayChoice
        selected={delay}
        onChoose={(seconds) => {
          actions.setLobbySavedDelay(seconds);
          setEpoch((n) => n + 1);
        }}
        pagerShown={pagerShown}
        onPagerShown={actions.setLobbyPagerShown}
      />
      {panel.kind === 'none' ? (
        <>
          {/* off, the pager and its position line are not rendered: no view, so nothing in the tree */}
          {pagerShown ? (
            <Pager
              width={width}
              banner={banner}
              onBanner={setBanner}
              offsets={offsets}
              auto={auto}
              onAuto={setAuto}
              record={record}
              onPromo={openPromo}
              onSheet={openSheet}
            />
          ) : null}
          <TopRow offsets={offsets} width={width} record={record} onDetail={openDetail} onSheet={openSheet} />
          <Page offsets={offsets}>
            <Chips offsets={offsets} selected={chip} onSelect={setChip} record={record} />
            {range(Lobby.ROWS).map((row) => (
              <TileRow key={row} row={row} offsets={offsets} width={width} record={record} onDetail={openDetail} onSheet={openSheet} />
            ))}
            <Grid record={record} />
            <InnerList offsets={offsets} record={record} />
            <Board offsets={offsets} record={record} />
            <View testID={TestIds.LOBBY_FOOTER} style={styles.footer}>
              <Text style={[Type.title, { color: colors.onSurface }]}>{Lobby.FOOTER}</Text>
              <Text style={[Type.bodySmall, { color: colors.onSurfaceVariant }]}>{Lobby.FOOTER_NOTE}</Text>
            </View>
          </Page>
        </>
      ) : panel.kind === 'detail' ? (
        <DetailPanel row={panel.row} tile={panel.tile} onBack={closePanel} />
      ) : panel.kind === 'promo' ? (
        <PromoPanel banner={panel.banner} onBack={closePanel} />
      ) : (
        <SavedPanel />
      )}
      <Bar
        savedShown={savedShown}
        selected={barSelected}
        onTap={(label) => {
          record('Tapped', label, 'bar');
          setBarSelected(label);
          setPanel(label === 'Saved' ? { kind: 'saved' } : NONE);
        }}
      />
      <QuickSheet
        target={sheet}
        onButton={(label) => {
          if (!sheet) return;
          record('Tapped', label, `quick sheet, ${sheet.title}`);
          setSheet(null);
          if (label === 'Open') setPanel(sheet.opens);
        }}
        onDismiss={() => setSheet(null)}
      />
    </Screen>
  );
}

/** The page: the vertical scroller between the Top 10 row and the bar. */
function Page({ offsets, children }: { offsets: Offsets; children: ReactNode }) {
  const start = useStart(0, offsets.page);
  return (
    <ScrollView testID={TestIds.LOBBY_PAGE} style={styles.page} contentOffset={start} onScroll={(e) => (offsets.page = yOf(e))} scrollEventThrottle={16}>
      {children}
    </ScrollView>
  );
}

/**
 * One touchable element of the Lobby: Pressable's own tap and long press. A tap waits the double-tap time for a
 * second one; two presses inside it are one "Double-tapped" line. Nothing here cancels a press on movement: what a
 * finger that moves does is Pressable's own rule.
 */
function Touchable({
  id,
  what,
  where,
  record,
  onTap,
  onLongPress,
  label,
  selected,
  style,
  children,
}: {
  id: string;
  what: string;
  where: string;
  record: LogFn;
  onTap?: () => void;
  onLongPress?: () => void;
  label?: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children: ReactNode;
}) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label ?? what}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={() => {
        if (pending.current !== null) {
          clearTimeout(pending.current);
          pending.current = null;
          record('Double-tapped', what, where);
          return;
        }
        pending.current = setTimeout(() => {
          pending.current = null;
          record('Tapped', what, where);
          onTap?.();
        }, DOUBLE_TAP_MS);
      }}
      onLongPress={() => {
        record('Long-pressed', what, where);
        onLongPress?.();
      }}
      style={style}
    >
      {children}
    </Pressable>
  );
}

function TouchLogBlock({ log, onReset }: { log: TouchLog; onReset: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.logBlock, { backgroundColor: colors.surfaceContainerLow }]}>
      <View style={{ flex: 1 }}>
        <Text style={[Type.labelMedium, { color: colors.onSurfaceVariant }]}>Touch log</Text>
        <Text testID={TestIds.LOBBY_TOUCH_LOG} numberOfLines={3} accessibilityLiveRegion="polite" style={[Type.bodySmall, styles.logText, { color: colors.onSurface }]}>
          {logText(log)}
        </Text>
      </View>
      <View style={styles.logSide}>
        <Text testID={TestIds.LOBBY_TOUCH_COUNT} style={[Type.labelMedium, { color: colors.onSurface, marginRight: Space.sm }]}>
          {countText(log)}
        </Text>
        <Button label="Reset" variant="text" testID={TestIds.LOBBY_TOUCH_RESET} onPress={onReset} />
      </View>
    </View>
  );
}

function DelayChoice({
  selected,
  onChoose,
  pagerShown,
  onPagerShown,
}: {
  selected: number;
  onChoose: (seconds: number) => void;
  pagerShown: boolean;
  onPagerShown: (on: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.delayBlock}>
      <View style={styles.delayLine}>
        <Text style={[Type.labelMedium, { flex: 1, color: colors.onSurfaceVariant }]}>Saved appears after</Text>
        <SwitchWithLabel label="Show the pager" id={TestIds.LOBBY_PAGER_SHOWN} value={pagerShown} onChange={onPagerShown} />
      </View>
      <View testID={TestIds.LOBBY_SAVED_DELAY} accessibilityRole="radiogroup" style={[styles.segments, { borderColor: colors.outline }]}>
        {Lobby.DELAYS.map((seconds, i) => {
          const active = seconds === selected;
          return (
            <Pressable
              key={seconds}
              testID={TemplateIds.lobbySavedDelay(seconds)}
              onPress={() => onChoose(seconds)}
              accessibilityRole="radio"
              accessibilityLabel={`${seconds} s`}
              accessibilityState={{ checked: active, selected: active }}
              style={[
                styles.segment,
                i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.outline },
                active && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <Text style={[Type.label, { color: active ? colors.onSecondaryContainer : colors.onSurface, fontWeight: active ? '700' : '400' }]}>{`${seconds} s`}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** React Native's own Switch carries the id, so Appium reads a real switch with its value; the label is beside it. */
function SwitchWithLabel({ label, id, value, onChange }: { label: string; id: string; value: boolean; onChange: (on: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchLine}>
      <Text style={[Type.label, { color: colors.onSurface, marginRight: Space.sm }]} onPress={() => onChange(!value)} accessible={false}>
        {label}
      </Text>
      <Switch
        testID={id}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary }}
        thumbColor={value ? colors.onPrimary : colors.outline}
        ios_backgroundColor={colors.surfaceContainerHighest}
      />
    </View>
  );
}

function Pager({
  width,
  banner,
  onBanner,
  offsets,
  auto,
  onAuto,
  record,
  onPromo,
  onSheet,
}: {
  width: number;
  banner: number;
  onBanner: (n: number) => void;
  offsets: Offsets;
  auto: boolean;
  onAuto: (on: boolean) => void;
  record: LogFn;
  onPromo: (n: number) => void;
  onSheet: (s: SheetFor) => void;
}) {
  const { colors } = useTheme();
  const list = useRef<FlatList<number>>(null);
  const start = useStart(offsets.pager, 0);
  const current = useRef(banner);
  current.current = banner;

  useEffect(() => {
    if (!auto) return undefined;
    const timer = setInterval(() => {
      const next = (current.current % Lobby.BANNERS) + 1;
      list.current?.scrollToOffset({ offset: (next - 1) * width, animated: true });
    }, Lobby.AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [auto, width]);

  const position = pagerPosition(banner);
  return (
    <>
      <FlatList
        ref={list}
        testID={TestIds.LOBBY_PAGER}
        data={range(Lobby.BANNERS)}
        keyExtractor={String}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialNumToRender={Lobby.BANNERS}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        contentOffset={start}
        onScroll={(e) => {
          offsets.pager = xOf(e);
          const n = Math.min(Lobby.BANNERS, Math.max(1, Math.round(offsets.pager / width) + 1));
          if (n !== current.current) onBanner(n);
        }}
        scrollEventThrottle={16}
        style={styles.pager}
        renderItem={({ item: n }) => {
          const title = Lobby.banners[n - 1];
          return (
            <View style={{ width, paddingHorizontal: Space.lg, paddingTop: Space.xs }}>
              <Touchable
                id={TemplateIds.lobbyBanner(n)}
                what={title}
                where={`banner ${n}`}
                record={record}
                onTap={() => onPromo(n)}
                onLongPress={() => onSheet({ title, opens: { kind: 'promo', banner: n } })}
                style={({ pressed }) => [styles.banner, { backgroundColor: pressed ? colors.surfaceVariant : colors.primaryContainer }]}
              >
                <Text style={[Type.title, { color: colors.onPrimaryContainer }]}>{title}</Text>
                <Text style={[Type.bodySmall, { color: colors.onPrimaryContainer }]}>{Lobby.BANNER_NOTE}</Text>
              </Touchable>
            </View>
          );
        }}
      />
      <View style={styles.pagerLine}>
        {/* the dots and the text, one element whose accessible label is the text */}
        <View testID={TestIds.LOBBY_PAGER_POSITION} accessible accessibilityLabel={position} style={styles.dots}>
          {range(Lobby.BANNERS).map((n) => (
            <View
              key={n}
              style={[
                styles.dot,
                n === banner ? { width: 10, height: 10, backgroundColor: colors.primary } : { backgroundColor: colors.outlineVariant },
              ]}
            />
          ))}
          <Text style={[Type.labelMedium, { color: colors.onSurface, marginLeft: Space.xs }]}>{position}</Text>
        </View>
        <SwitchWithLabel label="Auto-advance" id={TestIds.LOBBY_PAGER_AUTO} value={auto} onChange={onAuto} />
      </View>
    </>
  );
}

/** A tile's drawing in the Top 10 row's band: 100 wide, 64 high, on the aisle's tint, the glyph 40 in its ink. */
function Band({ item }: { item: Item }) {
  const { aisles } = useTheme();
  const tint = aisles[item.category];
  return (
    <View style={[styles.band, { backgroundColor: tint.tile }]}>
      <Image source={GLYPHS[item.glyph]} style={{ width: 40, height: 40, tintColor: tint.ink }} accessible={false} />
    </View>
  );
}

/**
 * The Top 10 row (SPEC.md §5, 1.1): fixed, outside the page, under the pager or in its place. No vertical scroller
 * encloses it, so a vertical swipe across it is claimed by nothing: the row of the app where the fault was first seen.
 */
const TopRow = memo(function TopRow({
  offsets,
  width,
  record,
  onDetail,
  onSheet,
}: {
  offsets: Offsets;
  width: number;
  record: LogFn;
  onDetail: (row: number, tile: number) => void;
  onSheet: (s: SheetFor) => void;
}) {
  const { colors } = useTheme();
  const [viewport, setViewport] = useState(width);
  const start = useStart(offsets.top, 0);
  const [shown, setShown] = useState(() => fullyVisibleTiles(offsets.top, width, Lobby.TOP_TILES));
  const position = topRowPosition(shown[0], shown[1]);
  const update = (offset: number, w: number) => {
    const [a, b] = fullyVisibleTiles(offset, w, Lobby.TOP_TILES);
    setShown((s) => (s[0] === a && s[1] === b ? s : [a, b]));
  };
  return (
    <View>
      <Text
        testID={TestIds.LOBBY_TOP_ROW_POSITION}
        accessibilityRole="header"
        accessibilityLabel={position}
        style={[Type.titleSmall, styles.rowHeading, { color: colors.primary, paddingTop: Space.sm }]}
      >
        {position}
      </Text>
      <FlatList
        testID={TestIds.LOBBY_TOP_ROW}
        data={range(Lobby.TOP_TILES)}
        keyExtractor={String}
        horizontal
        showsHorizontalScrollIndicator={false}
        initialNumToRender={Lobby.TOP_TILES}
        contentContainerStyle={styles.rowContent}
        contentOffset={start}
        onLayout={(e) => {
          setViewport(e.nativeEvent.layout.width);
          update(offsets.top, e.nativeEvent.layout.width);
        }}
        onScroll={(e) => {
          offsets.top = xOf(e);
          update(offsets.top, viewport);
        }}
        scrollEventThrottle={16}
        renderItem={({ item: tile }) => {
          const item = topItem(tile);
          return (
            <Touchable
              id={TemplateIds.lobbyTopRowTile(tile)}
              what={item.name}
              where={tileWhere(TOP_ROW, tile)}
              record={record}
              onTap={() => onDetail(TOP_ROW, tile)}
              onLongPress={() => onSheet({ title: item.name, opens: { kind: 'detail', row: TOP_ROW, tile } })}
              style={({ pressed }) => [styles.topTile, pressed && { opacity: 0.7 }]}
            >
              <Band item={item} />
              <Text numberOfLines={1} style={[Type.bodySmall, { color: colors.onSurface, marginTop: Space.xs }]}>
                {item.name}
              </Text>
            </Touchable>
          );
        }}
      />
    </View>
  );
});

function SectionHeading({ text, id, label }: { text: string; id?: string; label?: string }) {
  const { colors } = useTheme();
  return (
    <Text testID={id} accessibilityRole="header" accessibilityLabel={label} style={[Type.titleSmall, styles.sectionHeading, { color: colors.primary }]}>
      {text}
    </Text>
  );
}

const Chips = memo(function Chips({
  offsets,
  selected,
  onSelect,
  record,
}: {
  offsets: Offsets;
  selected: number;
  onSelect: (n: number) => void;
  record: LogFn;
}) {
  const { colors } = useTheme();
  const start = useStart(offsets.chips, 0);
  return (
    <FlatList
      testID={TestIds.LOBBY_CHIPS}
      data={range(Lobby.chips.length)}
      keyExtractor={String}
      horizontal
      showsHorizontalScrollIndicator={false}
      initialNumToRender={Lobby.chips.length}
      contentContainerStyle={styles.chipsContent}
      contentOffset={start}
      onScroll={(e) => (offsets.chips = xOf(e))}
      scrollEventThrottle={16}
      extraData={selected}
      renderItem={({ item: n }) => {
        const label = Lobby.chips[n - 1];
        const on = n === selected;
        return (
          <Touchable
            id={TemplateIds.lobbyChip(n)}
            what={label}
            where={`chip ${n}`}
            record={record}
            selected={on}
            onTap={() => onSelect(n)}
            style={[
              styles.chip,
              on
                ? { backgroundColor: colors.secondaryContainer, borderColor: colors.secondaryContainer }
                : { backgroundColor: colors.surface, borderColor: colors.outline },
            ]}
          >
            {on ? <Icon name="check" size={16} color={colors.onSecondaryContainer} /> : null}
            <Text style={[Type.label, { color: on ? colors.onSecondaryContainer : colors.onSurfaceVariant }]}>{label}</Text>
          </Touchable>
        );
      }}
    />
  );
});

const TileRow = memo(function TileRow({
  row,
  offsets,
  width,
  record,
  onDetail,
  onSheet,
}: {
  row: number;
  offsets: Offsets;
  width: number;
  record: LogFn;
  onDetail: (row: number, tile: number) => void;
  onSheet: (s: SheetFor) => void;
}) {
  const { colors } = useTheme();
  const [viewport, setViewport] = useState(width);
  const start = useStart(offsets.rows[row - 1], 0);
  const [shown, setShown] = useState(() => fullyVisibleTiles(offsets.rows[row - 1], width, Lobby.TILES));
  const position = rowPosition(row, shown[0], shown[1]);
  const update = (offset: number, w: number) => {
    const [a, b] = fullyVisibleTiles(offset, w, Lobby.TILES);
    setShown((s) => (s[0] === a && s[1] === b ? s : [a, b]));
  };
  return (
    <View>
      <SectionHeading text={position} id={TemplateIds.lobbyRowPosition(row)} label={position} />
      <FlatList
        testID={TemplateIds.lobbyRow(row)}
        data={range(Lobby.TILES)}
        keyExtractor={String}
        horizontal
        showsHorizontalScrollIndicator={false}
        initialNumToRender={Lobby.TILES}
        contentContainerStyle={styles.rowContent}
        contentOffset={start}
        onLayout={(e) => {
          setViewport(e.nativeEvent.layout.width);
          update(offsets.rows[row - 1], e.nativeEvent.layout.width);
        }}
        onScroll={(e) => {
          offsets.rows[row - 1] = xOf(e);
          update(offsets.rows[row - 1], viewport);
        }}
        scrollEventThrottle={16}
        renderItem={({ item: tile }) => {
          const item = tileItem(row, tile);
          return (
            <Touchable
              id={TemplateIds.lobbyRowTile(row, tile)}
              what={item.name}
              where={tileWhere(row, tile)}
              record={record}
              onTap={() => onDetail(row, tile)}
              onLongPress={() => onSheet({ title: item.name, opens: { kind: 'detail', row, tile } })}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
            >
              <GlyphTile item={item} size={Lobby.TILE_WIDTH} />
              <Text numberOfLines={1} style={[Type.bodySmall, { color: colors.onSurface, marginTop: Space.xs }]}>
                {item.name}
              </Text>
              <ItemNumber item={item} />
            </Touchable>
          );
        }}
      />
    </View>
  );
});

const Grid = memo(function Grid({ record }: { record: LogFn }) {
  const { colors } = useTheme();
  return (
    <View>
      <SectionHeading text="Grid" />
      <View testID={TestIds.LOBBY_GRID} style={styles.grid}>
        {range(Lobby.GRID_CELLS / 2).map((r) => (
          <View key={r} style={styles.gridRow}>
            {[1, 2].map((c) => {
              const n = (r - 1) * 2 + c;
              const item = gridItem(n);
              return (
                <Touchable
                  key={n}
                  id={TemplateIds.lobbyGridCell(n)}
                  what={item.name}
                  where={`grid, cell ${n}`}
                  record={record}
                  style={({ pressed }) => [styles.gridCell, { borderColor: colors.outlineVariant }, pressed && { backgroundColor: colors.surfaceContainer }]}
                >
                  <GlyphTile item={item} size={40} />
                  <Text numberOfLines={2} style={[Type.bodySmall, { flex: 1, color: colors.onSurface, marginLeft: Space.sm }]}>
                    {item.name}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

const InnerList = memo(function InnerList({ offsets, record }: { offsets: Offsets; record: LogFn }) {
  const { colors } = useTheme();
  const start = useStart(0, offsets.inner);
  return (
    <View>
      <SectionHeading text="Inner list" />
      <FlatList
        testID={TestIds.LOBBY_INNER_LIST}
        data={range(Lobby.INNER_LINES)}
        keyExtractor={String}
        nestedScrollEnabled
        initialNumToRender={Lobby.INNER_LINES}
        contentOffset={start}
        onScroll={(e) => (offsets.inner = yOf(e))}
        scrollEventThrottle={16}
        style={[styles.innerList, { borderColor: colors.outlineVariant }]}
        renderItem={({ item: n }) => (
          <Touchable
            id={TemplateIds.lobbyInnerRow(n)}
            what={`Line ${n}`}
            where="inner list"
            record={record}
            label={innerLine(n)}
            style={({ pressed }) => [styles.innerLine, { borderBottomColor: colors.outlineVariant }, pressed && { backgroundColor: colors.surfaceContainer }]}
          >
            <Text style={[Type.body, { color: colors.onSurface }]}>{innerLine(n)}</Text>
          </Touchable>
        )}
      />
    </View>
  );
});

/**
 * The board: a 280 square window onto 26 × 26 cells of 56. iOS: one ScrollView whose content is wider and taller
 * than its frame, so it scrolls both ways. Android: a ScrollView scrolls one way only, so the board is a vertical
 * ScrollView (with the id) holding a horizontal one; both say "scrollable" in the tree, the outer one first.
 */
const Board = memo(function Board({ offsets, record }: { offsets: Offsets; record: LogFn }) {
  const { colors } = useTheme();
  const [topLeft, setTopLeft] = useState(() => boardTopLeft(offsets.boardX, offsets.boardY));
  const both = useStart(offsets.boardX, offsets.boardY);
  const down = useStart(0, offsets.boardY);
  const across = useStart(offsets.boardX, 0);
  const position = boardPosition(topLeft[0], topLeft[1]);
  const update = () => {
    const [col, row] = boardTopLeft(offsets.boardX, offsets.boardY);
    setTopLeft((t) => (t[0] === col && t[1] === row ? t : [col, row]));
  };
  const cells = <BoardCells record={record} />;
  const frame = [styles.board, { borderColor: colors.outline }];
  return (
    <View>
      <SectionHeading text={position} id={TestIds.LOBBY_BOARD_POSITION} label={position} />
      <View style={styles.boardCentre}>
        {Platform.OS === 'ios' ? (
          <ScrollView
            testID={TestIds.LOBBY_BOARD}
            style={frame}
            contentContainerStyle={styles.boardContent}
            contentOffset={both}
            directionalLockEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              offsets.boardX = xOf(e);
              offsets.boardY = yOf(e);
              update();
            }}
            scrollEventThrottle={16}
          >
            {cells}
          </ScrollView>
        ) : (
          <ScrollView
            testID={TestIds.LOBBY_BOARD}
            style={frame}
            nestedScrollEnabled
            contentOffset={down}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              offsets.boardY = yOf(e);
              update();
            }}
            scrollEventThrottle={16}
          >
            <ScrollView
              horizontal
              nestedScrollEnabled
              contentOffset={across}
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                offsets.boardX = xOf(e);
                update();
              }}
              scrollEventThrottle={16}
            >
              <View style={styles.boardContent}>{cells}</View>
            </ScrollView>
          </ScrollView>
        )}
      </View>
    </View>
  );
});

const BoardCells = memo(function BoardCells({ record }: { record: LogFn }) {
  const { colors } = useTheme();
  return (
    <>
      {range(Lobby.BOARD).map((row) => (
        <View key={row} style={styles.boardRow}>
          {range(Lobby.BOARD).map((col) => {
            const label = boardLabel(col, row);
            return (
              <Touchable
                key={col}
                id={TemplateIds.lobbyBoardCell(col, row)}
                what={label}
                where="board"
                record={record}
                style={({ pressed }) => [styles.boardCell, { borderColor: colors.outlineVariant }, pressed && { backgroundColor: colors.surfaceContainer }]}
              >
                <Text style={[Type.labelMedium, { color: colors.onSurface }]}>{label}</Text>
              </Touchable>
            );
          })}
        </View>
      ))}
    </>
  );
});

/** A panel takes the place of the pager, the Top 10 row and the page. It is a plain view, so its button keeps its id. */
function PanelColumn({ id, children }: { id: string; children: ReactNode }) {
  return (
    <View testID={id} style={styles.panel}>
      {children}
    </View>
  );
}

function DetailPanel({ row, tile, onBack }: { row: number; tile: number; onBack: () => void }) {
  const { colors } = useTheme();
  const item = itemAt(row, tile);
  return (
    <PanelColumn id={TestIds.LOBBY_DETAIL}>
      <GlyphTile item={item} size={96} label={`Drawing of the ${item.name}`} />
      <Text style={[Type.headlineSmall, styles.center, { color: colors.onSurface }]}>{item.name}</Text>
      <ItemNumber item={item} />
      <Text style={[Type.body, { color: colors.onSurface }]}>{detailPlace(row, tile)}</Text>
      <Button label={Lobby.BACK_TO_LOBBY} variant="outlined" testID={TestIds.LOBBY_DETAIL_BACK} onPress={onBack} style={{ marginTop: Space.sm }} />
    </PanelColumn>
  );
}

function PromoPanel({ banner, onBack }: { banner: number; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <PanelColumn id={TestIds.LOBBY_PROMO}>
      <Text style={[Type.headlineSmall, styles.center, { color: colors.onSurface }]}>{Lobby.banners[banner - 1]}</Text>
      <Text style={[Type.label, { color: colors.onSurface }]}>{pagerPosition(banner)}</Text>
      <Text style={[Type.body, styles.center, { color: colors.onSurfaceVariant }]}>{Lobby.PROMO_NOTE}</Text>
      <Button label={Lobby.BACK_TO_LOBBY} variant="outlined" testID={TestIds.LOBBY_PROMO_BACK} onPress={onBack} style={{ marginTop: Space.sm }} />
    </PanelColumn>
  );
}

function SavedPanel() {
  const { colors } = useTheme();
  return (
    <PanelColumn id={TestIds.LOBBY_SAVED_SCREEN}>
      <Icon name="check" size={40} />
      <Text style={[Type.titleLarge, { color: colors.onSurface }]}>{Lobby.SAVED_EMPTY}</Text>
    </PanelColumn>
  );
}

const BAR: readonly { label: string; id: string; icon: IconName }[] = [
  { label: 'Home', id: TestIds.LOBBY_BAR_HOME, icon: 'shop' },
  { label: 'Live', id: TestIds.LOBBY_BAR_LIVE, icon: 'eye' },
  { label: 'Saved', id: TestIds.LOBBY_BAR_SAVED, icon: 'check' },
  { label: 'Offers', id: TestIds.LOBBY_BAR_OFFERS, icon: 'cart' },
];

/** The Lobby's own bar, not the app's tabs. Saved is not rendered until its delay has passed: three items, no node. */
function Bar({ savedShown, selected, onTap }: { savedShown: boolean; selected: string; onTap: (label: string) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const material = Platform.OS !== 'ios';
  return (
    <View
      testID={TestIds.LOBBY_BAR}
      style={[styles.bar, { backgroundColor: colors.surfaceContainer, paddingBottom: insets.bottom, height: 80 + insets.bottom }]}
    >
      {BAR.filter((b) => b.label !== 'Saved' || savedShown).map((b) => {
        const on = b.label === selected;
        const ink = on ? (material ? colors.onSecondaryContainer : colors.primary) : colors.onSurfaceVariant;
        return (
          <Pressable
            key={b.label}
            testID={b.id}
            onPress={() => onTap(b.label)}
            accessibilityRole="button"
            accessibilityLabel={b.label}
            accessibilityState={{ selected: on }}
            style={styles.barItem}
          >
            <View style={[styles.indicator, material && on && { backgroundColor: colors.secondaryContainer }]}>
              <Icon name={b.icon} color={ink} />
            </View>
            <Text style={[Type.labelMedium, { color: on ? (material ? colors.onSurface : colors.primary) : colors.onSurfaceVariant }]}>{b.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The quick sheet: a Modal sliding from the bottom, so a window (Android) or a presented view (iOS) of its own. Back
 * (onRequestClose), a tap on the scrim or a drag down closes it, with no log line.
 */
function QuickSheet({ target, onButton, onDismiss }: { target: SheetFor | null; onButton: (label: string) => void; onDismiss: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 48) dismiss.current();
      },
    }),
  ).current;
  const ids = [TestIds.LOBBY_SHEET_OPEN, TestIds.LOBBY_SHEET_PREVIEW, TestIds.LOBBY_SHEET_SAVED, TestIds.LOBBY_SHEET_RATE];
  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessible={false} importantForAccessibility="no" />
        <View
          testID={TestIds.LOBBY_SHEET}
          accessibilityViewIsModal
          {...drag.panHandlers}
          style={[styles.sheet, { backgroundColor: colors.surfaceContainerLow, paddingBottom: Space.xl + insets.bottom }]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.outlineVariant }]} />
          <Text testID={TestIds.LOBBY_SHEET_TITLE} accessibilityRole="header" style={[Type.titleLarge, { color: colors.onSurface, marginBottom: Space.md }]}>
            {target?.title ?? ''}
          </Text>
          {Lobby.sheetButtons.map((label, i) => (
            <Pressable
              key={label}
              testID={ids[i]}
              onPress={() => onButton(label)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.sheetButton, pressed && { backgroundColor: colors.surfaceContainerHigh }]}
            >
              <Text style={[Type.label, { color: colors.primary }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  logBlock: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: Space.lg, paddingRight: Space.sm, paddingTop: Space.sm, paddingBottom: Space.xs },
  logText: { minHeight: 48, marginTop: 2 },
  logSide: { alignItems: 'flex-end' },
  delayBlock: { paddingHorizontal: Space.lg, paddingVertical: Space.xs },
  delayLine: { flexDirection: 'row', alignItems: 'center' },
  switchLine: { flexDirection: 'row', alignItems: 'center' },
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.full, overflow: 'hidden', marginTop: Space.xs },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  pager: { flexGrow: 0, height: 104 },
  banner: { height: 96, borderRadius: Radius.md, padding: Space.lg, justifyContent: 'center' },
  pagerLine: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.lg },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  dot: { width: 6, height: 6, borderRadius: 5, marginRight: 6 },
  rowHeading: { paddingHorizontal: Space.lg, paddingBottom: Space.xs },
  rowContent: { paddingHorizontal: Lobby.ROW_PADDING, gap: Lobby.TILE_GAP, paddingBottom: Space.xs },
  topTile: { width: Lobby.TILE_WIDTH },
  band: { width: Lobby.TILE_WIDTH, height: 64, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  page: { flex: 1 },
  sectionHeading: { paddingHorizontal: Space.lg, paddingTop: Space.lg, paddingBottom: Space.sm },
  chipsContent: { paddingHorizontal: Space.lg, paddingVertical: Space.sm, gap: Space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Space.md, paddingVertical: 6 },
  tile: { width: Lobby.TILE_WIDTH },
  grid: { paddingHorizontal: Space.lg, gap: Space.sm },
  gridRow: { flexDirection: 'row', gap: Space.sm },
  gridCell: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.sm, padding: Space.sm },
  innerList: { height: 240, marginHorizontal: Space.lg, borderWidth: 1, borderRadius: Radius.sm },
  innerLine: { paddingHorizontal: Space.md, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  boardCentre: { alignItems: 'center' },
  board: { width: BOARD_SIZE, height: BOARD_SIZE, flexGrow: 0, borderWidth: 1, borderRadius: Radius.xs },
  boardContent: { width: BOARD_CONTENT, height: BOARD_CONTENT },
  boardRow: { flexDirection: 'row' },
  boardCell: { width: Lobby.BOARD_CELL, height: Lobby.BOARD_CELL, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', paddingTop: Space.xl, paddingBottom: 48 },
  panel: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl, gap: Space.sm },
  center: { textAlign: 'center' },
  bar: { flexDirection: 'row' },
  barItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.xs },
  indicator: { width: 64, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Space.lg, paddingTop: Space.sm },
  grabber: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginBottom: Space.lg },
  sheetButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Space.md, borderRadius: Radius.full },
});
