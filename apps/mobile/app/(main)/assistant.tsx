import { Ionicons } from '@expo/vector-icons';
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
      <View className="flex-1 bg-muted dark:bg-dark-muted p-4 justify-center">
        <View className="bg-card dark:bg-dark-card p-4 rounded-xl">
          <Text className="text-lg font-bold text-text dark:text-dark-text mb-2">Asistente</Text>
          <Text className="text-gray-600 dark:text-gray-400">
            El asistente necesita una cuenta y el servicio de IA configurado. Mientras tanto, la app
            funciona con normalidad de forma local.
          </Text>
        </View>
      </View>
    );
  }

  const visible = history.filter((m) => m.role === 'user' || m.role === 'assistant');

  return (
    <View className="flex-1 bg-muted dark:bg-dark-muted">
      <ScrollView ref={scrollRef} className="flex-1 p-4" contentContainerClassName="gap-3">
        {visible.length === 0 && (
          <Text className="text-gray-500 dark:text-gray-400 text-center mt-8">
            Pregúntame sobre tus comidas. Por ejemplo: “¿cuántas carbonaras comí en Roma?”.
          </Text>
        )}
        {visible.map((m, i) => (
          <View
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2 ${
              m.role === 'user'
                ? 'self-end bg-primary dark:bg-dark-primary'
                : 'self-start bg-card dark:bg-dark-card'
            }`}
          >
            <Text className={m.role === 'user' ? 'text-white' : 'text-text dark:text-dark-text'}>
              {m.content}
            </Text>
          </View>
        ))}
        {busy && <ActivityIndicator className="mt-2" color="#905c36" />}
      </ScrollView>

      <View className="flex-row items-center gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => void ask()}
          placeholder="Escribe tu pregunta…"
          placeholderTextColor="#9ca3af"
          className="flex-1 min-h-12 px-4 border border-gray-200 dark:border-gray-700 rounded-full bg-white dark:bg-dark-card text-gray-800 dark:text-gray-200"
        />
        <TouchableOpacity
          onPress={() => void ask()}
          disabled={busy}
          className="bg-primary dark:bg-dark-primary rounded-full w-12 h-12 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Enviar"
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
