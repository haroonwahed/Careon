import { Skeleton } from "./ui/skeleton";
import { Card } from "./ui/card";

interface LoadingSkeletonProps {
  count?: number;
  type?: "notification" | "message";
}

export function LoadingSkeleton({ count = 5, type = "notification" }: LoadingSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-2xl border border-border p-4 bg-card shadow-sm">
          <div className="flex items-start justify-between gap-4">
            {type === "message" && (
              <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
            )}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-4 w-16 flex-shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  );
}
