import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

type Notice = { message: string } | null;

export function useSnackbar() {
  const [notice, setNotice] = useState<Notice>(null);
  const showSnackbar = useCallback((message: string) => {
    Keyboard.dismiss();
    setNotice({ message });
    AccessibilityInfo.announceForAccessibility(message);
  }, []);
  const dismissSnackbar = useCallback(() => setNotice(null), []);
  return { notice, showSnackbar, dismissSnackbar };
}

export function Snackbar({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    // Respect Android's accessibility timeout setting for transient messages.
    const timeout = AccessibilityInfo.getRecommendedTimeoutMillis
      ? AccessibilityInfo.getRecommendedTimeoutMillis(5000)
      : Promise.resolve(5000);
    void timeout.catch(() => 5000).then(duration => {
      if (active) timer = setTimeout(onDismiss, duration);
    });
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [notice, onDismiss]);
  if (!notice) return null;
  return <View style={styles.snackbar}>
    <Text style={styles.message}>{notice.message}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="안내 닫기" onPress={onDismiss} style={styles.close}>
      <Text style={styles.closeText}>닫기</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  snackbar: { position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 100, elevation: 8, borderRadius: 14, backgroundColor: '#30352f', flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6, paddingVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8 },
  message: { color: '#fff', flex: 1, fontSize: 14, lineHeight: 21, paddingVertical: 8 },
  close: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  closeText: { color: '#d2e6ce', fontSize: 14, fontWeight: '600' },
});
