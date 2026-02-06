
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { logger } from "@/lib/monitoring/logger";
import { captureException } from "@/lib/sentry";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global Error Boundary
 * Catches unhandled errors in the component tree and displays a fallback UI.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error("[GlobalErrorBoundary] Uncaught error:", error, errorInfo);

        // Send to error tracking service (Sentry) in production
        if ((import.meta as any).env?.PROD) {
            captureException(error, {
                componentStack: errorInfo.componentStack,
                errorBoundary: true,
            });
        }
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
                    <Card className="w-full max-w-md shadow-lg border-destructive/20">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                                <AlertTriangle className="w-6 h-6 text-destructive" />
                            </div>
                            <CardTitle className="text-xl font-bold">Something went wrong</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center space-y-4">
                            <p className="text-muted-foreground text-sm">
                                An unexpected error occurred. We've optimized the app to prevent data loss,
                                but we need to reload to get things back on track.
                            </p>
                            {this.state.error && (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) && (
                                <div className="p-3 bg-muted rounded-md text-left overflow-auto max-h-40 text-xs font-mono">
                                    {this.state.error.toString()}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                            <Button variant="outline" onClick={() => window.history.back()} className="w-full sm:w-auto gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Go Back
                            </Button>
                            <Button onClick={() => window.location.href = '/'} className="w-full sm:w-auto gap-2">
                                <Home className="w-4 h-4" />
                                Go Home
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
