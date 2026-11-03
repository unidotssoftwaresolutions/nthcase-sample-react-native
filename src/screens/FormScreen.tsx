import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES, categoryLabel, type CategoryKey } from '../data/catalog';
import {
  ageInput,
  daysInMonth,
  EMPTY_FORM,
  firstWeekday,
  formatPickedDate,
  formErrors,
  MONTHS_LONG,
  welcomeMessage,
  type ClubForm,
} from '../data/rules';
import { TemplateIds, TestIds } from '../testIds';
import { Button, DialogActions, ErrorLine, Icon, IconButton, Screen, TextField, TopBar } from '../ui/components';
import { Slider } from '../ui/Slider';
import { useSnack } from '../ui/snackbar';
import { Radius, Space, Type, useTheme } from '../ui/theme';

export const JOINED_MESSAGE = 'Welcome to the club';

export function FormScreen({ onBack, today = () => new Date() }: { onBack: () => void; today?: () => Date }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const snack = useSnack();
  const [form, setForm] = useState<ClubForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);
  const [sliding, setSliding] = useState(false);

  const edit = (patch: Partial<ClubForm>) => setForm((f) => ({ ...f, ...patch }));
  // Errors appear after the first Join, then follow every edit.
  const errors = submitted ? formErrors(form) : {};

  function join() {
    setSubmitted(true);
    if (Object.keys(formErrors(form)).length === 0) {
      setJoined(welcomeMessage(form.name, form.email, categoryLabel(form.category!), form.deliveryDate!));
      snack(JOINED_MESSAGE);
    } else {
      setJoined(null);
    }
  }

  return (
    <Screen testID={TestIds.FORM_SCREEN}>
      <TopBar title="Join the club" onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          scrollEnabled={!sliding}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + Space.xl }]}
        >
          <Text style={[Type.body, { color: colors.onSurfaceVariant }]}>
            Members hear about new drawers first. Every field is required except the newsletter.
          </Text>
          <View>
            <TextField label="Full name" testID={TestIds.FORM_NAME} value={form.name} onChangeText={(name) => edit({ name })} error={!!errors.name} autoCorrect={false} />
            <ErrorLine error={errors.name} testID={TestIds.FORM_NAME_ERROR} />
          </View>
          <View>
            <TextField
              label="Email"
              testID={TestIds.FORM_EMAIL}
              value={form.email}
              onChangeText={(email) => edit({ email })}
              error={!!errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <ErrorLine error={errors.email} testID={TestIds.FORM_EMAIL_ERROR} />
          </View>
          <View>
            <TextField
              label="Age"
              testID={TestIds.FORM_AGE}
              value={form.age}
              onChangeText={(age) => edit({ age: ageInput(age) })}
              error={!!errors.age}
              keyboardType="number-pad"
              maxLength={3}
            />
            <ErrorLine error={errors.age} testID={TestIds.FORM_AGE_ERROR} />
          </View>
          <View>
            <TextField
              label="Password"
              testID={TestIds.FORM_PASSWORD}
              value={form.password}
              onChangeText={(password) => edit({ password })}
              error={!!errors.password}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              trailing={
                <IconButton
                  testID={TestIds.FORM_PASSWORD_TOGGLE}
                  icon={showPassword ? 'eye_off' : 'eye'}
                  label={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((s) => !s)}
                />
              }
            />
            <ErrorLine error={errors.password} testID={TestIds.FORM_PASSWORD_ERROR} />
          </View>

          <View>
            <Text style={[Type.bodySmall, { color: errors.category ? colors.error : colors.onSurfaceVariant, marginBottom: Space.xs }]}>Favourite aisle</Text>
            <Pressable
              testID={TestIds.FORM_CATEGORY}
              onPress={() => setCategoryOpen(true)}
              accessibilityRole="combobox"
              accessibilityLabel="Favourite aisle"
              accessibilityValue={{ text: form.category ? categoryLabel(form.category) : '' }}
              accessibilityState={{ expanded: categoryOpen }}
              style={[styles.picker, { borderColor: errors.category ? colors.error : colors.outline, borderWidth: errors.category ? 2 : 1 }]}
            >
              <Text style={[Type.bodyLarge, { flex: 1, color: colors.onSurface }]}>{form.category ? categoryLabel(form.category) : ''}</Text>
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <Icon name="chevron" />
              </View>
            </Pressable>
            <ErrorLine error={errors.category} testID={TestIds.FORM_CATEGORY_ERROR} />
          </View>

          <View>
            <Text style={[Type.bodySmall, { color: errors.date ? colors.error : colors.onSurfaceVariant, marginBottom: Space.xs }]}>Delivery date</Text>
            <View style={[styles.picker, styles.dateField, { borderColor: errors.date ? colors.error : colors.outline, borderWidth: errors.date ? 2 : 1 }]}>
              <Text accessibilityLabel={`Delivery date: ${form.deliveryDate ?? 'not chosen'}`} style={[Type.bodyLarge, { flex: 1, color: colors.onSurface }]}>
                {form.deliveryDate ?? ''}
              </Text>
              <IconButton testID={TestIds.FORM_DATE} icon="calendar" label="Choose a delivery date" onPress={() => setDateOpen(true)} />
            </View>
            <ErrorLine error={errors.date} testID={TestIds.FORM_DATE_ERROR} />
          </View>

          <View style={styles.toggleRow}>
            <Text style={[Type.bodyLarge, { flex: 1, color: colors.onSurface }]} onPress={() => edit({ newsletter: !form.newsletter })} accessible={false}>
              Email me about new drawers
            </Text>
            <Switch
              testID={TestIds.FORM_NEWSLETTER}
              accessibilityLabel="Email me about new drawers"
              value={form.newsletter}
              onValueChange={(newsletter) => edit({ newsletter })}
              trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary }}
              thumbColor={form.newsletter ? colors.onPrimary : colors.outline}
              ios_backgroundColor={colors.surfaceContainerHighest}
            />
          </View>

          <View>
            <View style={styles.toggleRow}>
              <Text style={[Type.bodyLarge, { flex: 1, color: colors.onSurface }]}>Monthly budget</Text>
              <Text testID={TestIds.FORM_BUDGET_VALUE} style={[Type.title, { color: colors.onSurface }]}>{`$${form.budget}`}</Text>
            </View>
            <Slider
              testID={TestIds.FORM_BUDGET}
              label="Monthly budget"
              value={form.budget}
              valueText={`$${form.budget}`}
              min={0}
              max={200}
              step={10}
              onChange={(budget) => edit({ budget })}
              onDragStateChange={setSliding}
            />
          </View>

          <View>
            <Pressable
              testID={TestIds.FORM_TERMS}
              onPress={() => edit({ acceptedTerms: !form.acceptedTerms })}
              accessibilityRole="checkbox"
              accessibilityLabel="I accept the club terms"
              accessibilityState={{ checked: form.acceptedTerms }}
              style={styles.toggleRow}
            >
              <Text style={[Type.bodyLarge, { flex: 1, color: colors.onSurface }]}>I accept the club terms</Text>
              <View style={[styles.checkbox, form.acceptedTerms ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.onSurfaceVariant }]}>
                {form.acceptedTerms ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
              </View>
            </Pressable>
            <ErrorLine error={errors.terms} testID={TestIds.FORM_TERMS_ERROR} />
          </View>

          <Button label="Join" testID={TestIds.FORM_SUBMIT} onPress={join} style={{ marginTop: Space.xs }} />

          {joined ? (
            // one element with the whole message, so a check on form_result reads its text
            <View testID={TestIds.FORM_RESULT} accessible accessibilityLabel={joined} style={[styles.result, { backgroundColor: colors.primaryContainer }]}>
              <Icon name="check" color={colors.onPrimaryContainer} />
              <Text style={[Type.body, { flex: 1, color: colors.onPrimaryContainer }]}>{joined}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <CategoryMenu
        visible={categoryOpen}
        selected={form.category}
        onClose={() => setCategoryOpen(false)}
        onChoose={(category) => {
          edit({ category });
          setCategoryOpen(false);
        }}
      />
      {dateOpen ? (
        <DatePicker
          today={today()}
          onCancel={() => setDateOpen(false)}
          onConfirm={(date) => {
            edit({ deliveryDate: date });
            setDateOpen(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

/** The dropdown's menu: four options, each with its own id, in a modal so the rest of the form waits. */
function CategoryMenu({
  visible,
  selected,
  onClose,
  onChoose,
}: {
  visible: boolean;
  selected: CategoryKey | null;
  onClose: () => void;
  onChoose: (key: CategoryKey) => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
        <View accessibilityViewIsModal style={[styles.menu, { backgroundColor: colors.surfaceContainer }]}>
          {CATEGORIES.map((c) => {
            const isSelected = selected === c.key;
            return (
              <Pressable
                key={c.key}
                testID={TemplateIds.formCategoryOption(c.key)}
                onPress={() => onChoose(c.key)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [styles.menuItem, (pressed || isSelected) && { backgroundColor: colors.surfaceContainerHighest }]}
              >
                <Text style={[Type.bodyLarge, { flex: 1, color: colors.onSurface }]}>{c.label}</Text>
                {isSelected ? <Icon name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A month calendar with OK and Cancel. It opens on the current month; OK is enabled once a day is chosen. */
function DatePicker({ today, onCancel, onConfirm }: { today: Date; onCancel: () => void; onConfirm: (date: string) => void }) {
  const { colors } = useTheme();
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [chosen, setChosen] = useState<{ year: number; month: number; day: number } | null>(null);
  const days = daysInMonth(month.year, month.month);
  const lead = firstWeekday(month.year, month.month);
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const shift = (by: number) => {
    const d = new Date(month.year, month.month + by, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View testID={TestIds.FORM_DATE_PICKER} accessibilityViewIsModal style={[styles.calendar, { backgroundColor: colors.surfaceContainerHigh }]}>
          {/* scrolls when a landscape phone is shorter than the month */}
          <ScrollView contentContainerStyle={{ padding: Space.xl }}>
          <Text style={[Type.label, { color: colors.onSurfaceVariant }]}>Select date</Text>
          <Text style={[Type.headline, { color: colors.onSurface, marginTop: Space.sm }]}>
            {chosen ? formatPickedDate(chosen.year, chosen.month, chosen.day) : 'No date chosen'}
          </Text>
          <View style={[styles.monthRow, { marginTop: Space.lg }]}>
            <View style={{ transform: [{ scaleX: -1 }] }}>
              <IconButton icon="chevron" label="Previous month" onPress={() => shift(-1)} />
            </View>
            <Text accessibilityRole="header" style={[Type.titleSmall, { flex: 1, textAlign: 'center', color: colors.onSurface }]}>
              {`${MONTHS_LONG[month.month]} ${month.year}`}
            </Text>
            <IconButton icon="chevron" label="Next month" onPress={() => shift(1)} />
          </View>
          <View style={styles.week}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={[Type.bodySmall, styles.cellText, { color: colors.onSurfaceVariant }]} accessible={false}>
                {d}
              </Text>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={styles.week}>
              {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
                if (day === null) return <View key={i} style={styles.cell} />;
                const isChosen = chosen?.year === month.year && chosen.month === month.month && chosen.day === day;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setChosen({ year: month.year, month: month.month, day })}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${MONTHS_LONG[month.month]} ${month.year}`}
                    accessibilityState={{ selected: isChosen }}
                    style={[styles.cell, isChosen && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[Type.body, styles.cellText, { color: isChosen ? colors.onPrimary : colors.onSurface }]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <DialogActions>
            <Button label="Cancel" variant="text" testID={TestIds.FORM_DATE_CANCEL} onPress={onCancel} />
            <Button
              label="OK"
              variant="text"
              testID={TestIds.FORM_DATE_CONFIRM}
              disabled={chosen === null}
              onPress={() => chosen && onConfirm(formatPickedDate(chosen.year, chosen.month, chosen.day))}
            />
          </DialogActions>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { padding: Space.lg, gap: Space.md },
  picker: { minHeight: 56, borderRadius: Radius.xs, flexDirection: 'row', alignItems: 'center', paddingLeft: Space.lg, paddingRight: Space.md },
  dateField: { paddingRight: 0 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  checkbox: { width: 20, height: 20, borderRadius: 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: Space.md },
  result: { flexDirection: 'row', gap: Space.md, padding: Space.lg, borderRadius: Radius.md },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  menu: { width: '100%', maxWidth: 360, borderRadius: Radius.xs, paddingVertical: Space.sm },
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.lg },
  calendar: { width: '100%', maxWidth: 360, maxHeight: '100%', borderRadius: Radius.xl, overflow: 'hidden' },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cellText: { flex: 1, textAlign: 'center', textAlignVertical: 'center', lineHeight: 40 },
});
