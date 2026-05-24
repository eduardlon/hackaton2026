import { Component, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 60 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#b00020', marginBottom: 12 }}>
          Algo falló al iniciar la app
        </Text>
        <Text style={{ fontSize: 14, color: '#333', marginBottom: 12 }}>
          {this.state.error.message}
        </Text>
        <ScrollView style={{ maxHeight: 400 }}>
          <Text style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>
            {this.state.error.stack}
          </Text>
        </ScrollView>
      </View>
    );
  }
}
