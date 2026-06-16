import { SparkleField } from './SparkleField';

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 ambient-gradient animate-drift">
      <SparkleField count={30} />
    </div>
  );
}
