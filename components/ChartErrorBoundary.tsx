import React from 'react';

interface ChartErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
}

class ChartErrorBoundary extends React.Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  state: ChartErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ChartErrorBoundaryProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown) {
    console.error('ChartRenderer crashed', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-xs text-gray-500 px-3">
          Chart failed to render. Adjust the chart or data and try again.
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;
