import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePlan } from '@/hooks/usePlan';
import { FEATURE_MIN_PLAN, FEATURE_DESCRIPTIONS, PLAN_NAMES, isPlanSufficient } from '@/lib/planConfig';
import { cn } from '@/lib/utils';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  className?: string;
}

export function FeatureGate({ feature, children, className }: FeatureGateProps) {
  const { effectivePlan } = usePlan();
  const minPlan = FEATURE_MIN_PLAN[feature];
  
  if (!minPlan || isPlanSufficient(effectivePlan, minPlan)) {
    return <>{children}</>;
  }

  const desc = FEATURE_DESCRIPTIONS[feature];

  return (
    <div className={cn('relative', className)}>
      {/* Preview: real UI rendered but not interactable */}
      <div className="opacity-40 pointer-events-none select-none blur-[1px]" aria-hidden="true">
        {children}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex items-start justify-center pt-16 z-10">
        <Card className="max-w-sm w-full text-center shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">{desc?.title || 'Feature gesperrt'}</CardTitle>
            <CardDescription>
              {desc?.description || 'Dieses Feature ist in deinem aktuellen Abo nicht enthalten.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Verfügbar ab dem <span className="font-semibold text-foreground">{PLAN_NAMES[minPlan]}</span>-Abo
            </p>
            <Button asChild>
              <Link to="/account?tab=subscription">Jetzt upgraden</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
