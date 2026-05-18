import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-danger/30 bg-danger/5 text-center">
          <AlertCircle className="w-6 h-6 text-danger" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {this.props.fallbackTitle ?? 'Erro ao renderizar este painel'}
            </p>
            {this.state.errorMessage && (
              <p className="text-xs text-muted-foreground max-w-md">{this.state.errorMessage}</p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={this.handleReset} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
