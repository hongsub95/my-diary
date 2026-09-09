import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Calendar, LocaleConfig, type DateData } from 'react-native-calendars';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSchedules } from '@/features/schedules/schedule-queries';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import { ScheduleFab } from '@/shared/components/schedule-fab';
import { colors, spacing } from '@/shared/theme';

LocaleConfig.locales.ko = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

/** 'YYYY-MM'이 가리키는 달의 말일을 'YYYY-MM-DD'로 돌려준다. */
function lastDayOfMonth(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  // 다음 달 0일 = 이번 달 말일. 달마다 다른 일수와 윤년을 직접 다루지 않아도 된다.
  const day = new Date(year, month, 0).getDate();
  return `${yearMonth}-${String(day).padStart(2, '0')}`;
}

// 예정·기록 대기·기록됨을 색으로 구분한다. 예정과 기록을 같은 점으로 표시하면
// 캘린더가 "무엇이 있었는지"를 알려주지 못한다
// (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 6절).
const DOT_COLORS: Record<string, string> = {
  planned: colors.primary,
  pending: colors.orange,
  recorded: colors.sage,
};

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => localDateKey());

  // 달을 넘기면 handleMonthChange가 selectedDate를 그 달 1일로 옮기므로, 선택 날짜의
  // 달이 곧 보고 있는 달이다. 장소는 쓰지 않으므로 include를 켜지 않는다.
  const visibleMonth = selectedDate.slice(0, 7);
  const schedules = useSchedules({
    from: `${visibleMonth}-01`,
    to: lastDayOfMonth(visibleMonth),
  });

  const markedDates = useMemo(() => {
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};

    // 한 날짜에 여러 하루가 있으면 더 손이 가는 쪽을 남긴다. 기록 대기는 사용자가
    // 아직 할 일이 있다는 뜻이라 가장 앞에 둔다.
    const priority: Record<string, number> = { pending: 3, planned: 2, recorded: 1 };
    const kinds: Record<string, string> = {};

    for (const schedule of schedules.data ?? []) {
      // status가 아니라 experience_phase로 가른다. status만 보면 지난주에 다녀왔지만
      // 완료를 안 누른 하루가 예정으로 남는다.
      const kind =
        schedule.experience_phase === 'record_pending'
          ? 'pending'
          : schedule.experience_phase === 'recorded'
            ? 'recorded'
            : 'planned';
      const current = kinds[schedule.dateKey];
      if (!current || priority[kind] > priority[current]) kinds[schedule.dateKey] = kind;
    }

    for (const [dateKey, kind] of Object.entries(kinds)) {
      marks[dateKey] = { ...marks[dateKey], marked: true, dotColor: DOT_COLORS[kind] };
    }

    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: colors.primary,
    };
    return marks;
  }, [schedules.data, selectedDate]);

  const selectedSchedules = useMemo(
    () => (schedules.data ?? []).filter((schedule) => schedule.dateKey === selectedDate),
    [schedules.data, selectedDate],
  );

  const handleDayPress = (day: DateData) => setSelectedDate(day.dateString);
  const handleMonthChange = (monthData: DateData) => {
    setSelectedDate(`${monthData.dateString.slice(0, 7)}-01`);
  };
  const [, month, day] = selectedDate.split('-').map(Number);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>나의 일정</Text>
          <Text style={styles.title}>캘린더</Text>
        </View>

        <View style={styles.calendarCard}>
          <Calendar
            current={selectedDate}
            markedDates={markedDates}
            onDayPress={handleDayPress}
            onMonthChange={handleMonthChange}
            enableSwipeMonths
            firstDay={0}
            theme={{
              calendarBackground: colors.surface,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.border,
              monthTextColor: colors.text,
              arrowColor: colors.primary,
              dotColor: colors.primary,
              textMonthFontSize: 18,
              textMonthFontWeight: '800',
              textDayHeaderFontWeight: '700',
            }}
          />
        </View>

        {/* 색만으로는 무슨 점인지 알 수 없다. 범례를 함께 둔다. */}
        <View style={styles.legend}>
          {[
            { kind: 'planned', label: '예정' },
            { kind: 'pending', label: '기록 대기' },
            { kind: 'recorded', label: '기록함' },
          ].map((item) => (
            <View key={item.kind} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: DOT_COLORS[item.kind] }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{month}월 {day}일 일정</Text>
          <Text style={styles.sectionCount}>{selectedSchedules.length}개</Text>
        </View>

        {selectedSchedules.length > 0 ? (
          <View style={styles.list}>
            {selectedSchedules.map((schedule) => <ScheduleCard key={schedule.id} schedule={schedule} />)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>이 날은 일정이 없어요</Text>
          </View>
        )}
      </ScrollView>
      <ScheduleFab
        onPress={() => router.push({ pathname: '/schedules/new', params: { date: selectedDate } })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  heading: { gap: spacing.xs, marginBottom: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  calendarCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, paddingHorizontal: 4 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  legendDot: { borderRadius: 3, height: 6, width: 6 },
  legendText: { color: colors.muted, fontSize: 11 },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionCount: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  list: { gap: spacing.md },
  emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 34 },
  emptyText: { color: colors.muted, fontSize: 14 },
});
