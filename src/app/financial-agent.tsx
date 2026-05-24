import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bot, Send, Sparkles } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, PressableScale, Text } from '@/components';
import {
  askFinancialChat,
  type FinancialChatHistoryItem,
  type FinancialChatResponse,
} from '@/services/api';
import { useTheme } from '@/theme';

const CHAT_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

type ChatRole = (typeof CHAT_ROLE)[keyof typeof CHAT_ROLE];

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  response?: FinancialChatResponse;
};

const SUGGESTED_PROMPTS = [
  'Crea un plan financiero para este mes',
  '¿Me conviene pedir un préstamo?',
  '¿En qué estoy gastando más?',
  '¿Cómo subo mi Pasaporte Financiero?',
] as const;

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: CHAT_ROLE.ASSISTANT,
  content:
    'Soy tu agente financiero IA. Puedo revisar tu saldo, movimientos, préstamo activo, capacidad de pago y ayudarte a crear un plan financiero con tus datos de FinGrow.',
};

export default function FinancialAgentScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const canSend = input.trim().length > 0 && !loading;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const toHistory = (items: ChatMessage[]): FinancialChatHistoryItem[] =>
    items
      .filter((item) => item.id !== INITIAL_MESSAGE.id)
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.content }));

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    Haptics.selectionAsync().catch(() => {});
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: CHAT_ROLE.USER,
      content: trimmed,
    };
    const history = toHistory(messages);

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const response = await askFinancialChat(trimmed, history);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: CHAT_ROLE.ASSISTANT,
        content: response.answer,
        response,
      };
      setMessages((current) => [...current, assistantMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: `assistant-error-${Date.now()}`,
        role: CHAT_ROLE.ASSISTANT,
        content:
          error instanceof Error
            ? error.message
            : 'No pude responder en este momento. Intenta de nuevo con una pregunta más concreta.',
      };
      setMessages((current) => [...current, assistantMessage]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <PressableScale
          onPress={close}
          haptic="light"
          scaleTo={0.92}
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radii.lg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.bg,
          }}
          accessibilityLabel="Volver"
        >
          <ArrowLeft size={20} color={theme.colors.primaryDark} strokeWidth={2.2} />
        </PressableScale>
        <View style={{ alignItems: 'center' }}>
          <Text variant="h3">Agente financiero IA</Text>
          <Text variant="micro" tone="muted">
            Gemini + tus datos FinGrow
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 18,
          gap: 12,
        }}
        onContentSizeChange={scrollToBottom}
      >
        <Card padded delay={0} style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Bot size={25} color={theme.colors.primaryDark} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h2">Pregúntame sobre tu dinero</Text>
              <Text variant="bodySmall" tone="muted">
                Planes, préstamos, gastos, saldo, Pasaporte y próximos pasos.
              </Text>
            </View>
          </View>
        </Card>

        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}

        {loading ? (
          <View style={{ alignItems: 'flex-start' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              <ActivityIndicator color={theme.colors.primaryDark} />
              <Text variant="bodySmall" tone="muted">
                Analizando tus datos financieros...
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 10) + 6,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSoft,
          backgroundColor: theme.colors.bg,
          gap: 10,
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <PressableScale
                key={prompt}
                onPress={() => sendQuestion(prompt)}
                disabled={loading}
                haptic="selection"
                scaleTo={0.97}
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  borderRadius: theme.radii.pill,
                  borderWidth: 1,
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.primarySoft,
                  opacity: loading ? 0.55 : 1,
                }}
              >
                <Text variant="caption" tone="primary">
                  {prompt}
                </Text>
              </PressableScale>
            ))}
          </View>
        </ScrollView>

        <View
          style={{
            minHeight: 56,
            borderRadius: theme.radii.xl,
            borderWidth: 1.5,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingLeft: 14,
            paddingRight: 8,
          }}
        >
          <Sparkles size={18} color={theme.colors.primaryDark} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Pregunta: ¿puedo pedir $500.000?"
            placeholderTextColor={theme.colors.textSoft}
            multiline
            maxLength={1200}
            editable={!loading}
            style={{
              flex: 1,
              maxHeight: 92,
              paddingVertical: 12,
              color: theme.colors.text,
              fontFamily: 'Inter_500Medium',
              fontSize: 15,
              lineHeight: 20,
            }}
          />
          <PressableScale
            onPress={() => sendQuestion(input)}
            disabled={!canSend}
            haptic="medium"
            scaleTo={0.92}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? theme.colors.primary : theme.colors.surfaceAlt,
              opacity: canSend ? 1 : 0.55,
            }}
            accessibilityLabel="Enviar pregunta al agente financiero"
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.primaryContrast} />
            ) : (
              <Send size={18} color={theme.colors.primaryContrast} strokeWidth={2.4} />
            )}
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme } = useTheme();
  const isUser = message.role === CHAT_ROLE.USER;

  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '88%',
          padding: 14,
          borderRadius: theme.radii.xl,
          backgroundColor: isUser ? theme.colors.primary : theme.colors.surfaceAlt,
          borderWidth: isUser ? 0 : 1,
          borderColor: theme.colors.borderSoft,
          gap: 10,
        }}
      >
        <Text
          variant="body"
          style={{
            color: isUser ? theme.colors.primaryContrast : theme.colors.text,
            lineHeight: 21,
          }}
        >
          {message.content}
        </Text>

        {!isUser && message.response?.cards?.length ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {message.response.cards.map((card) => (
              <View
                key={`${message.id}-${card.title}`}
                style={{
                  minWidth: 94,
                  flexGrow: 1,
                  padding: 10,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.borderSoft,
                  gap: 3,
                }}
              >
                <Text variant="micro" tone="muted">
                  {card.title}
                </Text>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {card.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!isUser && message.response?.suggestedActions?.length ? (
          <View style={{ gap: 6 }}>
            <Text variant="caption" tone="primary">
              Próximos pasos
            </Text>
            {message.response.suggestedActions.map((action, index) => (
              <Text key={`${message.id}-action-${index}`} variant="bodySmall" tone="muted">
                {index + 1}. {action}
              </Text>
            ))}
          </View>
        ) : null}

        {!isUser && message.response?.disclaimer ? (
          <Text variant="micro" tone="soft">
            {message.response.disclaimer}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
