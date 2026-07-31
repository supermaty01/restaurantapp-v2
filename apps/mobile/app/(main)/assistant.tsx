import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { runAssistant, type ChatMessage } from '@/features/assistant/agent';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { ASSISTANT_ENABLED } from '@/lib/features';
import { useDatabase } from '@/lib/hooks/useDatabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Assistant chat (docs/07). Natural-language questions over your diary:
 * "¿cuántas carbonaras comí en Roma?", "¿cuándo comí con Caro?". The agent runs
 * the query tools locally; only the question and minimal results reach the LLM.
 *
 * Voice input and the conversational registration agent are follow-ups that need
 * device + Worker verification; this screen covers the text query path.
 */
export default function AssistantScreen() {
  // La pantalla se defiende sola. Quitar el <Stack.Screen> del layout le quita
  // el título, no la ruta: expo-router registra todo fichero de app/, así que
  // un enlace guardado o un deep link seguirían llegando aquí.
  if (!ASSISTANT_ENABLED) return <Redirect href="/(main)/(tabs)" />;

  return <AssistantChat />;
}

function AssistantChat() {
  const { colors } = useTheme();
  const db = useDatabase();
  const { session } = useAuth();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const systemPrompt = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [
      'Eres el asistente de un diario gastronómico personal.',
      `Hoy es ${today}.`,
      'Responde en español, breve y concreto. Usa las herramientas para consultar',
      'los datos; nunca inventes cifras. Si falta información, pregunta.',
    ].join(' ');
  }, []);

  const canUse = Boolean(API_URL) && session !== null;

  const ask = async () => {
    const question = input.trim();
    if (!question || !canUse || !session) return;

    const nextHistory: ChatMessage[] = [...history, { role: 'user', content: question }];
    setHistory(nextHistory);
    setInput('');
    setBusy(true);
    try {
      const { answer } = await runAssistant(
        db,
        { apiUrl: API_URL as string, token: session.access_token, systemPrompt },
        nextHistory,
      );
      setHistory([...nextHistory, { role: 'assistant', content: answer }]);
    } catch {
      setHistory([
        ...nextHistory,
        { role: 'assistant', content: 'No pude consultar ahora mismo. Inténtalo de nuevo.' },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd());
    }
  };

  if (!canUse) {
    return (
      <View className="flex-1 bg-canvas p-4 justify-center">
        <View className="bg-surface p-4 rounded-xl">
          <Text className="text-lg font-bold text-ink mb-2">Asistente</Text>
          <Text className="text-ink-muted">
            El asistente necesita una cuenta y el servicio de IA configurado. Mientras tanto, la app
            funciona con normalidad de forma local.
          </Text>
        </View>
      </View>
    );
  }

  const visible = history.filter((m) => m.role === 'user' || m.role === 'assistant');

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView ref={scrollRef} className="flex-1 p-4" contentContainerClassName="gap-3">
        {visible.length === 0 && (
          <Text className="text-ink-subtle text-center mt-8">
            Pregúntame sobre tus comidas. Por ejemplo: “¿cuántas carbonaras comí en Roma?”.
          </Text>
        )}
        {visible.map((m, i) => (
          <View
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2 ${
              m.role === 'user' ? 'self-end bg-primary' : 'self-start bg-surface'
            }`}
          >
            <Text className={m.role === 'user' ? 'text-on-primary' : 'text-ink'}>{m.content}</Text>
          </View>
        ))}
        {busy && <ActivityIndicator className="mt-2" color={colors.primary} />}
      </ScrollView>

      <View className="flex-row items-center gap-2 p-3 border-t border-line">
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => void ask()}
          placeholder="Escribe tu pregunta…"
          placeholderTextColor="#9ca3af"
          className="flex-1 min-h-12 px-4 border border-line rounded-full bg-surface text-ink"
        />
        <TouchableOpacity
          onPress={() => void ask()}
          disabled={busy}
          className="bg-primary rounded-full w-12 h-12 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Enviar"
        >
          <Ionicons name="send" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
