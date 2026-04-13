import type { ErrorInfo, ReactElement, ReactNode } from "react";
import { Component } from "react";
import { Button, EmptyState } from "../../components/primitives";

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  public state: GlobalErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Portal route failure", error, errorInfo);
  }

  public render(): ReactElement | ReactNode {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-surface p-6 text-on-surface">
          <div className="w-full max-w-xl">
            <EmptyState
              description="Refresh the page or return to a known route."
              title="Portal route unavailable"
              tone="error"
            />
            <div className="mt-4 flex justify-start">
              <Button onClick={() => window.location.assign("/dashboard")}>Return to dashboard</Button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
